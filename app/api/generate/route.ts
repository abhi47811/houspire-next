import { NextRequest, NextResponse } from "next/server";
import { generateBOQ } from "@/lib/boq-generator";
import { generateVendors } from "@/lib/vendor-finder";
import { saveProject } from "@/lib/db";
import type { RoomAnalysis } from "@/lib/types";

export async function POST(req: NextRequest) {
  const { rooms, city, pincode, tier, client_name }: {
    rooms: RoomAnalysis[];
    city: string;
    pincode: string;
    tier: string;
    client_name?: string;
  } = await req.json();

  const [boqResult, vendorResult] = await Promise.all([
    generateBOQ(rooms, city, pincode, tier),
    generateVendors(rooms, city, pincode, tier),
  ]);

  const projectId = await saveProject(
    client_name || rooms[0]?.image_filename?.split("_")[0] || "Project",
    city, pincode, tier,
    boqResult.rows, boqResult.sources,
    vendorResult.vendors, vendorResult.notes,
  );

  return NextResponse.json({
    boq_rows: boqResult.rows,
    rate_sources: boqResult.sources,
    vendors: vendorResult.vendors,
    notes: vendorResult.notes,
    project_id: projectId,
  });
}

export const maxDuration = 300;
