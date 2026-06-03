import { NextRequest, NextResponse } from "next/server";
import { analyzeAllRenders, analyzeFloorPlan } from "@/lib/room-analyzer";

export async function POST(req: NextRequest) {
  const formData = await req.formData();
  const files = formData.getAll("images") as File[];
  const floorPlanFile = formData.get("floorplan") as File | null;

  // Step 1: Analyze floor plan if provided
  let floorPlanRooms: Array<{room_type: string; estimated_sqft: number; length_ft?: number; width_ft?: number}> = [];
  if (floorPlanFile) {
    const bytes = await floorPlanFile.arrayBuffer();
    const base64 = Buffer.from(bytes).toString("base64");
    floorPlanRooms = await analyzeFloorPlan(base64, floorPlanFile.type || "image/jpeg");
  }

  // Step 2: Analyze renders (for design elements)
  const images = await Promise.all(
    files.map(async (file) => ({
      base64: Buffer.from(await file.arrayBuffer()).toString("base64"),
      mediaType: file.type || "image/jpeg",
      filename: file.name,
    }))
  );
  const rooms = images.length > 0 ? await analyzeAllRenders(images) : [];

  return NextResponse.json({ rooms, floorPlanRooms });
}
