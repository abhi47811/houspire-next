import { NextRequest, NextResponse } from "next/server";
import { getSupabaseClient } from "@/lib/supabase";
import { requireUser } from "@/lib/supabase-server";

export async function PUT(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const authError = await requireUser();
  if (authError) return authError;
  const { id } = await params;
  const body = await req.json() as { actual_total_inr: number };
  const db = getSupabaseClient();
  const { error } = await db
    .from("projects")
    .update({ actual_total_inr: body.actual_total_inr })
    .eq("id", id);
  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
  return NextResponse.json({ ok: true });
}
