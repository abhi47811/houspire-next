import { NextRequest, NextResponse } from "next/server";
import { after } from "next/server";
import { CITY_ZONES } from "@/app/api/admin/seed-vendors/route";
import { generateBOQ } from "@/lib/boq-generator";
import { generateVendors } from "@/lib/vendor-finder";
import { saveProject } from "@/lib/db";
import { getSupabaseClient } from "@/lib/supabase";
import type { RoomAnalysis } from "@/lib/types";

// Priority categories to auto-seed when a new city is encountered
const PRIORITY_CATEGORIES = [
  "Vitrified Tiles & Flooring",
  "Modular Wardrobe & Carpentry",
  "Electrical Materials & Switches",
  "Air Conditioning & HVAC",
  "Paint & Primers",
];

async function autoSeedVendorsIfNeeded(city: string, baseUrl: string) {
  try {
    const db = getSupabaseClient();
    // Check if this city already has vendor data
    const { count } = await db
      .from("vendors_db")
      .select("id", { count: "exact", head: true })
      .eq("city", city)
      .eq("is_verified", true);

    if ((count ?? 0) >= 20) return; // Already has real vendor data

    // City has no real vendors — trigger background seeding for priority categories
    const zones = CITY_ZONES[city] ?? ["Central", "North", "South", "East"];
    const topZones = zones.slice(0, 3); // Seed top 3 zones per category

    for (const category of PRIORITY_CATEGORIES) {
      for (const zone of topZones) {
        await fetch(`${baseUrl}/api/admin/seed-vendors`, {
          method: "POST",
          headers: { "Content-Type": "application/json", "x-admin-key": "houspire-admin-2026" },
          body: JSON.stringify({ city, category, zone }),
        });
      }
    }
  } catch {
    // Background seeding failure is silent — don't affect main response
  }
}

export async function POST(req: NextRequest) {
  const { rooms, city, pincode, tier, client_name, includeGST }: {
    rooms: RoomAnalysis[];
    city: string;
    pincode: string;
    tier: string;
    client_name?: string;
    includeGST?: boolean;
  } = await req.json();

  const [boqResult, vendorResult] = await Promise.all([
    generateBOQ(rooms, city, pincode, tier),
    generateVendors(rooms, city, pincode, tier),
  ]);

  let boqRows = boqResult.rows;

  if (includeGST) {
    const subtotal = boqRows.reduce((s, r) => s + r.qty * r.rate, 0);
    boqRows = [
      ...boqRows,
      {
        category: "Tax",
        description: "GST @ 18%",
        unit: "lump",
        qty: 1,
        rate: Math.round(subtotal * 0.18),
        confidence: "high" as const,
      },
    ];
  }

  const projectId = await saveProject(
    client_name || rooms[0]?.image_filename?.split("_")[0] || "Project",
    city, pincode, tier,
    boqRows, boqResult.sources,
    vendorResult.vendors, vendorResult.notes,
  );

  // Run BOQ formula verification
  const boqErrors = boqRows.filter((r) => isNaN(r.qty) || r.qty <= 0 || isNaN(r.rate) || r.rate <= 0);

  // Auto-seed vendors for new cities after response is sent (non-blocking)
  const baseUrl = req.nextUrl.origin;
  after(() => autoSeedVendorsIfNeeded(city, baseUrl));

  return NextResponse.json({
    boq_rows: boqRows,
    rate_sources: boqResult.sources,
    vendors: vendorResult.vendors,
    notes: vendorResult.notes,
    project_id: projectId,
    verification: {
      total_rows: boqRows.length,
      errors: boqErrors.length,
      ok: boqErrors.length === 0,
    },
  });
}

export const maxDuration = 300;
