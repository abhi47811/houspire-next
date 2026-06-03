import * as XLSX from "xlsx";
import type { BOQRow, RateSource, VendorRow } from "./types";

const BOQ_COL_WIDTHS = [16, 26, 11, 11, 11, 16];
const VENDOR_COL_WIDTHS = [18, 28, 35, 25, 12, 12, 20, 35];

export function generateBOQExcel(
  clientName: string,
  city: string,
  tier: string,
  rows: BOQRow[],
  sources: RateSource[],
): Buffer {
  const wb = XLSX.utils.book_new();

  // BOQ sheet only — no Rate Sources sheet
  const boqData = [
    ["Category", "Description", "Unit", "Quantity", "Rate", "Amount (Auto-calculated)"],
    ...rows.map((r, i) => [r.category, r.description, r.unit, r.qty, r.rate, { f: `D${i + 2}*E${i + 2}` }]),
  ];
  const ws1 = XLSX.utils.aoa_to_sheet(boqData);
  ws1["!cols"] = BOQ_COL_WIDTHS.map((w) => ({ wch: w }));
  XLSX.utils.book_append_sheet(wb, ws1, "BOQ Template");

  return XLSX.write(wb, { type: "buffer", bookType: "xlsx" }) as Buffer;
}

function km(lat: number, lng: number, lat0: number, lng0: number) {
  const dlat = (lat - lat0) * 111.0;
  const dlng = (lng - lng0) * 111.0 * Math.cos((lat0 * Math.PI) / 180);
  return Math.round(Math.sqrt(dlat ** 2 + dlng ** 2) * 10) / 10;
}

export function generateVendorExcel(
  clientName: string,
  city: string,
  pincode: string,
  vendors: VendorRow[],
  notes: string,
): Buffer {
  const wb = XLSX.utils.book_new();

  const lat0 = vendors.find((v) => v.lat)?.lat ?? 0;
  const lng0 = vendors.find((v) => v.lng)?.lng ?? 0;

  const today = new Date().toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" });

  const headers = [
    "Category",
    "Vendor Name",
    "Specialty / Brands",
    "Area / Locality",
    "Distance (km)",
    "Google Rating",
    "Contact",
    "Verification Status",
  ];

  // Title rows + blank + headers + data
  const vendorData = [
    ["HOUSPIRE — Verified Local Vendor Directory"],
    [`City: ${city} | Pincode: ${pincode} | Generated: ${today}`],
    [""],
    headers,
    ...vendors.map((v) => [
      v.category,
      v.vendor,
      v.specialty,
      v.area,
      v.lat && v.lng ? km(v.lat, v.lng, lat0, lng0) : "",
      v.rating,
      v.phone,
      "⚠ Verify contact on Google Maps before use",
    ]),
  ];

  const ws = XLSX.utils.aoa_to_sheet(vendorData);
  ws["!cols"] = VENDOR_COL_WIDTHS.map((w) => ({ wch: w }));
  // Freeze at row 5 (after 3 title rows + 1 header row)
  ws["!freeze"] = { xSplit: 0, ySplit: 4 };
  XLSX.utils.book_append_sheet(wb, ws, "Vendors");

  const notesData = notes.split("\n").map((line) => [line]);
  const wsNotes = XLSX.utils.aoa_to_sheet(notesData);
  wsNotes["!cols"] = [{ wch: 120 }];
  XLSX.utils.book_append_sheet(wb, wsNotes, "Notes");

  return XLSX.write(wb, { type: "buffer", bookType: "xlsx" }) as Buffer;
}
