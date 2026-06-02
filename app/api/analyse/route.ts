import { NextRequest, NextResponse } from "next/server";
import { analyzeAllRenders } from "@/lib/room-analyzer";

export async function POST(req: NextRequest) {
  const formData = await req.formData();
  const files = formData.getAll("images") as File[];

  const images = await Promise.all(
    files.map(async (file) => {
      const bytes = await file.arrayBuffer();
      return {
        base64: Buffer.from(bytes).toString("base64"),
        mediaType: file.type || "image/jpeg",
        filename: file.name,
      };
    }),
  );

  const results = await analyzeAllRenders(images);
  return NextResponse.json(results);
}
