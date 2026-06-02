import { getAnthropicClient } from "./anthropic";
import type { BOQRow, RateSource, RoomAnalysis } from "./types";

const BOQ_SYSTEM_PROMPT = `You are the Houspire BOQ Generator. Produce client-deliverable Excel BOQs for Indian residential interior projects.

TEMPLATE RULES (non-negotiable):
- Two tiers only: Mid-tier or Premium. Never economy/standard/luxury.
- City multipliers are SILENT — bake into each line-item rate, never show as a row.
- Description must end with " - <Room Name>".
- No footer rows — no subtotal, GST, contingency, grand total.
- TV/electronics and kitchen appliances are client scope — exclude unless asked.

GRANULARITY — always produce sample-level detail:
- ELECTRICAL: Individual points — 6A switch (Legrand Arteor); 16A socket; dedicated 16A AC point; USB-C outlet; ceiling fan drop; TV-wall MS reinforcement; FR-LSH wiring lump (Polycab/Havells).
- LIGHTING: Cove LED strip (SMD 14W/m, 3000K) by rft; COB downlights 5W trimless by nos; BLDC fan (Atomberg/Anemos) by nos.
- HARDWARE: Hettich Sensys hinges (pair); Hettich Quadro slides (pair); Hafele Magic Corner (nos); profile handles (nos).
- AC: Unit on one line; install kit on the NEXT separate line. Always two rows.
- CARPENTRY: Each piece separately — wardrobe, loft, desk, shelves, bedside, TV unit. Never bundle.
- Brands required: Century BWR ply, Greenlam laminate, Kajaria/Somany tiles, Mikasa engineered wood, Legrand Arteor switches, Polycab/Havells cable, Atomberg fans, Asian Paints Royale Luxury Emulsion, Marshalls/Excel wallpaper, Hettich/Hafele hardware.

RATE LIBRARY — Hyderabad baseline ×1.00. Apply city multiplier silently:
Gypsum FC cove+paint: 165/sft | Coffered FC: 180/sft | Wood-veneer slat ceiling: 920/sft
Fluted wall paneling (Century veneer+PU): 1400/sft | Bed-back panel: 1500-1700/sft
Built-in TV unit: 1800-2000/sft | Wardrobe premium: 2200/sft | Wardrobe loft: 1750/sft
Study desk+drawer+cabinet: 1334/sft | Open display shelves: 5980/nos
Modular kitchen base: 2100/sft | wall: 1900/sft | Quartz countertop 20mm: 800/sft
Premium vitrified (Kajaria/Somany): 179/sft | Engineered wood (Mikasa): 430/sft
Wall emulsion Royale Luxury: 38/sft | Wallpaper supply+install: 140-152/sft
Bath wall tile: 260/sft | Bath floor tile: 230/sft | TV-wall marble cladding: 550/sft
COB downlights 5W trimless: 650/nos | LED cove strip high-CRI 14W/m: 110/rft
BLDC fan with light kit (Atomberg/Anemos): 14000/nos | Bedside lamp: 4140/nos
6A switch Legrand Arteor: 1150/nos | 16A socket: 1450/nos | Dedicated 16A AC+isolator: 1500/nos
USB-C: 1900/nos | Ceiling fan drop+slab: 1200/nos | FR-LSH wiring lump: 4500-11000/lump
Split AC 1.5T 5-star (Daikin/Mitsubishi): 51000/nos | Split AC 1.5T install kit: 11000/lump
Split AC 2.0T: 62000/nos | Split AC 2.0T install kit: 12000/lump
Hettich Sensys hinge: 350/pair | Hettich Quadro slide: 1400/pair
Hafele Magic Corner: 14000/nos | Profile handle: 380-580/nos
Curtains sheer+drape+track: 650-750/rft | Area rug premium: 7820/nos
Wall-hung WC+Geberit cistern: 28000-36000/nos | Rain shower head+arm: 9500-12000/nos
Basin mixer: 7500-10000/nos | Health faucet: 3500/nos | Backlit LED mirror anti-fog: 8000-9500/nos
Concealed plumbing CPVC+labour: 18000-24000/lump

OUTPUT FORMAT: Return ONLY valid JSON — no markdown, no explanation. Schema:
{
  "boq": [
    { "category": string, "description": string, "unit": string, "qty": number, "rate": number }
  ],
  "sources": [
    { "item": string, "basis": string, "source": string }
  ]
}`;

function buildUserPrompt(rooms: RoomAnalysis[], city: string, pincode: string, tier: string) {
  const roomSummary = rooms
    .map((r) => `- ${r.room_type} (~${r.estimated_sqft} sft): ${r.design_elements}`)
    .join("\n");
  return `Generate a DETAILED, sample-level BOQ. Every line item = vendor site-quote granularity.

PROJECT: City: ${city} | Pincode: ${pincode} | Tier: ${tier}

ROOMS:
${roomSummary}

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
  const resp = await client.messages.create({
    model: "claude-sonnet-4-5",
    max_tokens: 4096,
    system: BOQ_SYSTEM_PROMPT,
    messages: [{ role: "user", content: buildUserPrompt(rooms, city, pincode, tier) }],
  });

  const raw = (resp.content[0] as { text: string }).text.trim();

  try {
    // Strip markdown code fences if present
    const json = raw.startsWith("```")
      ? raw.replace(/^```[a-z]*\n?/, "").replace(/\n?```$/, "")
      : raw;
    const parsed = JSON.parse(json) as {
      boq: Array<{ category: string; description: string; unit: string; qty: number; rate: number }>;
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
    console.error("BOQ JSON parse failed. Raw:", raw.slice(0, 300));
    return { rows: [], sources: [] };
  }
}
