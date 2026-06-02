import { NextRequest, NextResponse } from "next/server";
import { getSupabaseClient } from "@/lib/supabase";
import { getAnthropicClient } from "@/lib/anthropic";

// Protected by CRON_SECRET header
export async function POST(req: NextRequest) {
  const secret = req.headers.get("x-cron-secret");
  if (secret !== process.env.CRON_SECRET) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const db = getSupabaseClient();
  const client = getAnthropicClient();
  const updated: string[] = [];

  // Use Claude with web_search to fetch current rates from brand sites
  const brandQueries = [
    {
      category: "HVAC",
      item: "Split AC 1.5T 5-star unit Daikin/Mitsubishi",
      query: "Daikin 1.5 ton 5 star inverter split AC price India 2025 site:daikinindia.com OR site:flipkart.com OR site:amazon.in",
    },
    {
      category: "Lighting / Fans",
      item: "BLDC fan with light kit Atomberg/Anemos",
      query: "Atomberg BLDC ceiling fan with light India price 2025 site:atomberg.com",
    },
    {
      category: "Flooring / Walls",
      item: "Premium vitrified Kajaria/Somany",
      query: "Kajaria premium vitrified tiles price per sqft India 2025 site:kajariaceramics.com",
    },
  ];

  for (const bq of brandQueries) {
    try {
      const resp = await client.messages.create({
        model: "claude-sonnet-4-5",
        max_tokens: 256,
        system: "You extract price data from search results. Return ONLY a JSON object: {rate_min: number, rate_max: number, source_url: string}. Numbers in INR. No explanation.",
        tools: [{ type: "web_search_20250305" as const, name: "web_search" }],
        messages: [{ role: "user", content: `Search and extract current India market price for: ${bq.query}\nReturn JSON only.` }],
      });

      const text = resp.content
        .filter((b) => b.type === "text")
        .map((b) => (b as { type: "text"; text: string }).text)
        .join("");

      const json = text.includes("{") ? text.slice(text.indexOf("{"), text.lastIndexOf("}") + 1) : null;
      if (!json) continue;

      const data = JSON.parse(json) as { rate_min: number; rate_max: number; source_url: string };
      if (!data.rate_min || !data.rate_max) continue;

      await db
        .from("rates")
        .update({
          rate_min: data.rate_min,
          rate_max: data.rate_max,
          source_url: data.source_url || null,
          updated_at: new Date().toISOString(),
        })
        .eq("category", bq.category)
        .eq("item", bq.item);

      updated.push(bq.item);
    } catch {
      // Skip failed items — don't fail the whole cron
    }
  }

  return NextResponse.json({ ok: true, updated, timestamp: new Date().toISOString() });
}
