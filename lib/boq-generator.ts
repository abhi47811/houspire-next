import { getAnthropicClient } from "./anthropic";
import { getSupabaseClient } from "./supabase";
import type { BOQRow, BOQPhase, RateSource, RoomAnalysis } from "./types";

const PHASE_MAP: Record<string, BOQPhase> = {
  flooring: "Phase 1: Civil & Flooring",
  waterproofing: "Phase 1: Civil & Flooring",
  ceiling: "Phase 1: Civil & Flooring",
  gypsum: "Phase 1: Civil & Flooring",
  civil: "Phase 1: Civil & Flooring",
  tile: "Phase 1: Civil & Flooring",
  carpentry: "Phase 2: Carpentry",
  wardrobe: "Phase 2: Carpentry",
  kitchen: "Phase 2: Carpentry",
  "tv unit": "Phase 2: Carpentry",
  cabinet: "Phase 2: Carpentry",
  desk: "Phase 2: Carpentry",
  shelv: "Phase 2: Carpentry",
  electrical: "Phase 3: Electrical & MEP",
  lighting: "Phase 3: Electrical & MEP",
  hvac: "Phase 3: Electrical & MEP",
  ac: "Phase 3: Electrical & MEP",
  fan: "Phase 3: Electrical & MEP",
  switch: "Phase 3: Electrical & MEP",
  socket: "Phase 3: Electrical & MEP",
  wiring: "Phase 3: Electrical & MEP",
  plumbing: "Phase 3: Electrical & MEP",
  bathroom: "Phase 4: Finishes & Furnishings",
  hardware: "Phase 4: Finishes & Furnishings",
  textile: "Phase 4: Finishes & Furnishings",
  curtain: "Phase 4: Finishes & Furnishings",
  decor: "Phase 4: Finishes & Furnishings",
  rug: "Phase 4: Finishes & Furnishings",
  paint: "Phase 4: Finishes & Furnishings",
  wallpaper: "Phase 4: Finishes & Furnishings",
  fixture: "Phase 4: Finishes & Furnishings",
};

function inferPhase(category: string, description: string): BOQPhase {
  const text = `${category} ${description}`.toLowerCase();
  for (const [keyword, phase] of Object.entries(PHASE_MAP)) {
    if (text.includes(keyword)) return phase;
  }
  return "Phase 4: Finishes & Furnishings";
}

// Fetch brands unavailable in a city to warn Claude not to specify them
async function fetchUnavailableBrands(city: string): Promise<string> {
  try {
    const db = getSupabaseClient();
    const { data } = await db
      .from("city_brand_availability")
      .select("brand,note")
      .eq("city", city)
      .eq("available", false);
    if (!data || data.length === 0) return "";
    const list = (data as Array<{ brand: string; note: string }>)
      .map((r) => `- ${r.brand}: ${r.note || "not available locally"}`)
      .join("\n");
    return `\nBRAND AVAILABILITY WARNINGS for ${city} — do NOT specify these brands:\n${list}\nUse alternative brands or add note "supply from nearest city".`;
  } catch {
    return "";
  }
}

// Build a rate lookup map for confidence scoring
async function fetchRateLookup(city: string): Promise<Map<string, { min: number; max: number }>> {
  try {
    const db = getSupabaseClient();
    const [rates, mults] = await Promise.all([
      db.from("rates").select("item,rate_min,rate_max"),
      db.from("city_multipliers").select("multiplier").eq("city", city).single(),
    ]);
    const multiplier = (mults.data as { multiplier: number } | null)?.multiplier ?? 1.0;
    const map = new Map<string, { min: number; max: number }>();
    (rates.data ?? []).forEach((r: { item: string; rate_min: number; rate_max: number }) => {
      map.set(r.item.toLowerCase(), {
        min: r.rate_min * multiplier * 0.8,  // 20% tolerance
        max: r.rate_max * multiplier * 1.2,
      });
    });
    return map;
  } catch {
    return new Map();
  }
}

function scoreConfidence(rate: number, description: string, lookup: Map<string, { min: number; max: number }>): "high" | "medium" | "low" {
  const desc = description.toLowerCase();
  for (const [item, range] of lookup) {
    if (desc.includes(item.split(" ")[0]) && rate >= range.min && rate <= range.max) {
      return "high";
    }
  }
  // Rate exists but outside tolerance → medium; no match → low
  for (const [item] of lookup) {
    if (desc.includes(item.split(" ")[0])) return "medium";
  }
  return "low";
}

async function fetchRateLibrary(city: string): Promise<string> {
  try {
    const db = getSupabaseClient();
    const [rates, mults] = await Promise.all([
      db.from("rates").select("category,item,unit,rate_min,rate_max,brand,source_url").order("category"),
      db.from("city_multipliers").select("city,multiplier").eq("city", city).single(),
    ]);
    const multiplier = (mults.data as { multiplier: number } | null)?.multiplier ?? 1.0;
    if (!rates.data || rates.data.length === 0) return "";

    const lines = (rates.data as Array<{ category: string; item: string; unit: string; rate_min: number; rate_max: number; brand?: string }>)
      .map((r) => {
        const rate = r.rate_min === r.rate_max ? `${Math.round(r.rate_min * multiplier)}` : `${Math.round(r.rate_min * multiplier)}-${Math.round(r.rate_max * multiplier)}`;
        const brand = r.brand ? ` (${r.brand})` : "";
        return `${r.item}${brand}: ${rate}/${r.unit}`;
      })
      .join("\n");
    return `RATE LIBRARY — ${city} ×${multiplier} applied:\n${lines}`;
  } catch {
    return "";
  }
}

const BOQ_SYSTEM_PROMPT = `You are the Houspire BOQ Generator. Produce client-deliverable Excel BOQs for Indian residential interior projects.

TEMPLATE RULES (non-negotiable):
- Two tiers only: Mid-tier or Premium. Never economy/standard/luxury.
- City multipliers are SILENT — bake into each line-item rate, never show as a row.
- Description must end with " - <Room Name>".
- No footer rows — no subtotal, GST, contingency, grand total.
- TV/electronics and kitchen appliances are client scope — exclude unless asked.

GRANULARITY — always produce sample-level detail:
- ELECTRICAL: Individual points — 6A switch (Legrand Arteor); 16A socket; dedicated 16A AC point; USB-C outlet; ceiling fan drop; TV-wall MS reinforcement; FR-LSH wiring lump (Polycab/Havells).
- LIGHTING: Cove LED strip (SMD 14W/m, 3000K) by rft; COB downlights 5W trimless by nos; BLDC fan (Atomberg/Anemos) by nos; bedside lamps by nos; pendant lights where visible.
- HARDWARE: Hettich Sensys hinges (pair); Hettich Quadro slides (pair); Hafele Magic Corner (nos); profile handles (nos).
- AC: Unit on one line; install kit on the NEXT separate line. Always two rows.
- CARPENTRY: Each piece separately — wardrobe, loft, desk, shelves, bedside, TV unit. Never bundle.
- FURNITURE (ALWAYS INCLUDE — this is Houspire scope): Include loose furniture visible in renders. Each piece separately:
  * Living Room: sofa set (3+2+1 seater or L-shape), center/coffee table, side tables, console/foyer table
  * Master Bedroom: double bed with headboard, side tables (pair), dresser/dressing unit, ottoman/bench
  * Bedroom: single/double bed, wardrobe (if not built-in), study chair
  * Dining: dining table + chairs (quote as set)
  * Study: study chair, bookshelf (if not built-in)
  * Use brands: Godrej Interio, Durian, Pepperfry premium, Urban Ladder, HomeTown
- SOFT FURNISHINGS: Curtains (sheer + drape + track by rft); area rugs by nos; cushion sets; bed linen set; throw pillows.
- BATHROOM: Each fitting separately — WC, basin mixer, health faucet, shower set, mirror, towel ring, soap dispenser.
- Brands required: Century BWR ply, Greenlam laminate, Kajaria/Somany tiles, Mikasa engineered wood, Legrand Arteor switches, Polycab/Havells cable, Atomberg fans, Asian Paints Royale Luxury Emulsion, Marshalls/Excel wallpaper, Hettich/Hafele hardware, Godrej Interio/Durian furniture.

{{RATE_LIBRARY}}

OUTPUT FORMAT: Return ONLY valid JSON — no markdown, no explanation. Schema:
{
  "boq": [
    { "category": string, "description": string, "unit": string, "qty": number, "rate": number, "phase": "Phase 1: Civil & Flooring" | "Phase 2: Carpentry" | "Phase 3: Electrical & MEP" | "Phase 4: Finishes & Furnishings" }
  ],
  "sources": [
    { "item": string, "basis": string, "source": string }
  ]
}

PHASE ASSIGNMENT RULES:
- Phase 1: Civil & Flooring — Flooring, Waterproofing, Ceiling (false ceiling, gypsum work)
- Phase 2: Carpentry — Wardrobes, modular kitchen, TV units, all carpentry items
- Phase 3: Electrical & MEP — Electrical points, lighting, HVAC/AC, plumbing
- Phase 4: Finishes & Furnishings — Textiles, bathroom fixtures, hardware, decor, paint, wallpaper`;

function buildUserPrompt(rooms: RoomAnalysis[], city: string, pincode: string, tier: string) {
  const roomSummary = rooms
    .map((r) => `- ${r.room_type} (~${r.estimated_sqft} sft)${r.style ? ` [${r.style} style]` : ""}: ${r.design_elements}`)
    .join("\n");
  return `Generate a DETAILED, sample-level BOQ. Every line item = vendor site-quote granularity.

PROJECT: City: ${city} | Pincode: ${pincode} | Tier: ${tier}

ROOMS:
${roomSummary}

QUANTITY CALCULATION RULES (use actual room sqft to calculate quantities):
- Flooring qty = room sqft (e.g., 180 sft room → 180 sft flooring)
- False ceiling qty = 75% of room sqft (account for perimeter exclusion)
- Cove LED strip qty = room perimeter in rft: for a 180 sft room ≈ 56 rft perimeter (√(180)×4 × 0.85)
- Wall paint qty = wall area = perimeter × 9ft height: for 180 sft room ≈ 504 sft walls
- AC: 1 unit per room. 1.5T for rooms < 200 sft, 2.0T for rooms ≥ 200 sft
- Fan qty = 1 per room (except bathrooms)
- COB downlights: 1 per 30-40 sft of floor area
- Electrical switch points: 1 panel per 4 linear feet of wall (round up)
- Wardrobe/storage: use visible design elements — do not invent if not shown

INSTRUCTIONS:
1. Apply the ${city} city multiplier silently to all rates.
2. Generate a line item for EVERY visible and implied element. Never bundle carpentry, electrical, AC.
3. Brand names REQUIRED in every description.
4. Description format: "[full spec + brand] - [Room Name]"
5. Include rate_sources with real brand URLs (kajariaceramics.com, hettich.com, atomberg.com, asianpaints.com, daikinindia.com, legrand.co.in etc.)
6. Notes in sources: "${city} multiplier applied silently" and "Room sizes estimated from renders — confirm before ordering"

Return valid JSON only.`;
}

export async function generateBOQ(
  rooms: RoomAnalysis[],
  city: string,
  pincode: string,
  tier: string,
): Promise<{ rows: BOQRow[]; sources: RateSource[] }> {
  const client = getAnthropicClient();
  const [rateLibrary, brandWarnings, rateLookup] = await Promise.all([
    fetchRateLibrary(city),
    fetchUnavailableBrands(city),
    fetchRateLookup(city),
  ]);
  const fallbackRates = `RATE LIBRARY — Hyderabad baseline:
Gypsum FC cove+paint: 165/sft | Coffered FC: 180/sft | Wood-veneer slat ceiling: 920/sft
Wardrobe premium: 2200/sft | Wardrobe loft: 1750/sft | Built-in TV unit: 1800-2000/sft
Study desk+drawer+cabinet: 1334/sft | Modular kitchen base: 2100/sft | wall: 1900/sft
Quartz countertop 20mm: 800/sft | Crockery unit: 2050/sft
Premium vitrified Kajaria/Somany: 179/sft | Engineered wood Mikasa: 430/sft
Wall emulsion Royale Luxury: 38/sft | Wallpaper supply+install: 140-152/sft
Bath wall tile porcelain: 260/sft | Bath floor tile anti-skid: 230/sft
COB downlights 5W: 650/nos | LED cove strip 14W/m: 110/rft
BLDC fan Atomberg with light kit: 14000/nos | Bedside lamp brass: 4140/nos
Pendant light decorative: 5500-12000/nos
6A switch Legrand Arteor: 1150/nos | 16A socket: 1450/nos | USB-C outlet: 1900/nos
Split AC 1.5T Daikin 5-star: 51000/nos | Split AC 1.5T install kit: 11000/lump
Split AC 2.0T Daikin: 62000/nos | Split AC 2.0T install kit: 12000/lump
Hettich Sensys hinge: 350/pair | Hettich Quadro slide: 1400/pair | Profile handle: 380-580/nos
Curtains sheer+drape+track: 650-750/rft | Area rug premium: 7820/nos
FURNITURE (Godrej Interio / Durian / Pepperfry premium):
L-shape sofa set fabric 3+2: 65000-95000/nos | 3-seater sofa fabric: 35000-55000/nos
Coffee table glass+wood: 12000-22000/nos | Side table pair: 8000-15000/nos
Console/foyer table: 14000-25000/nos | Bookshelf 6-shelf: 18000-28000/nos
Double bed teak/engineered wood king: 45000-75000/nos | Double bed queen: 35000-55000/nos
Bedside table pair with drawer: 16000-28000/nos | Dressing table+stool: 22000-38000/nos
Dining table 6-seater: 35000-65000/set | Dining chair per piece: 4500-8000/nos
Study chair ergonomic: 12000-22000/nos | Ottoman/bench fabric: 8000-15000/nos
BATHROOM FIXTURES:
Wall-hung WC+Geberit cistern+flush plate: 28000-36000/nos
Rain shower head+arm: 9500-12000/nos | Hand shower+hose+bracket: 4500-5500/nos
Concealed 3-way diverter: 9500-13000/nos | Basin mixer: 7500-10000/nos
Health faucet: 3500/nos | Backlit LED mirror anti-fog: 8000-9500/nos
Fluted vanity+stone counter: 14000-22000/nos | Towel ring+robe hook set: 3500-5500/nos
Soap dispenser wall-mount: 2500-3500/nos
Waterproofing crystalline+polymer: 95/sft | Waterproof FC: 145/sft`;
  const rateSection = (rateLibrary || fallbackRates) + brandWarnings;
  const systemPrompt = BOQ_SYSTEM_PROMPT.replace("{{RATE_LIBRARY}}", rateSection);
  const resp = await client.messages.create({
    model: "claude-sonnet-4-5",
    max_tokens: 8192,
    system: systemPrompt,
    messages: [{ role: "user", content: buildUserPrompt(rooms, city, pincode, tier) }],
  });

  const raw = (resp.content[0] as { text: string }).text.trim();

  try {
    // Robust JSON extraction — handle code fences, preamble text, trailing text
    let json = raw;
    if (json.startsWith("```")) {
      json = json.replace(/^```[a-z]*\n?/, "").replace(/\n?```$/, "").trim();
    }
    if (!json.startsWith("{")) {
      const start = json.indexOf("{");
      const end = json.lastIndexOf("}");
      if (start !== -1 && end !== -1) json = json.slice(start, end + 1);
    }
    const parsed = JSON.parse(json) as {
      boq: Array<{ category: string; description: string; unit: string; qty: number; rate: number; phase?: string }>;
      sources: Array<{ item: string; basis: string; source: string }>;
    };

    const rows: BOQRow[] = (parsed.boq ?? [])
      .filter((r) => r.category && r.description && !isNaN(r.qty) && !isNaN(r.rate))
      .map((r) => ({
        category: String(r.category),
        description: String(r.description),
        unit: String(r.unit || "nos"),
        qty: Number(r.qty),
        rate: Number(r.rate),
        confidence: scoreConfidence(Number(r.rate), String(r.description), rateLookup),
        phase: (r.phase as BOQPhase) ?? inferPhase(String(r.category), String(r.description)),
      }));

    const sources: RateSource[] = (parsed.sources ?? [])
      .filter((s) => s.item)
      .map((s) => ({
        item: String(s.item),
        basis: String(s.basis || ""),
        source: String(s.source || ""),
      }));

    return { rows, sources };
  } catch {
    // JSON parse failed — return empty so UI can show error
    return { rows: [], sources: [] };
  }
}
