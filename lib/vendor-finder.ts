import { getAnthropicClient } from "./anthropic";
import { getSupabaseClient } from "./supabase";
import type { VendorRow, RoomAnalysis } from "./types";

async function fetchVendorsFromDB(city: string): Promise<VendorRow[]> {
  try {
    const db = getSupabaseClient();
    const { data } = await db
      .from("vendors_db")
      .select("*")
      .eq("city", city)
      .order("category")
      .limit(50);
    if (!data || data.length === 0) return [];
    return (data as Array<{
      category: string; vendor: string; specialty: string;
      area: string; lat: number; lng: number; rating: string; phone: string;
    }>).map((v) => ({
      category: v.category,
      vendor: v.vendor,
      specialty: v.specialty || "",
      area: v.area || "",
      lat: v.lat || 0,
      lng: v.lng || 0,
      rating: v.rating || "",
      phone: v.phone || "",
    }));
  } catch {
    return [];
  }
}

const VENDOR_SYSTEM_PROMPT = `You are the Houspire Vendor Research specialist. Find real, Google-verified local vendors for interior projects.

NON-NEGOTIABLE RULES:
- NEVER fabricate vendor names, phones, ratings, review counts, or addresses.
- Only include vendors verified via live web/Google Maps search.
- No published phone → write: NA - visit showroom
- NEVER include competitors: Livspace, Artifex, Fabulous Decor, Hipcouch, Urban Company.
- Sort nearest-first within each category.
- 3-5 vendors per category. Extend to 15 km if < 3 within 10 km.

OUTPUT — exactly two sections, pipe-separated:

=== VENDOR TABLE ===
Category|Vendor|Specialty / Brands|Area|lat|lng|Rating (count)|Phone

=== NOTES ===
[structured notes]`;

function buildVendorPrompt(rooms: RoomAnalysis[], city: string, pincode: string, tier: string) {
  const roomDesc = rooms.map((r) => `- ${r.room_type}: ${r.design_elements}`).join("\n");
  return `Find real, Google-verified local vendors for this Houspire project.

PROJECT: City: ${city} | Pincode: ${pincode} | Tier: ${tier}

ROOM DESCRIPTIONS:
${roomDesc}

Search Google Maps for vendors within 10 km of pincode ${pincode} in ${city}.
For each category: flooring, carpentry/wardrobe, electrical, lighting/fans, hardware, HVAC, painting, soft furnishings.
Verify each vendor. Include rating+count, phone, area, lat/lng.

Return VENDOR TABLE and NOTES as specified.`;
}

function parseVendorResponse(text: string): { vendors: VendorRow[]; notes: string } {
  const vendors: VendorRow[] = [];
  let notes = "";

  const tblMatch = text.match(/=== VENDOR TABLE ===\n([\s\S]*?)(?:\n=== NOTES ===|$)/);
  const notesMatch = text.match(/=== NOTES ===\n([\s\S]*)$/);

  if (tblMatch) {
    for (const line of tblMatch[1].trim().split("\n")) {
      const parts = line.split("|").map((p) => p.trim());
      if (parts.length < 7 || parts[0] === "Category") continue;
      try {
        vendors.push({
          category: parts[0],
          vendor: parts[1],
          specialty: parts[2],
          area: parts[3],
          lat: parseFloat(parts[4]) || 0,
          lng: parseFloat(parts[5]) || 0,
          rating: parts[6] ?? "",
          phone: parts[7] ?? "",
        });
      } catch {
        continue;
      }
    }
  }

  if (notesMatch) notes = notesMatch[1].trim();
  return { vendors, notes };
}

export async function generateVendors(
  rooms: RoomAnalysis[],
  city: string,
  pincode: string,
  tier: string,
): Promise<{ vendors: VendorRow[]; notes: string }> {
  // Try DB first — return immediately if we have 3+ vendors per major category
  const dbVendors = await fetchVendorsFromDB(city);
  if (dbVendors.length >= 9) {
    // Group by category and check we have at least 3 in each
    const byCat = dbVendors.reduce<Record<string, number>>((acc, v) => {
      acc[v.category] = (acc[v.category] ?? 0) + 1;
      return acc;
    }, {});
    const categoriesWithEnough = Object.values(byCat).filter((n) => n >= 3).length;
    if (categoriesWithEnough >= 3) {
      return {
        vendors: dbVendors,
        notes: `Vendors sourced from Houspire verified database for ${city}. All vendors have been pre-verified. 3-5 vendors per category, nearest-first within each.`,
      };
    }
  }

  // Fall back to live web search
  const client = getAnthropicClient();
  const resp = await client.messages.create({
    model: "claude-sonnet-4-5",
    max_tokens: 8192,
    system: VENDOR_SYSTEM_PROMPT,
    tools: [{ type: "web_search_20250305" as const, name: "web_search" }],
    messages: [{ role: "user", content: buildVendorPrompt(rooms, city, pincode, tier) }],
  });
  const finalText = resp.content
    .filter((b) => b.type === "text")
    .map((b) => (b as { type: "text"; text: string }).text)
    .join("");
  return parseVendorResponse(finalText);
}
