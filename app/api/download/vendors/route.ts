import { NextRequest, NextResponse } from "next/server";
import { loadProject } from "@/lib/db";
import { generateVendorExcel } from "@/lib/excel-generator";

export async function GET(req: NextRequest) {
  const id = req.nextUrl.searchParams.get("id");
  if (!id) return NextResponse.json({ error: "Missing id" }, { status: 400 });

  const data = await loadProject(id);
  if (!data.project) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const p = data.project as { client_name: string; city: string; pincode: string };
  const buf = generateVendorExcel(p.client_name, p.city, p.pincode, data.vendors, data.notes);
  const safe = p.client_name.replace(/[^A-Za-z0-9]/g, "_");
  return new NextResponse(new Uint8Array(buf), {
    headers: {
      "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "Content-Disposition": `attachment; filename="${p.city}_${safe}_Vendors_${p.pincode}.xlsx"`,
    },
  });
}
