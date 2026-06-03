import { NextRequest, NextResponse } from "next/server";
import { loadProject } from "@/lib/db";
import { renderToBuffer, Document, Page, Text, View, StyleSheet, Font } from "@react-pdf/renderer";
import type { BOQRow } from "@/lib/types";

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

const COL_WIDTHS = { cat: "15%", desc: "42%", unit: "8%", qty: "8%", rate: "12%", amount: "15%" };

async function buildPDF(
  clientName: string, city: string, tier: string,
  rows: BOQRow[],
): Promise<Buffer> {
  const total = rows.reduce((s, r) => s + r.qty * r.rate, 0);
  const w = COL_WIDTHS;

  const doc = (
    <Document>
      {/* Cover Page */}
      <Page size="A4" style={styles.page}>
        <View style={styles.cover}>
          <Text style={styles.coverTitle}>HOUSPIRE</Text>
          <Text style={styles.coverSub}>Design. Deliver. Delight.</Text>
          <View style={styles.divider} />
          <Text style={styles.coverDoc}>BILL OF QUANTITIES</Text>
          <Text style={styles.coverDetail}>{clientName} · {city} · {tier}</Text>
          <Text style={[styles.coverDetail, { marginTop: 4, color: "#888", fontSize: 9 }]}>{rows.length} line items · 2025-26 rates</Text>
        </View>
        <View style={styles.footer}>
          <Text style={styles.footerText}>www.houspire.ai · Houspire BOQ | {clientName} | Confidential</Text>
        </View>
      </Page>

      {/* BOQ Table Page */}
      <Page size="A4" style={styles.page}>
        <Text style={styles.sectionTitle}>Bill of Quantities</Text>
        <View style={styles.tableHeader}>
          <Text style={[styles.tableHeaderCell, { width: w.cat }]}>Category</Text>
          <Text style={[styles.tableHeaderCell, { width: w.desc }]}>Description</Text>
          <Text style={[styles.tableHeaderCell, { width: w.unit }]}>Unit</Text>
          <Text style={[styles.tableHeaderCell, { width: w.qty, textAlign: "right" }]}>Qty</Text>
          <Text style={[styles.tableHeaderCell, { width: w.rate, textAlign: "right" }]}>Rate (₹)</Text>
          <Text style={[styles.tableHeaderCell, { width: w.amount, textAlign: "right" }]}>Amount (₹)</Text>
        </View>
        {rows.map((r, i) => (
          <View key={i} style={i % 2 === 0 ? styles.tableRow : styles.tableRowAlt} wrap={false}>
            <Text style={[styles.cell, { width: w.cat, color: "#666" }]}>{r.category}</Text>
            <Text style={[styles.cell, { width: w.desc }]}>{r.description}</Text>
            <Text style={[styles.cell, { width: w.unit, textAlign: "center" }]}>{r.unit}</Text>
            <Text style={[styles.cell, { width: w.qty, textAlign: "right" }]}>{r.qty}</Text>
            <Text style={[styles.cell, { width: w.rate, textAlign: "right" }]}>{r.rate.toLocaleString("en-IN")}</Text>
            <Text style={[styles.cell, { width: w.amount, textAlign: "right", fontFamily: "Helvetica-Bold", color: BRAND_GREEN }]}>
              {(r.qty * r.rate).toLocaleString("en-IN")}
            </Text>
          </View>
        ))}
        <View style={{ marginTop: 12, alignItems: "flex-end" }}>
          <Text style={{ fontSize: 10, fontFamily: "Helvetica-Bold", color: BRAND_GREEN }}>
            Indicative Total: ₹{Math.round(total).toLocaleString("en-IN")}
          </Text>
        </View>

{/* Rate sources removed — internal use only */}

        <View style={styles.disclaimer}>
          <Text style={styles.disclaimerText}>
            Houspire operates on a flat-fee model. We do not earn commissions from any vendor, supplier, or brand mentioned in this document.
            All rates are indicative, researched for the {city} local market (2025-26), and must be confirmed with vendors before ordering.
            Room sizes are estimated from design renders and should be verified on-site before procurement.
          </Text>
        </View>

        <View style={styles.footer}>
          <Text style={styles.footerText}>www.houspire.ai</Text>
          <Text style={styles.footerText}>Houspire BOQ | {clientName} | Confidential</Text>
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

  const p = data.project as { client_name: string; city: string; tier: string };
  const safe = p.client_name.replace(/[^A-Za-z0-9]/g, "_");

  const buf = await buildPDF(p.client_name, p.city, p.tier, data.boq_rows);
  return new NextResponse(new Uint8Array(buf), {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `attachment; filename="Houspire_BOQ_${safe}_${p.city}.pdf"`,
    },
  });
}
