import { NextRequest, NextResponse } from "next/server";
import { getSupabaseClient } from "@/lib/supabase";

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const { vendor_name, category } = await req.json() as { vendor_name: string; category: string };

  const db = getSupabaseClient();
  const { error } = await db.from("vendor_shortlist").insert({
    project_id: id,
    vendor_name,
    category,
  });

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
  return NextResponse.json({ ok: true });
}

export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const { vendor_name } = await req.json() as { vendor_name: string };

  const db = getSupabaseClient();
  await db.from("vendor_shortlist")
    .delete()
    .eq("project_id", id)
    .eq("vendor_name", vendor_name);

  return NextResponse.json({ ok: true });
}
