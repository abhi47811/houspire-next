import { NextRequest, NextResponse } from "next/server";
import { loadProject } from "@/lib/db";

export async function GET(req: NextRequest) {
  const id = req.nextUrl.searchParams.get("id");
  if (!id) return NextResponse.json({ error: "Missing id" }, { status: 400 });

  const data = await loadProject(id);
  if (!data.project) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const errors: Array<{ row: number; category: string; description: string; qty: number; rate: number; expected: number }> = [];

  data.boq_rows.forEach((row, i) => {
    const expected = Math.round(row.qty * row.rate * 100) / 100;
    // We verify qty and rate are valid numbers (amount is computed by Excel formula)
    if (isNaN(row.qty) || row.qty <= 0) {
      errors.push({ row: i + 2, category: row.category, description: row.description, qty: row.qty, rate: row.rate, expected });
    }
    if (isNaN(row.rate) || row.rate <= 0) {
      errors.push({ row: i + 2, category: row.category, description: row.description, qty: row.qty, rate: row.rate, expected });
    }
  });

  return NextResponse.json({
    project_id: id,
    total_rows: data.boq_rows.length,
    errors,
    ok: errors.length === 0,
  });
}
