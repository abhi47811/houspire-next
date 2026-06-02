import { getAnthropicClient } from "./anthropic";
import { getSupabaseClient } from "./supabase";
import type { BOQRow, RateSource, RoomAnalysis } from "./types";

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
- LIGHTING: Cove LED strip (SMD 14W/m, 3000K) by rft; COB downlights 5W trimless by nos; BLDC fan (Atomberg/Anemos) by nos.
- HARDWARE: Hettich Sensys hinges (pair); Hettich Quadro slides (pair); Hafele Magic Corner (nos); profile handles (nos).
- AC: Unit on one line; install kit on the NEXT separate line. Always two rows.
- CARPENTRY: Each piece separately — wardrobe, loft, desk, shelves, bedside, TV unit. Never bundle.
- Brands required: Century BWR ply, Greenlam laminate, Kajaria/Somany tiles, Mikasa engineered wood, Legrand Arteor switches, Polycab/Havells cable, Atomberg fans, Asian Paints Royale Luxury Emulsion, Marshalls/Excel wallpaper, Hettich/Hafele hardware.

{{RATE_LIBRARY}}

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
  const rateLibrary = await fetchRateLibrary(city);
  const systemPrompt = BOQ_SYSTEM_PROMPT.replace("{{RATE_LIBRARY}}", rateLibrary || "Use standard Indian interior rates for the given city and tier.");
  const resp = await client.messages.create({
    model: "claude-sonnet-4-5",
    max_tokens: 4096,
    system: systemPrompt,
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
