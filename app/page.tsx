"use client";

import { useState, useRef } from "react";
import { CITIES, CITIES_WITH_MULTIPLIERS, TIERS, ROOM_TYPES } from "@/lib/config";
import type { RoomAnalysis, BOQRow, VendorRow } from "@/lib/types";

export default function HomePage() {
  const [clientName, setClientName] = useState("");
  const [city, setCity] = useState("Hyderabad");
  const [pincode, setPincode] = useState("");
  const [tier, setTier] = useState<"Mid-tier" | "Premium">("Mid-tier");

  const [files, setFiles] = useState<File[]>([]);
  const [floorPlan, setFloorPlan] = useState<File | null>(null);
  const [analyses, setAnalyses] = useState<RoomAnalysis[]>([]);
  const [editedAnalyses, setEditedAnalyses] = useState<RoomAnalysis[]>([]);

  const [outputFormat, setOutputFormat] = useState<"excel" | "branded">("excel");

  const [status, setStatus] = useState("");
  const [projectId, setProjectId] = useState<string | null>(null);
  const [boqRows, setBoqRows] = useState<BOQRow[]>([]);
  const [vendors, setVendors] = useState<VendorRow[]>([]);

  const [loading, setLoading] = useState(false);
  const [analysing, setAnalysing] = useState(false);

  const fileRef = useRef<HTMLInputElement>(null);
  const floorRef = useRef<HTMLInputElement>(null);
  const multiplier = CITIES_WITH_MULTIPLIERS[city];

  async function handleAnalyse() {
    if (!files.length) return;
    setAnalysing(true);
    setStatus("Analysing renders with Claude Vision…");
    const form = new FormData();
    files.forEach((f) => form.append("images", f));
    const res = await fetch("/api/analyse", { method: "POST", body: form });
    const data: RoomAnalysis[] = await res.json();
    setAnalyses(data);
    setEditedAnalyses(data);
    setStatus(`Detected ${data.length} room(s) — review and edit below`);
    setAnalysing(false);
  }

  async function handleGenerate() {
    if (!editedAnalyses.length) return;
    setLoading(true);
    setStatus("Generating BOQ and vendor list in parallel…");
    try {
      const res = await fetch("/api/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          rooms: editedAnalyses,
          city, pincode, tier,
          client_name: clientName,
        }),
      });
      if (!res.ok) {
        const err = await res.text();
        setStatus(`Error: ${err}`);
        setLoading(false);
        return;
      }
      const data = await res.json();
      setBoqRows(data.boq_rows ?? []);
      setVendors(data.vendors ?? []);
      setProjectId(data.project_id ?? null);
      setStatus(`✅ BOQ: ${data.boq_rows?.length ?? 0} line items | Vendors: ${data.vendors?.length ?? 0} entries`);
    } catch (e) {
      setStatus(`Error: ${e}`);
    }
    setLoading(false);
  }

  function updateAnalysis(idx: number, field: keyof RoomAnalysis, value: string | number) {
    setEditedAnalyses((prev) =>
      prev.map((a, i) => (i === idx ? { ...a, [field]: value } : a)),
    );
  }

  const canAnalyse = files.length > 0 && clientName && pincode;
  const canGenerate = editedAnalyses.length > 0 && clientName && pincode;

  return (
    <main className="min-h-screen bg-gray-50">
      {/* Header */}
      <div className="bg-green-900 text-white px-6 py-4 flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold tracking-wide">HOUSPIRE</h1>
          <p className="text-xs text-green-300">Budget Generator — Internal Tool</p>
        </div>
        <a href="/projects" className="text-sm bg-green-700 hover:bg-green-600 px-4 py-2 rounded-lg font-medium transition-colors">
          📁 Past Projects
        </a>
      </div>

      <div className="max-w-5xl mx-auto px-6 py-8 space-y-6">

        {/* Step 1: Client Details */}
        <section className="bg-white rounded-xl border border-gray-200 p-6">
          <h2 className="text-base font-semibold text-gray-900 mb-4 flex items-center gap-2">
            <span className="w-6 h-6 bg-green-900 text-white rounded-full flex items-center justify-center text-xs font-bold">1</span>
            Client Details
          </h2>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">Client Name</label>
              <input
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-green-600"
                placeholder="e.g. Sharma Residence"
                value={clientName}
                onChange={(e) => setClientName(e.target.value)}
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">City</label>
              <select
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-green-600"
                value={city}
                onChange={(e) => setCity(e.target.value)}
              >
                {CITIES.map((c) => <option key={c}>{c}</option>)}
              </select>
              {multiplier && <p className="text-xs text-gray-400 mt-1">×{multiplier.toFixed(2)} multiplier (silent)</p>}
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">Pincode</label>
              <input
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-green-600"
                placeholder="e.g. 500032"
                value={pincode}
                onChange={(e) => setPincode(e.target.value)}
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">Tier</label>
              <select
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-green-600"
                value={tier}
                onChange={(e) => setTier(e.target.value as "Mid-tier" | "Premium")}
              >
                {TIERS.map((t) => <option key={t}>{t}</option>)}
              </select>
            </div>
          </div>
        </section>

        {/* Step 2: Upload Renders */}
        <section className="bg-white rounded-xl border border-gray-200 p-6">
          <h2 className="text-base font-semibold text-gray-900 mb-4 flex items-center gap-2">
            <span className="w-6 h-6 bg-green-900 text-white rounded-full flex items-center justify-center text-xs font-bold">2</span>
            Upload Room Renders
          </h2>
          <div
            className="border-2 border-dashed border-gray-300 rounded-xl p-6 text-center cursor-pointer hover:border-green-500 transition-colors"
            onClick={() => fileRef.current?.click()}
          >
            <input ref={fileRef} type="file" multiple accept="image/jpeg,image/png" className="hidden"
              onChange={(e) => setFiles(Array.from(e.target.files ?? []))} />
            {files.length === 0
              ? <p className="text-sm text-gray-400">Click to upload JPG/PNG renders (multiple rooms allowed)</p>
              : <div className="space-y-1">{files.map((f, i) => <p key={i} className="text-sm text-green-700 font-medium">✓ {f.name}</p>)}</div>}
          </div>
          <button
            className="mt-4 bg-green-900 text-white px-6 py-2.5 rounded-lg text-sm font-semibold hover:bg-green-800 disabled:opacity-50 disabled:cursor-not-allowed"
            disabled={!canAnalyse || analysing}
            onClick={handleAnalyse}
          >
            {analysing ? "⏳ Analysing…" : "🔍 Analyse Rooms"}
          </button>
        </section>

        {/* Step 3: Floor Plan (Optional) */}
        <section className="bg-white rounded-xl border border-gray-200 p-6">
          <h2 className="text-base font-semibold text-gray-900 mb-1 flex items-center gap-2">
            <span className="w-6 h-6 bg-gray-400 text-white rounded-full flex items-center justify-center text-xs font-bold">3</span>
            Floor Plan <span className="text-xs font-normal text-gray-400">(Optional)</span>
          </h2>
          <p className="text-xs text-gray-500 mb-3">Upload for better sqft estimation and room count</p>
          <div
            className="border-2 border-dashed border-gray-200 rounded-xl p-4 text-center cursor-pointer hover:border-green-400 transition-colors"
            onClick={() => floorRef.current?.click()}
          >
            <input ref={floorRef} type="file" accept="image/jpeg,image/png" className="hidden"
              onChange={(e) => setFloorPlan(e.target.files?.[0] ?? null)} />
            {floorPlan
              ? <p className="text-sm text-green-700 font-medium">✓ {floorPlan.name}</p>
              : <p className="text-xs text-gray-400">Click to upload floor plan (JPG/PNG)</p>}
          </div>
        </section>

        {/* Step 4: Review Rooms */}
        {editedAnalyses.length > 0 && (
          <section className="bg-white rounded-xl border border-gray-200 p-6">
            <h2 className="text-base font-semibold text-gray-900 mb-4 flex items-center gap-2">
              <span className="w-6 h-6 bg-green-900 text-white rounded-full flex items-center justify-center text-xs font-bold">4</span>
              Review Detected Rooms
            </h2>
            <div className="space-y-4">
              {editedAnalyses.map((a, i) => {
                const confColor = { high: "bg-green-100 text-green-800", medium: "bg-yellow-100 text-yellow-800", low: "bg-red-100 text-red-800" }[a.confidence];
                return (
                  <div key={i} className="border border-gray-200 rounded-lg p-4">
                    <div className="flex items-center gap-2 mb-3">
                      <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${confColor}`}>{a.confidence}</span>
                      <span className="text-sm font-medium text-gray-600">{a.image_filename}</span>
                    </div>
                    <div className="grid grid-cols-2 gap-3">
                      <div>
                        <label className="block text-xs text-gray-500 mb-1">Room Type</label>
                        <select className="w-full border border-gray-200 rounded px-2 py-1.5 text-sm"
                          value={a.room_type} onChange={(e) => updateAnalysis(i, "room_type", e.target.value)}>
                          {ROOM_TYPES.map((t) => <option key={t}>{t}</option>)}
                        </select>
                      </div>
                      <div>
                        <label className="block text-xs text-gray-500 mb-1">Estimated sqft</label>
                        <input type="number" className="w-full border border-gray-200 rounded px-2 py-1.5 text-sm"
                          value={a.estimated_sqft} onChange={(e) => updateAnalysis(i, "estimated_sqft", parseInt(e.target.value))} />
                      </div>
                      <div className="col-span-2">
                        <label className="block text-xs text-gray-500 mb-1">Design Elements</label>
                        <textarea className="w-full border border-gray-200 rounded px-2 py-1.5 text-sm" rows={3}
                          value={a.design_elements} onChange={(e) => updateAnalysis(i, "design_elements", e.target.value)} />
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </section>
        )}

        {/* Step 5: Output Format */}
        {editedAnalyses.length > 0 && (
          <section className="bg-white rounded-xl border border-gray-200 p-6">
            <h2 className="text-base font-semibold text-gray-900 mb-4 flex items-center gap-2">
              <span className="w-6 h-6 bg-green-900 text-white rounded-full flex items-center justify-center text-xs font-bold">5</span>
              Output Format
            </h2>
            <div className="flex gap-4">
              <label className={`flex items-center gap-3 border rounded-xl p-4 cursor-pointer flex-1 transition-colors ${outputFormat === "excel" ? "border-green-600 bg-green-50" : "border-gray-200 hover:border-gray-300"}`}>
                <input type="radio" name="format" value="excel" checked={outputFormat === "excel"} onChange={() => setOutputFormat("excel")} className="accent-green-700" />
                <div>
                  <p className="text-sm font-semibold text-gray-900">📊 Plain Excel</p>
                  <p className="text-xs text-gray-500">Internal use — BOQ Template + Rate Sources + Vendor sheets</p>
                </div>
              </label>
              <label className={`flex items-center gap-3 border rounded-xl p-4 cursor-pointer flex-1 transition-colors ${outputFormat === "branded" ? "border-green-600 bg-green-50" : "border-gray-200 hover:border-gray-300"}`}>
                <input type="radio" name="format" value="branded" checked={outputFormat === "branded"} onChange={() => setOutputFormat("branded")} className="accent-green-700" />
                <div>
                  <p className="text-sm font-semibold text-gray-900">🎨 Branded DOCX + PDF</p>
                  <p className="text-xs text-gray-500">Client delivery — Houspire branded document</p>
                </div>
              </label>
            </div>
          </section>
        )}

        {/* Step 6: Generate */}
        {editedAnalyses.length > 0 && (
          <section className="bg-white rounded-xl border border-gray-200 p-6">
            <h2 className="text-base font-semibold text-gray-900 mb-4 flex items-center gap-2">
              <span className="w-6 h-6 bg-green-900 text-white rounded-full flex items-center justify-center text-xs font-bold">6</span>
              Generate
            </h2>
            <button
              className="bg-green-900 text-white px-8 py-3 rounded-lg text-sm font-bold hover:bg-green-800 disabled:opacity-50 disabled:cursor-not-allowed"
              disabled={!canGenerate || loading}
              onClick={handleGenerate}
            >
              {loading ? "⏳ Generating (parallel)…" : "⚡ Generate BOQ + Vendors"}
            </button>
            {status && (
              <p className={`mt-3 text-sm font-medium ${status.startsWith("Error") ? "text-red-600" : "text-green-700"}`}>
                {status}
              </p>
            )}
          </section>
        )}

        {/* Downloads */}
        {projectId && (
          <section className="bg-green-900 text-white rounded-xl p-6">
            <h2 className="text-base font-semibold mb-4">Downloads</h2>
            <div className="flex flex-wrap gap-3">
              <a href={`/api/download/boq?id=${projectId}`}
                className="inline-flex items-center gap-2 bg-white text-green-900 px-5 py-2.5 rounded-lg text-sm font-semibold hover:bg-green-50" download>
                📊 Budget Excel ({boqRows.length} items)
              </a>
              <a href={`/api/download/vendors?id=${projectId}`}
                className="inline-flex items-center gap-2 bg-white text-green-900 px-5 py-2.5 rounded-lg text-sm font-semibold hover:bg-green-50" download>
                📍 Vendor Excel ({vendors.length} vendors)
              </a>
            </div>
            <p className="text-xs text-green-300 mt-3">Saved to database. Access anytime at <a href="/projects" className="underline">Past Projects</a>.</p>
          </section>
        )}

        {/* BOQ Preview */}
        {boqRows.length > 0 && (
          <section className="bg-white rounded-xl border border-gray-200 p-6">
            <h2 className="text-base font-semibold text-gray-900 mb-4">BOQ Preview ({boqRows.length} line items)</h2>
            <div className="overflow-x-auto rounded-lg border border-gray-200">
              <table className="w-full text-sm">
                <thead>
                  <tr className="bg-green-900 text-white">
                    <th className="px-3 py-2.5 text-left font-medium">Category</th>
                    <th className="px-3 py-2.5 text-left font-medium">Description</th>
                    <th className="px-3 py-2.5 text-center font-medium">Unit</th>
                    <th className="px-3 py-2.5 text-right font-medium">Qty</th>
                    <th className="px-3 py-2.5 text-right font-medium">Rate (₹)</th>
                    <th className="px-3 py-2.5 text-right font-medium">Amount (₹)</th>
                  </tr>
                </thead>
                <tbody>
                  {boqRows.map((r, i) => (
                    <tr key={i} className={i % 2 === 0 ? "bg-white" : "bg-gray-50"}>
                      <td className="px-3 py-1.5 text-gray-500 text-xs">{r.category}</td>
                      <td className="px-3 py-1.5">{r.description}</td>
                      <td className="px-3 py-1.5 text-center text-gray-500">{r.unit}</td>
                      <td className="px-3 py-1.5 text-right">{r.qty}</td>
                      <td className="px-3 py-1.5 text-right">{r.rate.toLocaleString("en-IN")}</td>
                      <td className="px-3 py-1.5 text-right font-medium text-green-800">₹{(r.qty * r.rate).toLocaleString("en-IN")}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>
        )}

        {/* Vendor Preview */}
        {vendors.length > 0 && (
          <section className="bg-white rounded-xl border border-gray-200 p-6">
            <h2 className="text-base font-semibold text-gray-900 mb-4">Local Vendors ({vendors.length})</h2>
            <div className="overflow-x-auto rounded-lg border border-gray-200">
              <table className="w-full text-sm">
                <thead>
                  <tr className="bg-green-900 text-white">
                    <th className="px-3 py-2.5 text-left font-medium">Category</th>
                    <th className="px-3 py-2.5 text-left font-medium">Vendor</th>
                    <th className="px-3 py-2.5 text-left font-medium">Specialty</th>
                    <th className="px-3 py-2.5 text-left font-medium">Area</th>
                    <th className="px-3 py-2.5 text-center font-medium">Rating</th>
                    <th className="px-3 py-2.5 text-left font-medium">Phone</th>
                  </tr>
                </thead>
                <tbody>
                  {vendors.map((v, i) => (
                    <tr key={i} className={i % 2 === 0 ? "bg-white" : "bg-gray-50"}>
                      <td className="px-3 py-1.5 text-gray-500 text-xs">{v.category}</td>
                      <td className="px-3 py-1.5 font-medium">{v.vendor}</td>
                      <td className="px-3 py-1.5 text-gray-500 text-xs">{v.specialty}</td>
                      <td className="px-3 py-1.5 text-gray-500 text-xs">{v.area}</td>
                      <td className="px-3 py-1.5 text-center">{v.rating}</td>
                      <td className="px-3 py-1.5 text-xs">{v.phone}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>
        )}
      </div>
    </main>
  );
}
