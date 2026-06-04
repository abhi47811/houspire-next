import { NextRequest, NextResponse } from "next/server";
import { getAnthropicClient } from "@/lib/anthropic";
import { getSupabaseClient } from "@/lib/supabase";

export const VENDOR_CATEGORIES = [
  "Vitrified Tiles & Flooring",
  "Engineered Wood Flooring",
  "Natural Stone & Marble",
  "Gypsum & False Ceiling",
  "Modular Kitchen",
  "Modular Wardrobe & Carpentry",
  "Doors & Windows",
  "Electrical Materials & Switches",
  "Home Automation & Smart Switches",
  "Decorative Lighting",
  "LED & Technical Lighting",
  "Ceiling Fans",
  "Air Conditioning & HVAC",
  "CP Fittings & Taps",
  "Sanitaryware",
  "Paint & Primers",
  "Wallpaper & Wall Treatments",
  "Cabinet Hardware & Fittings",
  "Glass & Mirrors",
  "Stone Countertops & Fabrication",
  "Furniture & Seating",
  "Curtains & Blinds",
  "Rugs & Soft Furnishings",
  "Security & CCTV",
  "Interior Contractors",
];

// City zones to search within — ensures city-wide coverage for pincode-based filtering
export const CITY_ZONES: Record<string, string[]> = {
  "Hyderabad": ["Banjara Hills", "Jubilee Hills", "Kondapur", "Kukatpally", "Secunderabad", "Dilsukhnagar", "LB Nagar", "Uppal"],
  "Bangalore": ["Indiranagar", "Koramangala", "Whitefield", "Jayanagar", "Malleswaram", "HSR Layout", "Yelahanka", "JP Nagar"],
  "Mumbai": ["Andheri West", "Bandra", "Thane", "Borivali", "Chembur", "Mulund", "Goregaon", "Powai"],
  "Delhi": ["Lajpat Nagar", "Karol Bagh", "Dwarka", "Rohini", "Janakpuri", "Saket", "Vasant Kunj", "Preet Vihar"],
  "Gurgaon": ["DLF Phase 1", "Sector 14", "Sohna Road", "Golf Course Road", "Palam Vihar", "Sector 56"],
  "Noida": ["Sector 18", "Sector 63", "Sector 50", "Sector 137", "Sector 62", "Greater Noida"],
  "Pune": ["Baner", "Viman Nagar", "Kothrud", "Aundh", "Deccan", "Hadapsar", "Wakad", "Hinjewadi"],
  "Chennai": ["T Nagar", "Anna Nagar", "Adyar", "Nungambakkam", "Velachery", "Porur", "Tambaram", "Sholinganallur"],
  "Kolkata": ["Salt Lake", "Ballygunge", "Gariahat", "New Town", "Behala", "Dum Dum", "Tollygunge"],
  "Ahmedabad": ["CG Road", "SG Highway", "Vastrapur", "Navrangpura", "Satellite", "Bodakdev", "Thaltej"],
};

const DEFAULT_ZONES = ["Central", "North", "South", "East", "West", "New Area"];

function getSearchTerms(category: string): string[] {
  const terms: Record<string, string[]> = {
    "Vitrified Tiles & Flooring": ["tile dealer", "Kajaria tiles", "Somany tiles", "vitrified tiles showroom", "flooring shop"],
    "Engineered Wood Flooring": ["engineered wood flooring", "Mikasa flooring", "laminate flooring dealer", "wooden flooring"],
    "Natural Stone & Marble": ["marble dealer", "granite supplier", "natural stone", "marble flooring"],
    "Gypsum & False Ceiling": ["gypsum contractor", "false ceiling contractor", "POP ceiling", "drywall contractor", "gypsum board"],
    "Modular Kitchen": ["modular kitchen", "kitchen cabinet dealer", "kitchen design", "Sleek kitchen dealer", "Hettich kitchen"],
    "Modular Wardrobe & Carpentry": ["modular wardrobe", "interior carpenter", "wardrobe manufacturer", "carpenter interiors", "custom furniture"],
    "Doors & Windows": ["UPVC windows", "door manufacturer", "wooden door dealer", "window dealer", "flush door"],
    "Electrical Materials & Switches": ["electrical shop", "Legrand dealer", "Havells dealer", "Polycab dealer", "electrical hardware"],
    "Home Automation & Smart Switches": ["home automation", "smart switch dealer", "Schneider Electric", "Legrand Arteor", "smart home"],
    "Decorative Lighting": ["decorative lighting", "chandelier shop", "pendant light", "designer lights", "lighting showroom"],
    "LED & Technical Lighting": ["LED lighting dealer", "Philips lighting", "Syska LED", "downlight dealer", "LED strip lights"],
    "Ceiling Fans": ["ceiling fan dealer", "Atomberg fan", "Havells fan dealer", "Orient fan dealer", "BLDC fan"],
    "Air Conditioning & HVAC": ["AC dealer", "Daikin dealer", "Mitsubishi AC", "Blue Star AC", "split AC dealer", "air conditioner"],
    "CP Fittings & Taps": ["Jaquar dealer", "bathroom fittings", "CP fittings", "tap dealer", "Grohe dealer", "Kohler faucet"],
    "Sanitaryware": ["sanitaryware dealer", "Hindware dealer", "Parryware", "WC dealer", "bathroom fixtures", "wash basin"],
    "Paint & Primers": ["Asian Paints dealer", "Berger paints dealer", "paint shop", "Dulux dealer", "Nerolac dealer"],
    "Wallpaper & Wall Treatments": ["wallpaper dealer", "wall texture", "D Decor wallpaper", "wall covering", "3D wallpaper"],
    "Cabinet Hardware & Fittings": ["Hettich dealer", "Hafele dealer", "cabinet hardware", "drawer slides dealer", "Ebco hardware"],
    "Glass & Mirrors": ["glass dealer", "mirror supplier", "toughened glass", "glass partition", "frameless glass"],
    "Stone Countertops & Fabrication": ["quartz countertop", "granite fabricator", "stone countertop", "Silestone dealer", "kitchen slab"],
    "Furniture & Seating": ["Godrej Interio", "Durian furniture", "furniture showroom", "sofa shop", "bedroom furniture"],
    "Curtains & Blinds": ["curtain shop", "D Decor dealer", "roller blinds", "curtain manufacturer", "window blinds"],
    "Rugs & Soft Furnishings": ["carpet shop", "rug dealer", "soft furnishings", "cushion cover", "home textile"],
    "Security & CCTV": ["CCTV dealer", "CP Plus dealer", "security camera", "Hikvision dealer", "home security"],
    "Interior Contractors": ["interior designer", "turnkey interior contractor", "home interior", "interior works", "renovation contractor"],
  };
  return terms[category] || [category.toLowerCase()];
}

const SEARCH_PROMPT = (city: string, zone: string, category: string, searchTerms: string[]) => `
Search Justdial.com for businesses in ${zone}, ${city} specializing in: ${category}

Step 1 — Search Justdial with these queries:
${searchTerms.map(t => `- site:justdial.com "${t}" "${zone}" "${city}"`).join("\n")}

Step 2 — For each business found, OPEN the Justdial listing page and extract:
1. Business name (exact as listed)
2. FULL ADDRESS — this is ALWAYS visible on the listing page without login
   Example: "Door No 8-2-502/1/0, Road No 7, Banjara Hills, Hyderabad-500034"
   The address appears in the Contact section on the right side of the listing
3. Rating and review count (e.g. "4.0 (354 Ratings)")
4. Phone number if shown without clicking (some listings show it directly)
5. What they sell/specialty (from Products section or description)

DO NOT store Justdial URLs — extract the REAL address from each listing page.
DO NOT invent or guess addresses — only use what you read from the listing.

Find 5-8 real businesses. Return ONLY this JSON array:
[
  {
    "vendor": "Kajaria Ceramics Ltd",
    "specialty": "Vitrified tiles, ceramic tiles, Kajaria brand dealer",
    "full_address": "Door No 8-2-502/1/0, Uma Aishwarya House, Below Gemini TV Office, Road No 7, Ag Road, Banjara Hills, Hyderabad-500034",
    "area": "${zone}, ${city}",
    "rating": "4.0 (354)",
    "contact": "+91 XXXXX XXXXX or NA"
  }
]`;

function isAuthorized(req: NextRequest): boolean {
  const headerKey = req.headers.get("x-admin-key");
  const queryKey = req.nextUrl.searchParams.get("key");
  return headerKey === "houspire-admin-2026" || queryKey === "houspire-admin-2026";
}

// Free geocoding via OpenStreetMap Nominatim — no API key needed
async function geocode(address: string, city: string): Promise<{ lat: number; lng: number } | null> {
  try {
    const query = `${address}, ${city}, India`;
    const url = `https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(query)}&format=json&limit=1&countrycodes=in`;
    const res = await fetch(url, {
      headers: { "User-Agent": "HouspireApp/1.0 (mediashaastra@gmail.com)" },
    });
    const data = await res.json() as Array<{ lat: string; lon: string }>;
    if (data[0]) return { lat: parseFloat(data[0].lat), lng: parseFloat(data[0].lon) };
    // Fallback: geocode just the zone+city
    const fallbackUrl = `https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(`${city}, India`)}&format=json&limit=1&countrycodes=in`;
    const fallbackRes = await fetch(fallbackUrl, { headers: { "User-Agent": "HouspireApp/1.0" } });
    const fallbackData = await fallbackRes.json() as Array<{ lat: string; lon: string }>;
    if (fallbackData[0]) return { lat: parseFloat(fallbackData[0].lat), lng: parseFloat(fallbackData[0].lon) };
    return null;
  } catch {
    return null;
  }
}

// Sleep helper for Nominatim rate limit (1 req/sec)
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

// POST: seed one specific city+category combination (one zone at a time)
export async function POST(req: NextRequest) {
  if (!isAuthorized(req)) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { city, category, zone } = await req.json() as { city: string; category: string; zone?: string };
  if (!city || !category) return NextResponse.json({ error: "city and category required" }, { status: 400 });

  const client = getAnthropicClient();
  const db = getSupabaseClient();
  const searchZone = zone || city;
  const searchTerms = getSearchTerms(category);

  try {
    const resp = await client.messages.create({
      model: "claude-sonnet-4-5",
      max_tokens: 3000,
      tools: [{ type: "web_search_20250305" as const, name: "web_search" }],
      messages: [{ role: "user", content: SEARCH_PROMPT(city, searchZone, category, searchTerms) }],
    });

    const text = resp.content
      .filter((b) => b.type === "text")
      .map((b) => (b as { type: "text"; text: string }).text)
      .join("");

    const jsonMatch = text.match(/\[[\s\S]*\]/);
    if (!jsonMatch) return NextResponse.json({ error: "No JSON array in response", raw: text.slice(0, 300) }, { status: 422 });

    const vendors = JSON.parse(jsonMatch[0]) as Array<{
      vendor: string; specialty: string; full_address?: string; area: string;
      rating: string; contact: string;
    }>;

    if (!Array.isArray(vendors) || vendors.length === 0) {
      return NextResponse.json({ error: "No vendors parsed", zone: searchZone }, { status: 422 });
    }

    // Geocode each vendor using full_address → Nominatim (free, 1 req/sec limit)
    const rows = [];
    for (const v of vendors) {
      const addressForGeocoding = v.full_address || v.area || `${searchZone}, ${city}`;
      const coords = await geocode(addressForGeocoding, city);
      await sleep(1100); // Nominatim rate limit: 1 req/sec

      rows.push({
        city, category,
        vendor: v.vendor,
        specialty: v.specialty,
        area: v.full_address || v.area || `${searchZone}, ${city}`,
        lat: coords?.lat || null,
        lng: coords?.lng || null,
        rating: v.rating || "Unverified",
        phone: v.contact || "See Justdial",
        is_verified: false,
        data_source: `justdial_nominatim_${Date.now()}`,
        verified_at: null,
      });
    }

    const { error } = await db.from("vendors_db").insert(rows);
    if (error) throw error;

    return NextResponse.json({
      ok: true, city, category, zone: searchZone, inserted: rows.length,
      vendors: rows.map((r) => ({ vendor: r.vendor, phone: r.phone, rating: r.rating, area: r.area })),
    });
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}

// GET: return available zones for a city + categories list
export async function GET(req: NextRequest) {
  if (!isAuthorized(req)) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const city = req.nextUrl.searchParams.get("city") || "";
  const zones = CITY_ZONES[city] || DEFAULT_ZONES;

  return NextResponse.json({ city, zones, categories: VENDOR_CATEGORIES });
}

export const maxDuration = 300;
