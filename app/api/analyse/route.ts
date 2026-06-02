import { NextRequest, NextResponse } from "next/server";
import { analyzeRender } from "@/lib/room-analyzer";

export async function POST(req: NextRequest) {
  const formData = await req.formData();
  const files = formData.getAll("images") as File[];

  const results = await Promise.all(
    files.map(async (file) => {
      const bytes = await file.arrayBuffer();
      const base64 = Buffer.from(bytes).toString("base64");
      const mediaType = file.type || "image/jpeg";
      return analyzeRender(base64, mediaType, file.name);
    }),
  );

  return NextResponse.json(results);
}
