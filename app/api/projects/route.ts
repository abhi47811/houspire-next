import { NextRequest, NextResponse } from "next/server";
import { listProjects, deleteProject } from "@/lib/db";

export async function GET() {
  const projects = await listProjects();
  return NextResponse.json(projects);
}

export async function DELETE(req: NextRequest) {
  const id = req.nextUrl.searchParams.get("id");
  if (!id) return NextResponse.json({ error: "Missing id" }, { status: 400 });
  await deleteProject(id);
  return NextResponse.json({ ok: true });
}
