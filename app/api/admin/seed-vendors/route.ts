import { NextRequest, NextResponse } from "next/server";
import { getAnthropicClient } from "@/lib/anthropic";
import { getSupabaseClient } from "@/lib/supabase";

const CATEGORIES = [
  "Flooring",
  "Carpentry / Wardrobe",
  "Electrical",
  "Lighting / Fans",
  "Hardware",
  "HVAC",
  "Painting",
];

const SEARCH_PROMPT = (city: string, category: string, pincode?: string) => `
Search Justdial, Sulekha, and IndiaMART for REAL vendors in ${city}${pincode ? ` near ${pincode}` : ""} for: ${category}

These directories have real Indian business phone numbers. Search:
1. justdial.com — search "${category} ${city}" and click listings to get phone
2. sulekha.com — search "${category} services ${city}"
3. indiamart.com — search "${category} dealers ${city}"

Specific search terms for ${category}:
- Flooring: "tile dealers ${city}", "Kajaria tiles ${city} justdial", "vitrified tile showroom ${city}"
- Carpentry / Wardrobe: "modular wardrobe ${city} justdial", "interior carpenter ${city}", "wardrobe manufacturer ${city}"
- Electrical: "Legrand dealer ${city}", "electrical shop ${city} justdial", "switches sockets ${city}"
- Lighting / Fans: "Atomberg fan dealer ${city}", "LED lights ${city} justdial", "ceiling fan dealer ${city}"
- Hardware: "Hettich dealer ${city}", "cabinet hardware ${city}", "furniture fittings ${city}"
- HVAC: "Daikin AC dealer ${city} justdial", "air conditioner dealer ${city}", "AC service center ${city}"
- Painting: "Asian Paints dealer ${city} justdial", "paint shop ${city}", "Berger paints ${city}"
- Furniture: "Godrej Interio ${city}", "furniture showroom ${city} justdial", "sofa set ${city}"
- Bathroom Fixtures: "Jaquar dealer ${city} justdial", "bathroom fittings ${city}", "sanitaryware ${city}"
- Soft Furnishings: "curtain shop ${city} justdial", "D Decor ${city}", "blinds curtains ${city}"

Find 3-5 vendors. For EACH vendor extract from Justdial/Sulekha listing:
- Real business name (as listed)
- Locality/area (as listed)
- Phone number (directly from listing — Justdial shows numbers after click)
- Rating and review count if shown
- Full address for lat/lng estimation

STRICT RULES:
- ONLY businesses from actual Justdial/Sulekha/IndiaMART listings
- Phone format: "+91 XXXXX XXXXX" — use actual number from listing
- If phone hidden behind login, write "NA - check justdial.com"
- Never invent or guess phone numbers
- If < 3 businesses found, note that in the JSON

Return ONLY this JSON array, no other text:
[
  {
    "vendor": "exact business name from Google Maps",
    "specialty": "what they sell/specialize in",
    "area": "locality, city (pincode if found)",
    "lat": 0.0,
    "lng": 0.0,
    "rating": "4.5 (230)",
    "phone": "+91 XXXXX XXXXX or NA - visit showroom"
  }
]
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

  const { city, category, pincode } = await req.json();

  if (!city || !category) {
    return NextResponse.json({ error: "city and category required" }, { status: 400 });
  }

  const client = getAnthropicClient();
  const db = getSupabaseClient();

  try {
    const resp = await client.messages.create({
      model: "claude-sonnet-4-5",
      max_tokens: 2048,
      tools: [{ type: "web_search_20250305" as const, name: "web_search" }],
      messages: [{
        role: "user",
        content: SEARCH_PROMPT(city, category, pincode),
      }],
    });

    const text = resp.content
      .filter((b) => b.type === "text")
      .map((b) => (b as { type: "text"; text: string }).text)
      .join("");

    // Extract JSON array from response
    const jsonMatch = text.match(/\[[\s\S]*\]/);
    if (!jsonMatch) {
      return NextResponse.json({ error: "No JSON found in response", raw: text.slice(0, 500) }, { status: 422 });
    }

    const vendors = JSON.parse(jsonMatch[0]) as Array<{
      vendor: string; specialty: string; area: string;
      lat: number; lng: number; rating: string; phone: string;
    }>;

    if (!Array.isArray(vendors) || vendors.length === 0) {
      return NextResponse.json({ error: "No vendors parsed" }, { status: 422 });
    }

    // Delete old unverified rows for this city+category, insert real ones
    await db.from("vendors_db")
      .delete()
      .eq("city", city)
      .eq("category", category)
      .eq("is_verified", false);

    const rows = vendors.map((v) => ({
      city,
      category,
      vendor: v.vendor,
      specialty: v.specialty,
      area: v.area,
      lat: v.lat || null,
      lng: v.lng || null,
      rating: v.rating,
      phone: v.phone,
      is_verified: true,
      data_source: "web_search_claude",
      verified_at: new Date().toISOString(),
    }));

    const { error } = await db.from("vendors_db").insert(rows);
    if (error) throw error;

    return NextResponse.json({
      ok: true,
      city,
      category,
      inserted: rows.length,
      vendors: rows.map((r) => ({ vendor: r.vendor, phone: r.phone, rating: r.rating })),
    });
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}

// GET: run for all categories in a city
export async function GET(req: NextRequest) {
  if (!isAuthorized(req)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const city = req.nextUrl.searchParams.get("city");
  const pincode = req.nextUrl.searchParams.get("pincode") ?? undefined;

  if (!city) return NextResponse.json({ error: "city required" }, { status: 400 });

  const results: Array<{ category: string; inserted: number; error?: string }> = [];

  for (const category of CATEGORIES) {
    try {
      const resp = await fetch(`${req.nextUrl.origin}/api/admin/seed-vendors`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ city, category, pincode }),
      });
      const data = await resp.json() as { inserted?: number; error?: string };
      results.push({ category, inserted: data.inserted ?? 0, error: data.error });
    } catch (e) {
      results.push({ category, inserted: 0, error: String(e) });
    }
  }

  return NextResponse.json({ city, results });
}

export const maxDuration = 300;
