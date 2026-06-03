import { NextRequest, NextResponse } from "next/server";
import { loadProject } from "@/lib/db";
import { renderToBuffer, Document, Page, Text, View, StyleSheet } from "@react-pdf/renderer";
import type { VendorRow } from "@/lib/types";

const BRAND_GREEN = "#1B4D3E";
const BRAND_GOLD = "#D4AF37";
const BRAND_LIGHT = "#F5F0E8";

const styles = StyleSheet.create({
  page: { padding: 40, fontFamily: "Helvetica", backgroundColor: "#FFFFFF", fontSize: 9 },
  cover: { flex: 1, justifyContent: "center", alignItems: "center", backgroundColor: BRAND_LIGHT },
  coverTitle: { fontSize: 36, fontFamily: "Helvetica-Bold", color: BRAND_GREEN, letterSpacing: 4, marginBottom: 8 },
  coverSub: { fontSize: 14, color: BRAND_GOLD, marginBottom: 4 },
  coverDoc: { fontSize: 18, fontFamily: "Helvetica-Bold", color: BRAND_GREEN, marginTop: 24 },
  coverDetail: { fontSize: 11, color: "#555", marginTop: 6 },
  divider: { height: 2, backgroundColor: BRAND_GOLD, marginVertical: 16, width: "60%" },
  sectionTitle: { fontSize: 13, fontFamily: "Helvetica-Bold", color: BRAND_GREEN, marginTop: 20, marginBottom: 8 },
  tableHeader: { flexDirection: "row", backgroundColor: BRAND_GREEN, padding: 5 },
  tableHeaderCell: { color: "#FFFFFF", fontFamily: "Helvetica-Bold", fontSize: 8 },
  tableRow: { flexDirection: "row", padding: 4, borderBottomWidth: 0.5, borderBottomColor: "#DDD" },
  tableRowAlt: { flexDirection: "row", padding: 4, backgroundColor: "#F7F5F0", borderBottomWidth: 0.5, borderBottomColor: "#DDD" },
  cell: { fontSize: 7.5, color: "#333" },
  footer: { position: "absolute", bottom: 20, left: 40, right: 40, flexDirection: "row", justifyContent: "space-between" },
  footerText: { fontSize: 7, color: "#888" },
  disclaimer: { marginTop: 20, padding: 12, backgroundColor: BRAND_LIGHT, borderRadius: 4 },
  disclaimerText: { fontSize: 8, color: "#555", lineHeight: 1.5 },
});

const COL = { cat: "16%", vendor: "22%", specialty: "28%", area: "20%", phone: "14%" };

async function buildPDF(
  clientName: string, city: string, pincode: string,
  vendors: VendorRow[],
): Promise<Buffer> {
  const doc = (
    <Document>
      {/* Cover Page */}
      <Page size="A4" style={styles.page}>
        <View style={styles.cover}>
          <Text style={styles.coverTitle}>HOUSPIRE</Text>
          <Text style={styles.coverSub}>Design. Deliver. Delight.</Text>
          <View style={styles.divider} />
          <Text style={styles.coverDoc}>LOCAL VENDOR DIRECTORY</Text>
          <Text style={styles.coverDetail}>{clientName} · {city} · {pincode}</Text>
          <Text style={[styles.coverDetail, { marginTop: 4, color: "#888", fontSize: 9 }]}>{vendors.length} verified vendors · 2025-26</Text>
        </View>
        <View style={styles.footer}>
          <Text style={styles.footerText}>www.houspire.ai · Houspire Vendors | {clientName} | Confidential</Text>
        </View>
      </Page>

      {/* Vendor Table Page */}
      <Page size="A4" style={styles.page}>
        <Text style={styles.sectionTitle}>Local Vendor Directory — {city} ({pincode})</Text>
        <View style={styles.tableHeader}>
          <Text style={[styles.tableHeaderCell, { width: COL.cat }]}>Category</Text>
          <Text style={[styles.tableHeaderCell, { width: COL.vendor }]}>Vendor</Text>
          <Text style={[styles.tableHeaderCell, { width: COL.specialty }]}>Specialty / Brands</Text>
          <Text style={[styles.tableHeaderCell, { width: COL.area }]}>Area</Text>
          <Text style={[styles.tableHeaderCell, { width: COL.phone }]}>Phone</Text>
        </View>
        {vendors.map((v, i) => (
          <View key={i} style={i % 2 === 0 ? styles.tableRow : styles.tableRowAlt} wrap={false}>
            <Text style={[styles.cell, { width: COL.cat, color: "#666" }]}>{v.category}</Text>
            <Text style={[styles.cell, { width: COL.vendor, fontFamily: "Helvetica-Bold" }]}>{v.vendor}</Text>
            <Text style={[styles.cell, { width: COL.specialty, color: "#444" }]}>{v.specialty}</Text>
            <Text style={[styles.cell, { width: COL.area, color: "#555" }]}>{v.area}</Text>
            <Text style={[styles.cell, { width: COL.phone }]}>{v.phone}</Text>
          </View>
        ))}

        <View style={styles.disclaimer}>
          <Text style={styles.disclaimerText}>
            IMPORTANT: Vendor contact details are sourced from public listings and Google Maps at the time of report generation.
            Houspire does not guarantee accuracy of phone numbers, ratings, or availability. Always verify vendor credentials and
            obtain written quotes before committing to any purchase. Houspire earns no commission from any vendor listed here.
            Competitors (Livspace, Artifex, Urban Company, etc.) are excluded by policy.
          </Text>
        </View>

        <View style={styles.footer}>
          <Text style={styles.footerText}>www.houspire.ai</Text>
          <Text style={styles.footerText}>Houspire Vendors | {clientName} | Confidential</Text>
        </View>
      </Page>
    </Document>
  );

  return Buffer.from(await renderToBuffer(doc));
}

export async function GET(req: NextRequest) {
  const id = req.nextUrl.searchParams.get("id");
  if (!id) return NextResponse.json({ error: "Missing id" }, { status: 400 });

  const data = await loadProject(id);
  if (!data.project) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const p = data.project as { client_name: string; city: string; tier: string; pincode?: string };
  const safe = p.client_name.replace(/[^A-Za-z0-9]/g, "_");
  const pincode = p.pincode ?? "";

  const buf = await buildPDF(p.client_name, p.city, pincode, data.vendors ?? []);
  return new NextResponse(new Uint8Array(buf), {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `attachment; filename="Houspire_Vendors_${safe}_${p.city}.pdf"`,
    },
  });
}
