import { NextRequest, NextResponse } from "next/server";
import { getAnthropicClient } from "@/lib/anthropic";
import { getSupabaseClient } from "@/lib/supabase";

// Verify a specific rate item by searching the brand website
const RATE_PROMPT = (item: string, brand: string | null, sourceUrl: string | null) => `
Search the internet to find the CURRENT 2025-26 India market price for:
"${item}"${brand ? ` by ${brand}` : ""}

${sourceUrl ? `Check the official source: ${sourceUrl}` : ""}
Also check dealer price aggregators, Amazon India, Flipkart, and trade forums.

RULES:
- Return ONLY prices found in search results — do NOT estimate or guess
- If price varies by size/model, return the most common variant
- Prices should be in INR
- If you cannot find a reliable current price, return null for rate_min and rate_max

Return ONLY this JSON, no other text:
{
  "rate_min": <number or null>,
  "rate_max": <number or null>,
  "unit": "<unit like sft/nos/rft/lump>",
  "source_url": "<most authoritative URL found>",
  "notes": "<brief note on what was found>"
}
`;

function isAuthorized(req: NextRequest): boolean {
  const headerKey = req.headers.get("x-admin-key");
  const queryKey = req.nextUrl.searchParams.get("key");
  return headerKey === "houspire-admin-2026" || queryKey === "houspire-admin-2026";
}

export async function POST(req: NextRequest) {
  if (!isAuthorized(req)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { item_id } = await req.json();
  if (!item_id) return NextResponse.json({ error: "item_id required" }, { status: 400 });

  const db = getSupabaseClient();
  const client = getAnthropicClient();

  const { data: rate } = await db.from("rates").select("*").eq("id", item_id).single();
  if (!rate) return NextResponse.json({ error: "Rate not found" }, { status: 404 });

  const r = rate as { id: string; item: string; brand?: string; source_url?: string; category: string };

  try {
    const resp = await client.messages.create({
      model: "claude-sonnet-4-5",
      max_tokens: 512,
      tools: [{ type: "web_search_20250305" as const, name: "web_search" }],
      messages: [{ role: "user", content: RATE_PROMPT(r.item, r.brand || null, r.source_url || null) }],
    });

    const text = resp.content
      .filter((b) => b.type === "text")
      .map((b) => (b as { type: "text"; text: string }).text)
      .join("");

    const jsonMatch = text.match(/\{[\s\S]*\}/);
    if (!jsonMatch) return NextResponse.json({ error: "No JSON in response", raw: text.slice(0, 300) }, { status: 422 });

    const result = JSON.parse(jsonMatch[0]) as {
      rate_min: number | null; rate_max: number | null;
      unit: string; source_url: string; notes: string;
    };

    if (result.rate_min !== null && result.rate_max !== null) {
      await db.from("rates").update({
        rate_min: result.rate_min,
        rate_max: result.rate_max,
        source_url: result.source_url || r.source_url,
        last_verified_at: new Date().toISOString(),
      }).eq("id", r.id);
    }

    return NextResponse.json({
      item: r.item,
      found: result.rate_min !== null,
      rate_min: result.rate_min,
      rate_max: result.rate_max,
      source_url: result.source_url,
      notes: result.notes,
    });
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}

// GET: verify all rates for a category
export async function GET(req: NextRequest) {
  if (!isAuthorized(req)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const category = req.nextUrl.searchParams.get("category");
  const db = getSupabaseClient();
  const client = getAnthropicClient();

  const query = db.from("rates").select("*").order("category");
  if (category) query.eq("category", category);

  const { data: rates } = await query;
  if (!rates || rates.length === 0) return NextResponse.json({ error: "No rates found" }, { status: 404 });

  const results = [];
  for (const rate of rates as Array<{ id: string; item: string; brand?: string; source_url?: string; category: string }>) {
    try {
      const resp = await client.messages.create({
        model: "claude-sonnet-4-5",
        max_tokens: 512,
        tools: [{ type: "web_search_20250305" as const, name: "web_search" }],
        messages: [{ role: "user", content: RATE_PROMPT(rate.item, rate.brand || null, rate.source_url || null) }],
      });
      const text = resp.content
        .filter((b) => b.type === "text")
        .map((b) => (b as { type: "text"; text: string }).text)
        .join("");
      const jsonMatch = text.match(/\{[\s\S]*\}/);
      if (!jsonMatch) { results.push({ item: rate.item, found: false }); continue; }
      const result = JSON.parse(jsonMatch[0]) as { rate_min: number | null; rate_max: number | null; source_url: string; notes: string };
      if (result.rate_min !== null && result.rate_max !== null) {
        await db.from("rates").update({
          rate_min: result.rate_min, rate_max: result.rate_max,
          source_url: result.source_url || rate.source_url,
          last_verified_at: new Date().toISOString(),
        }).eq("id", rate.id);
      }
      results.push({ item: rate.item, found: result.rate_min !== null, rate_min: result.rate_min, rate_max: result.rate_max, notes: result.notes });
    } catch {
      results.push({ item: rate.item, found: false, error: "search failed" });
    }
  }

  return NextResponse.json({ category: category || "all", results });
}

export const maxDuration = 300;
