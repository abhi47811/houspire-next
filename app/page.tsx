"use client";

import { useState, useRef } from "react";
import { CITIES, CITIES_WITH_MULTIPLIERS, TIERS, ROOM_TYPES } from "@/lib/config";
import type { RoomAnalysis, BOQRow, RateSource, VendorRow } from "@/lib/types";

type Step = "details" | "upload" | "review" | "generate" | "done";

export default function HomePage() {
  const [clientName, setClientName] = useState("");
  const [city, setCity] = useState("Hyderabad");
  const [pincode, setPincode] = useState("");
  const [tier, setTier] = useState<"Mid-tier" | "Premium">("Mid-tier");

  const [files, setFiles] = useState<File[]>([]);
  const [analyses, setAnalyses] = useState<RoomAnalysis[]>([]);
  const [editedAnalyses, setEditedAnalyses] = useState<RoomAnalysis[]>([]);

  const [status, setStatus] = useState("");
  const [projectId, setProjectId] = useState<string | null>(null);
  const [boqRows, setBoqRows] = useState<BOQRow[]>([]);
  const [vendors, setVendors] = useState<VendorRow[]>([]);

  const [loading, setLoading] = useState(false);
  const [analysing, setAnalysing] = useState(false);

  const fileRef = useRef<HTMLInputElement>(null);
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
    setStatus(`Detected ${data.length} room(s)`);
    setAnalysing(false);
  }

  async function handleGenerate() {
    if (!editedAnalyses.length) return;
    setLoading(true);
    setStatus("Generating BOQ and finding vendors in parallel…");
    try {
      const res = await fetch("/api/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ rooms: editedAnalyses, city, pincode, tier }),
      });
      const data = await res.json();
      setBoqRows(data.boq_rows ?? []);
      setVendors(data.vendors ?? []);
      setProjectId(data.project_id ?? null);
      setStatus(`✅ BOQ: ${data.boq_rows?.length ?? 0} items | Vendors: ${data.vendors?.length ?? 0} entries`);
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
      <div className="bg-white border-b border-gray-200 px-6 py-4 flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-green-900">🏠 Houspire Budget Generator</h1>
          <p className="text-sm text-gray-500">Internal tool — BOQ + vendor list from client renders</p>
        </div>
        <a href="/projects" className="text-sm text-green-700 hover:underline font-medium">📁 Past Projects</a>
      </div>

      <div className="max-w-5xl mx-auto px-6 py-8 space-y-8">

        {/* Step 1: Client Details */}
        <section className="bg-white rounded-xl border border-gray-200 p-6">
          <h2 className="text-lg font-semibold text-gray-900 mb-4">Step 1 — Client Details</h2>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Client Name</label>
              <input
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-green-500"
                placeholder="e.g. Sharma Residence"
                value={clientName}
                onChange={(e) => setClientName(e.target.value)}
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">City</label>
              <select
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-green-500"
                value={city}
                onChange={(e) => setCity(e.target.value)}
              >
                {CITIES.map((c) => <option key={c}>{c}</option>)}
              </select>
              {multiplier && (
                <p className="text-xs text-gray-400 mt-1">Multiplier ×{multiplier.toFixed(2)} (silent)</p>
              )}
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Pincode</label>
              <input
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-green-500"
                placeholder="e.g. 500032"
                value={pincode}
                onChange={(e) => setPincode(e.target.value)}
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Tier</label>
              <select
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-green-500"
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
          <h2 className="text-lg font-semibold text-gray-900 mb-4">Step 2 — Upload Room Renders</h2>
          <div
            className="border-2 border-dashed border-gray-300 rounded-xl p-8 text-center cursor-pointer hover:border-green-400 transition-colors"
            onClick={() => fileRef.current?.click()}
          >
            <input
              ref={fileRef}
              type="file"
              multiple
              accept="image/jpeg,image/png"
              className="hidden"
              onChange={(e) => setFiles(Array.from(e.target.files ?? []))}
            />
            {files.length === 0 ? (
              <p className="text-gray-400">Click to upload JPG/PNG renders (multiple allowed)</p>
            ) : (
              <div className="space-y-1">
                {files.map((f, i) => (
                  <p key={i} className="text-sm text-green-700 font-medium">✓ {f.name}</p>
                ))}
              </div>
            )}
          </div>
          <button
            className="mt-4 bg-green-800 text-white px-6 py-2.5 rounded-lg text-sm font-medium hover:bg-green-700 disabled:opacity-50 disabled:cursor-not-allowed"
            disabled={!canAnalyse || analysing}
            onClick={handleAnalyse}
          >
            {analysing ? "Analysing…" : "🔍 Analyse Rooms"}
          </button>
        </section>

        {/* Step 3: Review Rooms */}
        {editedAnalyses.length > 0 && (
          <section className="bg-white rounded-xl border border-gray-200 p-6">
            <h2 className="text-lg font-semibold text-gray-900 mb-4">Step 3 — Review Detected Rooms</h2>
            <div className="space-y-4">
              {editedAnalyses.map((a, i) => {
                const confColor = { high: "bg-green-100 text-green-800", medium: "bg-yellow-100 text-yellow-800", low: "bg-red-100 text-red-800" }[a.confidence];
                return (
                  <div key={i} className="border border-gray-200 rounded-lg p-4">
                    <div className="flex items-center gap-2 mb-3">
                      <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${confColor}`}>{a.confidence}</span>
                      <span className="text-sm font-medium text-gray-700">{a.image_filename}</span>
                    </div>
                    <div className="grid grid-cols-2 gap-3">
                      <div>
                        <label className="block text-xs text-gray-500 mb-1">Room Type</label>
                        <select
                          className="w-full border border-gray-200 rounded px-2 py-1.5 text-sm"
                          value={a.room_type}
                          onChange={(e) => updateAnalysis(i, "room_type", e.target.value)}
                        >
                          {ROOM_TYPES.map((t) => <option key={t}>{t}</option>)}
                        </select>
                      </div>
                      <div>
                        <label className="block text-xs text-gray-500 mb-1">Estimated sqft</label>
                        <input
                          type="number"
                          className="w-full border border-gray-200 rounded px-2 py-1.5 text-sm"
                          value={a.estimated_sqft}
                          onChange={(e) => updateAnalysis(i, "estimated_sqft", parseInt(e.target.value))}
                        />
                      </div>
                      <div className="col-span-2">
                        <label className="block text-xs text-gray-500 mb-1">Design Elements</label>
                        <textarea
                          className="w-full border border-gray-200 rounded px-2 py-1.5 text-sm"
                          rows={3}
                          value={a.design_elements}
                          onChange={(e) => updateAnalysis(i, "design_elements", e.target.value)}
                        />
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </section>
        )}

        {/* Step 4: Generate */}
        {editedAnalyses.length > 0 && (
          <section className="bg-white rounded-xl border border-gray-200 p-6">
            <h2 className="text-lg font-semibold text-gray-900 mb-4">Step 4 — Generate</h2>
            <button
              className="bg-green-800 text-white px-8 py-3 rounded-lg text-sm font-semibold hover:bg-green-700 disabled:opacity-50 disabled:cursor-not-allowed"
              disabled={!canGenerate || loading}
              onClick={handleGenerate}
            >
              {loading ? "⏳ Generating (BOQ + Vendors in parallel)…" : "⚡ Generate BOQ + Vendors"}
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
          <section className="bg-white rounded-xl border border-gray-200 p-6">
            <h2 className="text-lg font-semibold text-gray-900 mb-4">Downloads</h2>
            <div className="flex flex-wrap gap-3">
              <a
                href={`/api/download/boq?id=${projectId}`}
                className="inline-flex items-center gap-2 bg-green-800 text-white px-5 py-2.5 rounded-lg text-sm font-medium hover:bg-green-700"
                download
              >
                📊 Download Budget Excel ({boqRows.length} items)
              </a>
              <a
                href={`/api/download/vendors?id=${projectId}`}
                className="inline-flex items-center gap-2 bg-green-700 text-white px-5 py-2.5 rounded-lg text-sm font-medium hover:bg-green-600"
                download
              >
                📍 Download Vendor Excel ({vendors.length} vendors)
              </a>
            </div>
            <p className="text-xs text-gray-400 mt-3">Project saved to database. Find it again at <a href="/projects" className="underline">Past Projects</a>.</p>
          </section>
        )}

        {/* BOQ Preview */}
        {boqRows.length > 0 && (
          <section className="bg-white rounded-xl border border-gray-200 p-6">
            <h2 className="text-lg font-semibold text-gray-900 mb-4">BOQ Preview ({boqRows.length} items)</h2>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="bg-green-900 text-white">
                    <th className="px-3 py-2 text-left">Category</th>
                    <th className="px-3 py-2 text-left">Description</th>
                    <th className="px-3 py-2 text-center">Unit</th>
                    <th className="px-3 py-2 text-right">Qty</th>
                    <th className="px-3 py-2 text-right">Rate (₹)</th>
                    <th className="px-3 py-2 text-right">Amount (₹)</th>
                  </tr>
                </thead>
                <tbody>
                  {boqRows.map((r, i) => (
                    <tr key={i} className={i % 2 === 0 ? "bg-white" : "bg-gray-50"}>
                      <td className="px-3 py-1.5 text-gray-600">{r.category}</td>
                      <td className="px-3 py-1.5">{r.description}</td>
                      <td className="px-3 py-1.5 text-center text-gray-500">{r.unit}</td>
                      <td className="px-3 py-1.5 text-right">{r.qty}</td>
                      <td className="px-3 py-1.5 text-right">{r.rate.toLocaleString("en-IN")}</td>
                      <td className="px-3 py-1.5 text-right font-medium">
                        {(r.qty * r.rate).toLocaleString("en-IN")}
                      </td>
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
            <h2 className="text-lg font-semibold text-gray-900 mb-4">Vendors ({vendors.length})</h2>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="bg-green-900 text-white">
                    <th className="px-3 py-2 text-left">Category</th>
                    <th className="px-3 py-2 text-left">Vendor</th>
                    <th className="px-3 py-2 text-left">Specialty</th>
                    <th className="px-3 py-2 text-left">Area</th>
                    <th className="px-3 py-2 text-center">Rating</th>
                    <th className="px-3 py-2 text-left">Phone</th>
                  </tr>
                </thead>
                <tbody>
                  {vendors.map((v, i) => (
                    <tr key={i} className={i % 2 === 0 ? "bg-white" : "bg-gray-50"}>
                      <td className="px-3 py-1.5 text-gray-600">{v.category}</td>
                      <td className="px-3 py-1.5 font-medium">{v.vendor}</td>
                      <td className="px-3 py-1.5 text-gray-500">{v.specialty}</td>
                      <td className="px-3 py-1.5 text-gray-500">{v.area}</td>
                      <td className="px-3 py-1.5 text-center">{v.rating}</td>
                      <td className="px-3 py-1.5">{v.phone}</td>
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
