import { NextRequest, NextResponse } from "next/server";
import { loadProject } from "@/lib/db";
import * as XLSX from "xlsx";

export async function GET(req: NextRequest) {
  const id = req.nextUrl.searchParams.get("id");
  const phase = req.nextUrl.searchParams.get("phase");

  if (!id || !phase) {
    return NextResponse.json({ error: "Missing params" }, { status: 400 });
  }

  const data = await loadProject(id);
  if (!data.project) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const p = data.project as { client_name: string; city: string };
  const rows = phase === "all"
    ? data.boq_rows
    : data.boq_rows.filter((r) => r.phase === phase);

  const wb = XLSX.utils.book_new();
  const wsData: (string | number)[][] = [
    [`Work Order — ${phase}`],
    [`Client: ${p.client_name} | City: ${p.city}`],
    [],
    ["Category", "Description", "Unit", "Qty", "Rate (₹)", "Amount (₹)"],
    ...rows.map((r) => [r.category, r.description, r.unit, r.qty, r.rate, r.qty * r.rate]),
  ];
  const ws = XLSX.utils.aoa_to_sheet(wsData);
  ws["!cols"] = [{ wch: 16 }, { wch: 40 }, { wch: 8 }, { wch: 8 }, { wch: 12 }, { wch: 14 }];
  XLSX.utils.book_append_sheet(wb, ws, "Work Order");

  const buf = XLSX.write(wb, { type: "buffer", bookType: "xlsx" }) as Buffer;
  const filename = `WorkOrder_${phase.replace(/[^a-z0-9]/gi, "_")}.xlsx`;

  return new NextResponse(new Uint8Array(buf), {
    headers: {
      "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "Content-Disposition": `attachment; filename="${filename}"`,
    },
  });
}
