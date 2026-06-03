import { NextRequest, NextResponse } from "next/server";
import { generateBOQ } from "@/lib/boq-generator";
import { generateVendors } from "@/lib/vendor-finder";
import { saveProject } from "@/lib/db";
import type { RoomAnalysis } from "@/lib/types";

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
