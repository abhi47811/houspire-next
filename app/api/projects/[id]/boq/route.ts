import { NextRequest, NextResponse } from "next/server";
import { getSupabaseClient } from "@/lib/supabase";
import type { BOQRow } from "@/lib/types";

export async function PUT(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const { rows }: { rows: BOQRow[] } = await req.json();

  const db = getSupabaseClient();
  // Delete existing rows and reinsert edited ones
  await db.from("boq_rows").delete().eq("project_id", id);
  if (rows.length > 0) {
    await db.from("boq_rows").insert(
      rows.map((r) => ({ project_id: id, ...r })),
    );
  }
  return NextResponse.json({ ok: true, count: rows.length });
}
