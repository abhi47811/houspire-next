import { NextRequest, NextResponse } from "next/server";
import { getSupabaseClient } from "@/lib/supabase";

export async function POST(req: NextRequest) {
  const { project_id, contractor_name, company_name, line_item_quotes } = await req.json();
  const db = getSupabaseClient();
  const { error } = await db
    .from("contractor_quotes")
    .insert({ project_id, contractor_name, company_name, line_item_quotes });
  if (error) return NextResponse.json({ ok: false, error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}
