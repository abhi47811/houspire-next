"use client";

import React, { useState, useRef, useEffect } from "react";
import { CITIES, CITIES_WITH_MULTIPLIERS, TIERS, ROOM_TYPES } from "@/lib/config";
import { toast } from "@/lib/toast";
import type { RoomAnalysis, BOQRow, BOQPhase, VendorRow } from "@/lib/types";

const ALL_PHASES = "All Phases";
const PHASES: BOQPhase[] = [
  "Phase 1: Civil & Flooring",
  "Phase 2: Carpentry",
  "Phase 3: Electrical & MEP",
  "Phase 4: Finishes & Furnishings",
];

export default function HomePage() {
  const [clientName, setClientName] = useState("");
  const [city, setCity] = useState("Hyderabad");
  const [pincode, setPincode] = useState("");
  const [tier, setTier] = useState<"Mid-tier" | "Premium">("Mid-tier");

  // Pre-fill from URL params when coming from "Edit / Redo" on Past Projects page
  // Also loads saved BOQ + vendor data from DB so downloads work immediately
  useEffect(() => {
    if (typeof window === "undefined") return;
    const p = new URLSearchParams(window.location.search);
    const reloadId = p.get("reload");
    if (reloadId) {
      if (p.get("client")) setClientName(p.get("client")!);
      if (p.get("city") && CITIES.includes(p.get("city")!)) setCity(p.get("city")!);
      if (p.get("pincode")) setPincode(p.get("pincode")!);
      if (p.get("tier") === "Premium") setTier("Premium");
      // Load saved BOQ + vendor data from DB
      fetch(`/api/projects/${reloadId}/boq`)
        .then((r) => r.json())
        .then((data) => {
          if (data.boq_rows?.length > 0) {
            setBoqRows(data.boq_rows);
            setEditedBoqRows(data.boq_rows);
            setProjectId(reloadId);
            setStatus(`Loaded ${data.boq_rows.length} saved BOQ items. Upload new renders to regenerate.`);
          }
          if (data.vendors?.length > 0) setVendors(data.vendors);
        })
        .catch(() => {});
      // Clean URL without reloading
      window.history.replaceState({}, "", "/");
    }
  }, []);

  const [files, setFiles] = useState<File[]>([]);
  const [floorPlan, setFloorPlan] = useState<File | null>(null);
  const [analyses, setAnalyses] = useState<RoomAnalysis[]>([]);
  const [editedAnalyses, setEditedAnalyses] = useState<RoomAnalysis[]>([]);
  // Per-room dimension state: [{ length, width }]
  const [roomDims, setRoomDims] = useState<Array<{ length: string; width: string }>>([]);

  const [includeGST, setIncludeGST] = useState(false);

  const [status, setStatus] = useState("");
  const [projectId, setProjectId] = useState<string | null>(null);
  const [boqRows, setBoqRows] = useState<BOQRow[]>([]);
  const [editedBoqRows, setEditedBoqRows] = useState<BOQRow[]>([]);
  const [boqSaved, setBoqSaved] = useState(false);
  const [vendors, setVendors] = useState<VendorRow[]>([]);

  // Phase filter for BOQ table
  const [selectedPhase, setSelectedPhase] = useState<string>(ALL_PHASES);

  // US-T2-08: gap warnings
  const [gapWarnings, setGapWarnings] = useState<string[]>([]);
  // US-T2-09: dismissed optimization suggestions
  const [dismissedSuggestions, setDismissedSuggestions] = useState<Set<number>>(new Set());
  const [acceptedSuggestions, setAcceptedSuggestions] = useState<Set<number>>(new Set());
  // US-T2-11: actual cost tracking
  const [actualCost, setActualCost] = useState<string>("");
  const [savedActualCost, setSavedActualCost] = useState<number | null>(null);

  // US-T3-12: email delivery
  const [emailRecipient, setEmailRecipient] = useState("");
  const [emailSending, setEmailSending] = useState(false);
  const [emailSent, setEmailSent] = useState(false);

  // US-T3-14: vendor shortlist
  const [shortlistedVendors, setShortlistedVendors] = useState<Set<string>>(new Set());

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
    if (floorPlan) form.append("floorplan", floorPlan);
    let res: Response;
    try {
      res = await fetch("/api/analyse", { method: "POST", body: form });
    } catch {
      toast("Analysis failed — check API key", "error");
      setAnalysing(false);
      return;
    }
    if (!res.ok) {
      toast("Analysis failed — check API key", "error");
      setAnalysing(false);
      return;
    }
    const data: { rooms: RoomAnalysis[]; floorPlanRooms: Array<{room_type: string; estimated_sqft: number; length_ft?: number; width_ft?: number}> } = await res.json();
    setAnalyses(data.rooms);
    setEditedAnalyses(data.rooms);
    setRoomDims(data.rooms.map(() => ({ length: "", width: "" })));
    if (data.floorPlanRooms && data.floorPlanRooms.length > 0) {
      // Pre-populate dimensions from floor plan
      const newDims = data.floorPlanRooms.map((r) => ({
        length: r.length_ft ? String(r.length_ft) : "",
        width: r.width_ft ? String(r.width_ft) : "",
      }));
      setRoomDims(newDims);
      // If floor plan has rooms but renders don't (or few renders), use floor plan rooms
      if (data.rooms.length === 0 && data.floorPlanRooms.length > 0) {
        const fpAnalyses = data.floorPlanRooms.map((r, i) => ({
          room_type: r.room_type,
          estimated_sqft: r.estimated_sqft,
          confidence: "medium" as const,
          design_elements: "Extracted from floor plan — add design details from renders",
          image_filename: `floor_plan_room_${i + 1}`,
        }));
        setAnalyses(fpAnalyses);
        setEditedAnalyses(fpAnalyses);
      }
    }
    setStatus(`Detected ${data.rooms.length} room(s) — review and edit below`);
    toast(`Detected ${data.rooms.length} room(s)`, "success");
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
          includeGST,
        }),
      });
      if (!res.ok) {
        const err = await res.text();
        setStatus(`Error: ${err}`);
        toast(`Generation failed: ${err}`, "error");
        setLoading(false);
        return;
      }
      const data = await res.json();
      setBoqRows(data.boq_rows ?? []);
      setEditedBoqRows(data.boq_rows ?? []);
      setBoqSaved(false);
      setVendors(data.vendors ?? []);
      setProjectId(data.project_id ?? null);
      setGapWarnings(detectGaps(editedAnalyses, data.boq_rows ?? []));
      setDismissedSuggestions(new Set());
      setAcceptedSuggestions(new Set());
      setSavedActualCost(null);
      setActualCost("");
      setEmailSent(false);
      setEmailRecipient("");
      setShortlistedVendors(new Set());
      setStatus(`✅ BOQ: ${data.boq_rows?.length ?? 0} line items | Vendors: ${data.vendors?.length ?? 0} entries`);
      toast(`✅ BOQ: ${data.boq_rows?.length} items generated`, "success");
    } catch (e) {
      setStatus(`Error: ${e}`);
      toast(`Generation failed: ${e}`, "error");
    }
    setLoading(false);
  }

  // US-T2-08: gap detection
  function detectGaps(rooms: RoomAnalysis[], rows: BOQRow[]): string[] {
    const warnings: string[] = [];
    const desc = rows.map(r => r.description.toLowerCase()).join(' ');
    for (const room of rooms) {
      const rt = room.room_type.toLowerCase();
      if ((rt.includes('bedroom') || rt.includes('living')) && !desc.includes('ceiling') && !desc.includes('cove')) {
        warnings.push(`${room.room_type}: No false ceiling detected — consider adding`);
      }
      if ((rt.includes('bedroom') || rt.includes('living')) && !desc.includes(' ac ') && !desc.includes('split ac')) {
        warnings.push(`${room.room_type}: No AC detected`);
      }
      if (rt.includes('kitchen') && !desc.includes('countertop') && !desc.includes('quartz')) {
        warnings.push(`Kitchen: No countertop specified`);
      }
      if (rt.includes('bath') && !desc.includes('waterproof')) {
        warnings.push(`Bathroom: No waterproofing specified`);
      }
    }
    return warnings;
  }

  function updateAnalysis(idx: number, field: keyof RoomAnalysis, value: string | number) {
    setEditedAnalyses((prev) =>
      prev.map((a, i) => (i === idx ? { ...a, [field]: value } : a)),
    );
  }

  function updateDim(idx: number, field: "length" | "width", value: string) {
    setRoomDims((prev) => {
      const next = [...prev];
      next[idx] = { ...next[idx], [field]: value };
      const l = parseFloat(field === "length" ? value : next[idx].length);
      const w = parseFloat(field === "width" ? value : next[idx].width);
      if (!isNaN(l) && !isNaN(w) && l > 0 && w > 0) {
        updateAnalysis(idx, "estimated_sqft", Math.round(l * w));
      }
      return next;
    });
  }

  // Filtered rows for the BOQ table
  const filteredRows = selectedPhase === ALL_PHASES
    ? editedBoqRows
    : editedBoqRows.filter((r) => r.phase === selectedPhase);

  // Phase subtotals
  function phaseSubtotal(phase: BOQPhase) {
    return editedBoqRows
      .filter((r) => r.phase === phase)
      .reduce((s, r) => s + r.qty * r.rate, 0);
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
        <div className="flex gap-2">
          <a href="/analytics" className="text-sm bg-green-700 hover:bg-green-600 px-4 py-2 rounded-lg font-medium transition-colors">
            📊 Analytics
          </a>
          <a href="/projects" className="text-sm bg-green-700 hover:bg-green-600 px-4 py-2 rounded-lg font-medium transition-colors">
            📁 Past Projects
          </a>
          <button
            className="text-sm bg-green-700 hover:bg-green-600 px-4 py-2 rounded-lg font-medium transition-colors"
            onClick={async () => {
              const { getSupabaseClient } = await import("@/lib/supabase");
              await getSupabaseClient().auth.signOut();
              window.location.href = "/login";
            }}
          >
            Sign Out
          </button>
        </div>
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
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-green-600"
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
          <div className="mt-4">
            <label className="flex items-center gap-2 cursor-pointer">
              <input
                type="checkbox"
                className="accent-green-700 w-4 h-4"
                checked={includeGST}
                onChange={(e) => setIncludeGST(e.target.checked)}
              />
              <span className="text-sm text-gray-700">Include GST (18%)</span>
            </label>
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
                const dim = roomDims[i] ?? { length: "", width: "" };
                const l = parseFloat(dim.length);
                const w = parseFloat(dim.width);
                const hasDims = !isNaN(l) && !isNaN(w) && l > 0 && w > 0;
                const floorSqft = hasDims ? Math.round(l * w) : null;
                const wallSqft = hasDims ? Math.round(2 * (l + w) * 9) : null;
                return (
                  <div key={i} className="border border-gray-200 rounded-lg p-4">
                    <div className="flex items-center gap-2 mb-3">
                      <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${confColor}`}>{a.confidence}</span>
                      {a.style && (
                        <span className="text-xs px-2 py-0.5 rounded-full font-medium bg-purple-100 text-purple-800 capitalize">{a.style}</span>
                      )}
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

                      {/* US-T1-06: Dimension calculator */}
                      <div>
                        <label className="block text-xs text-gray-500 mb-1">Length (ft)</label>
                        <input
                          type="number"
                          className="w-full border border-gray-200 rounded px-2 py-1.5 text-sm"
                          placeholder="e.g. 14"
                          value={dim.length}
                          onChange={(e) => updateDim(i, "length", e.target.value)}
                        />
                      </div>
                      <div>
                        <label className="block text-xs text-gray-500 mb-1">Width (ft)</label>
                        <input
                          type="number"
                          className="w-full border border-gray-200 rounded px-2 py-1.5 text-sm"
                          placeholder="e.g. 12"
                          value={dim.width}
                          onChange={(e) => updateDim(i, "width", e.target.value)}
                        />
                      </div>
                      {hasDims && (
                        <div className="col-span-2 bg-green-50 border border-green-200 rounded px-3 py-2 text-xs text-green-800">
                          <span className="font-medium">Calculated: {floorSqft} sqft</span>
                          <span className="mx-2 text-green-400">|</span>
                          Floor: {floorSqft} sft
                          <span className="mx-2 text-green-400">|</span>
                          Walls: {wallSqft} sft
                          <span className="mx-2 text-green-400">|</span>
                          Ceiling: {floorSqft} sft
                        </div>
                      )}

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

        {/* Step 5: Generate */}
        {editedAnalyses.length > 0 && (
          <section className="bg-white rounded-xl border border-gray-200 p-6">
            <h2 className="text-base font-semibold text-gray-900 mb-4 flex items-center gap-2">
              <span className="w-6 h-6 bg-green-900 text-white rounded-full flex items-center justify-center text-xs font-bold">5</span>
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
              <div className={`mt-3 flex items-start gap-2 rounded-lg p-3 text-sm font-medium ${
                status.startsWith("Error") || status.startsWith("✗")
                  ? "bg-red-50 text-red-700 border border-red-200"
                  : "bg-green-50 text-green-700 border border-green-200"
              }`}>
                <span className="flex-1">{status}</span>
                <button onClick={() => setStatus("")} className="text-current opacity-60 hover:opacity-100 ml-2 text-xs">✕</button>
              </div>
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
              <a href={`/api/download/boq-pdf?id=${projectId}`}
                className="inline-flex items-center gap-2 bg-amber-500 text-white px-5 py-2.5 rounded-lg text-sm font-semibold hover:bg-amber-400" download>
                📑 Branded BOQ PDF
              </a>
              <a href={`/api/download/vendors-pdf?id=${projectId}`}
                className="inline-flex items-center gap-2 bg-amber-600 text-white px-5 py-2.5 rounded-lg text-sm font-semibold hover:bg-amber-500" download>
                📑 Branded Vendor PDF
              </a>
              <a
                href={`https://wa.me/?text=${encodeURIComponent(`Houspire BOQ for ${clientName} - ${city} | ${boqRows.length} items | Est. ₹${Math.round(boqRows.reduce((s, r) => s + r.qty * r.rate, 0)).toLocaleString("en-IN")} | View project: https://houspire-next.vercel.app/projects`)}`}
                target="_blank" rel="noopener noreferrer"
                className="inline-flex items-center gap-2 bg-green-500 text-white px-5 py-2.5 rounded-lg text-sm font-semibold hover:bg-green-400">
                💬 Share on WhatsApp
              </a>
              {/* US-T1-05: Share approval link */}
              <button
                className="inline-flex items-center gap-2 bg-amber-600 text-white px-5 py-2.5 rounded-lg text-sm font-semibold hover:bg-amber-500"
                onClick={() => {
                  const link = `${window.location.origin}/approve/${projectId}`;
                  navigator.clipboard.writeText(link);
                  alert(`Approval link copied!\n${link}`);
                }}
              >
                🔗 Share Approval Link
              </button>
              {/* US-T4-18: Contractor quote link */}
              <button
                className="inline-flex items-center gap-2 bg-blue-700 text-white px-5 py-2.5 rounded-lg text-sm font-semibold hover:bg-blue-600"
                onClick={() => {
                  const link = `${window.location.origin}/quote/${projectId}`;
                  navigator.clipboard.writeText(link);
                  alert(`Contractor quote link copied!\n${link}`);
                }}
              >
                🏗️ Share Contractor Quote Link
              </button>
            </div>
            {/* Work order per phase */}
            <div className="mt-4 border-t border-green-700 pt-4">
              <p className="text-xs text-green-300 mb-2 font-medium">Work Orders by Phase</p>
              <div className="flex flex-wrap gap-2">
                {PHASES.map((p) => (
                  <a
                    key={p}
                    href={`/api/download/work-order?id=${projectId}&phase=${encodeURIComponent(p)}`}
                    className="inline-flex items-center gap-1.5 bg-green-700 hover:bg-green-600 text-white px-3 py-1.5 rounded-lg text-xs font-medium"
                    download
                  >
                    📋 {p.replace(/Phase \d: /, "")}
                  </a>
                ))}
                <a
                  href={`/api/download/work-order?id=${projectId}&phase=all`}
                  className="inline-flex items-center gap-1.5 bg-green-700 hover:bg-green-600 text-white px-3 py-1.5 rounded-lg text-xs font-medium"
                  download
                >
                  📋 All Phases
                </a>
              </div>
            </div>

            {/* US-T3-12: Email delivery */}
            <div className="mt-4 border-t border-green-700 pt-4">
              <p className="text-xs text-green-300 mb-2 font-medium">Email BOQ to Client</p>
              <div className="flex items-center gap-2 flex-wrap">
                <input
                  type="email"
                  className="border border-green-600 bg-green-800 text-white placeholder-green-400 rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-green-400 w-56"
                  placeholder="client@email.com"
                  value={emailRecipient}
                  onChange={(e) => { setEmailRecipient(e.target.value); setEmailSent(false); }}
                />
                <button
                  className="bg-amber-500 hover:bg-amber-400 text-white px-4 py-1.5 rounded-lg text-sm font-semibold disabled:opacity-50"
                  disabled={!emailRecipient || emailSending || emailSent}
                  onClick={async () => {
                    setEmailSending(true);
                    const emailRes = await fetch("/api/send-boq", {
                      method: "POST",
                      headers: { "Content-Type": "application/json" },
                      body: JSON.stringify({ projectId, recipientEmail: emailRecipient }),
                    });
                    setEmailSending(false);
                    if (emailRes.ok) {
                      setEmailSent(true);
                      toast("Email sent!", "success");
                    } else {
                      toast("Email failed — check RESEND_API_KEY", "error");
                    }
                  }}
                >
                  {emailSending ? "Sending…" : emailSent ? "✓ Sent" : "📧 Send"}
                </button>
              </div>
            </div>

            <p className="text-xs text-green-300 mt-3">Saved to database. Access anytime at <a href="/projects" className="underline">Past Projects</a>.</p>
          </section>
        )}

        {/* Payment Schedule */}
        {projectId && (() => {
          const total = editedBoqRows.reduce((s, r) => s + r.qty * r.rate, 0);
          const milestones = [
            { name: "Advance", pct: 30 },
            { name: "Material Delivery", pct: 30 },
            { name: "Mid-Execution", pct: 30 },
            { name: "Completion", pct: 10 },
          ];
          const scheduleText = "Payment Schedule:\n" + milestones.map((m, i) =>
            `${i + 1}. ${m.name} (${m.pct}%): ₹${Math.round(total * m.pct / 100).toLocaleString("en-IN")}`
          ).join("\n");
          return (
            <section className="bg-white rounded-xl border border-gray-200 p-6">
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-base font-semibold text-gray-900">Payment Schedule</h2>
                <button
                  className="text-sm bg-green-900 text-white px-4 py-1.5 rounded-lg hover:bg-green-800"
                  onClick={() => navigator.clipboard.writeText(scheduleText)}
                >
                  📋 Copy Schedule
                </button>
              </div>
              <table className="w-full text-sm">
                <thead>
                  <tr className="bg-green-900 text-white">
                    <th className="px-4 py-2.5 text-left font-medium rounded-tl-lg">Milestone</th>
                    <th className="px-4 py-2.5 text-center font-medium">%</th>
                    <th className="px-4 py-2.5 text-right font-medium rounded-tr-lg">Amount (₹)</th>
                  </tr>
                </thead>
                <tbody>
                  {milestones.map((m, i) => (
                    <tr key={i} className={i % 2 === 0 ? "bg-white" : "bg-gray-50"}>
                      <td className="px-4 py-2.5 font-medium text-gray-900">{m.name}</td>
                      <td className="px-4 py-2.5 text-center text-gray-600">{m.pct}%</td>
                      <td className="px-4 py-2.5 text-right font-semibold text-green-800">
                        ₹{Math.round(total * m.pct / 100).toLocaleString("en-IN")}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </section>
          );
        })()}

        {/* US-T2-11: Actual cost tracking */}
        {projectId && editedBoqRows.length > 0 && (() => {
          const estimated = editedBoqRows.reduce((s, r) => s + r.qty * r.rate, 0);
          const variance = savedActualCost !== null ? savedActualCost - estimated : null;
          return (
            <section className="bg-white rounded-xl border border-gray-200 p-6">
              <h2 className="text-base font-semibold text-gray-900 mb-4">Enter Actual Final Cost</h2>
              <div className="flex items-center gap-3 flex-wrap">
                <div className="flex items-center gap-2">
                  <span className="text-sm text-gray-600">₹</span>
                  <input
                    type="number"
                    className="border border-gray-300 rounded-lg px-3 py-2 text-sm w-44 focus:outline-none focus:ring-2 focus:ring-green-600"
                    placeholder="e.g. 1200000"
                    value={actualCost}
                    onChange={(e) => setActualCost(e.target.value)}
                  />
                </div>
                <button
                  className="bg-green-900 text-white px-4 py-2 rounded-lg text-sm font-semibold hover:bg-green-800 disabled:opacity-50"
                  disabled={!actualCost}
                  onClick={async () => {
                    const val = parseFloat(actualCost);
                    if (isNaN(val)) return;
                    await fetch(`/api/projects/${projectId}/actual`, {
                      method: "PUT",
                      headers: { "Content-Type": "application/json" },
                      body: JSON.stringify({ actual_total_inr: val }),
                    });
                    setSavedActualCost(val);
                  }}
                >
                  Save Actual Cost
                </button>
                {variance !== null && (
                  <span className={`text-sm font-semibold ${variance <= 0 ? 'text-green-700' : 'text-red-600'}`}>
                    {variance <= 0
                      ? `₹${Math.abs(Math.round(variance)).toLocaleString('en-IN')} under budget`
                      : `₹${Math.round(variance).toLocaleString('en-IN')} over budget (${((variance / estimated) * 100).toFixed(1)}%)`}
                  </span>
                )}
              </div>
            </section>
          );
        })()}

        {/* US-T2-08: Gap warnings */}
        {gapWarnings.length > 0 && (
          <section className="space-y-2">
            {gapWarnings.map((w, i) => (
              <div key={i} className="flex items-start gap-3 bg-amber-50 border border-amber-200 rounded-lg px-4 py-3">
                <span className="text-amber-500 mt-0.5">⚠️</span>
                <p className="text-sm text-amber-800">{w}</p>
              </div>
            ))}
          </section>
        )}

        {/* US-T2-09: Savings opportunities */}
        {editedBoqRows.length > 0 && (() => {
          const desc = editedBoqRows.map(r => r.description.toLowerCase()).join(' ');
          const suggestions: { id: number; trigger: string; suggestion: string; saving: number; unit: string }[] = [];
          if (desc.includes('kajaria')) {
            suggestions.push({ id: 0, trigger: 'kajaria', suggestion: 'Morbi tiles instead of Kajaria: saves ~₹30/sft', saving: 30, unit: 'sft' });
          }
          if (desc.includes('legrand')) {
            suggestions.push({ id: 1, trigger: 'legrand', suggestion: 'Anchor/Panasonic instead of Legrand: saves ~₹400/nos', saving: 400, unit: 'nos' });
          }
          if (desc.includes('hettich') && desc.includes('hinge')) {
            suggestions.push({ id: 2, trigger: 'hettich hinge', suggestion: 'Dorset/local hinges instead of Hettich: saves ~₹100/pair', saving: 100, unit: 'pair' });
          }
          const visible = suggestions.filter(s => !dismissedSuggestions.has(s.id));
          if (visible.length === 0) return null;
          return (
            <section className="bg-white rounded-xl border border-gray-200 p-6">
              <h2 className="text-base font-semibold text-gray-900 mb-4">💡 Savings Opportunities</h2>
              <div className="space-y-3">
                {visible.map((s) => {
                  const matchedRows = editedBoqRows.filter(r => r.description.toLowerCase().includes(s.trigger.split(' ')[0]));
                  const totalQty = matchedRows.reduce((sum, r) => sum + r.qty, 0);
                  const totalSaving = Math.round(totalQty * s.saving);
                  const accepted = acceptedSuggestions.has(s.id);
                  return (
                    <div key={s.id} className={`flex items-center justify-between gap-4 rounded-lg border px-4 py-3 ${accepted ? 'bg-green-50 border-green-200' : 'bg-yellow-50 border-yellow-200'}`}>
                      <div className="flex-1">
                        <p className="text-sm text-gray-800">{s.suggestion}</p>
                        {totalQty > 0 && <p className="text-xs text-green-700 mt-0.5">Est. total saving: ₹{totalSaving.toLocaleString('en-IN')} ({Math.round(totalQty)} {s.unit})</p>}
                      </div>
                      <div className="flex gap-2 shrink-0">
                        {!accepted && (
                          <button
                            className="text-xs bg-green-700 text-white px-3 py-1.5 rounded-lg hover:bg-green-600"
                            onClick={() => setAcceptedSuggestions(prev => new Set([...prev, s.id]))}
                          >Accept</button>
                        )}
                        {accepted && <span className="text-xs text-green-700 font-medium">✓ Noted</span>}
                        <button
                          className="text-xs bg-gray-100 text-gray-600 px-3 py-1.5 rounded-lg hover:bg-gray-200"
                          onClick={() => setDismissedSuggestions(prev => new Set([...prev, s.id]))}
                        >Dismiss</button>
                      </div>
                    </div>
                  );
                })}
              </div>
            </section>
          );
        })()}

        {/* BOQ Preview with inline edit + phase filter */}
        {editedBoqRows.length > 0 && (
          <section className="bg-white rounded-xl border border-gray-200 p-6">
            <div className="flex items-center justify-between mb-4 flex-wrap gap-3">
              <h2 className="text-base font-semibold text-gray-900">
                BOQ Preview ({filteredRows.length}/{editedBoqRows.length} items)
                <span className="text-xs font-normal text-gray-400 ml-2">— click cells to edit</span>
              </h2>
              <div className="flex items-center gap-3">
                {/* US-T1-04: Phase filter */}
                <select
                  className="border border-gray-200 rounded-lg px-3 py-1.5 text-sm text-gray-700"
                  value={selectedPhase}
                  onChange={(e) => setSelectedPhase(e.target.value)}
                >
                  <option value={ALL_PHASES}>All Phases</option>
                  {PHASES.map((p) => (
                    <option key={p} value={p}>{p}</option>
                  ))}
                </select>
                <button
                  className="text-sm bg-green-900 text-white px-4 py-1.5 rounded-lg hover:bg-green-800 disabled:opacity-50"
                  disabled={boqSaved}
                  onClick={async () => {
                    if (!projectId) return;
                    await fetch(`/api/projects/${projectId}/boq`, {
                      method: "PUT",
                      headers: { "Content-Type": "application/json" },
                      body: JSON.stringify({ rows: editedBoqRows }),
                    });
                    setBoqSaved(true);
                  }}
                >
                  {boqSaved ? "✓ Saved" : "💾 Save Edits"}
                </button>
              </div>
            </div>

            {/* Phase subtotals summary (always visible) */}
            {selectedPhase === ALL_PHASES && (
              <div className="mb-4 grid grid-cols-2 md:grid-cols-4 gap-2">
                {PHASES.map((p) => {
                  const sub = phaseSubtotal(p);
                  const label = p.replace(/Phase \d: /, "");
                  return (
                    <button
                      key={p}
                      onClick={() => setSelectedPhase(p)}
                      className="text-left bg-gray-50 border border-gray-200 rounded-lg px-3 py-2 hover:border-green-400 transition-colors"
                    >
                      <p className="text-xs text-gray-500 leading-tight">{label}</p>
                      <p className="text-sm font-semibold text-green-800 mt-0.5">
                        ₹{Math.round(sub).toLocaleString("en-IN")}
                      </p>
                    </button>
                  );
                })}
              </div>
            )}

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
                    <th className="px-3 py-2.5 text-center font-medium">Rate</th>
                    <th className="px-3 py-2.5 text-center font-medium">Alt</th>
                  </tr>
                </thead>
                <tbody>
                  {(() => {
                    // When showing all phases, insert phase separator rows
                    if (selectedPhase !== ALL_PHASES) {
                      return filteredRows.map((r, i) => {
                        const rowIdx = editedBoqRows.indexOf(r);
                        return <BOQEditRow key={i} r={r} rowIdx={rowIdx} editedBoqRows={editedBoqRows} setEditedBoqRows={setEditedBoqRows} setBoqSaved={setBoqSaved} i={i} />;
                      });
                    }
                    const elements: React.ReactNode[] = [];
                    let lastPhase: string | undefined;
                    editedBoqRows.forEach((r, rowIdx) => {
                      if (r.phase !== lastPhase) {
                        lastPhase = r.phase;
                        const sub = phaseSubtotal((r.phase ?? "Phase 4: Finishes & Furnishings") as BOQPhase);
                        elements.push(
                          <tr key={`phase-${rowIdx}`} className="bg-green-50 border-t border-b border-green-200">
                            <td colSpan={5} className="px-3 py-2 text-xs font-semibold text-green-800">
                              {r.phase ?? "Unphased"}
                            </td>
                            <td className="px-3 py-2 text-xs font-semibold text-green-800 text-right">
                              ₹{Math.round(sub).toLocaleString("en-IN")}
                            </td>
                            <td /><td />
                          </tr>
                        );
                      }
                      elements.push(
                        <BOQEditRow key={rowIdx} r={r} rowIdx={rowIdx} editedBoqRows={editedBoqRows} setEditedBoqRows={setEditedBoqRows} setBoqSaved={setBoqSaved} i={rowIdx} />
                      );
                    });
                    return elements;
                  })()}
                </tbody>
              </table>
            </div>
          </section>
        )}

        {/* Vendor Preview */}
        {vendors.length > 0 && (
          <section className="bg-white rounded-xl border border-gray-200 p-6">
            <h2 className="text-base font-semibold text-gray-900 mb-4">
              Local Vendors ({vendors.length})
              {shortlistedVendors.size > 0 && (
                <span className="ml-2 text-xs font-normal text-amber-600">📌 {shortlistedVendors.size} pinned</span>
              )}
            </h2>
            <div className="overflow-x-auto rounded-lg border border-gray-200">
              <table className="w-full text-sm">
                <thead>
                  <tr className="bg-green-900 text-white">
                    <th className="px-3 py-2.5 text-center font-medium">📌</th>
                    <th className="px-3 py-2.5 text-left font-medium">Category</th>
                    <th className="px-3 py-2.5 text-left font-medium">Vendor</th>
                    <th className="px-3 py-2.5 text-left font-medium">Specialty</th>
                    <th className="px-3 py-2.5 text-left font-medium">Area</th>
                    <th className="px-3 py-2.5 text-center font-medium">Rating</th>
                    <th className="px-3 py-2.5 text-left font-medium">Phone</th>
                  </tr>
                </thead>
                <tbody>
                  {[...vendors]
                    .sort((a, b) => {
                      const ap = shortlistedVendors.has(a.vendor) ? 0 : 1;
                      const bp = shortlistedVendors.has(b.vendor) ? 0 : 1;
                      return ap - bp;
                    })
                    .map((v, i) => {
                      const pinned = shortlistedVendors.has(v.vendor);
                      return (
                        <tr key={i} className={pinned ? "bg-amber-50" : i % 2 === 0 ? "bg-white" : "bg-gray-50"}>
                          <td className="px-3 py-1.5 text-center">
                            <button
                              title={pinned ? "Unpin vendor" : "Pin vendor"}
                              className={`text-base ${pinned ? "opacity-100" : "opacity-30 hover:opacity-80"}`}
                              onClick={async () => {
                                if (pinned) {
                                  setShortlistedVendors((prev) => {
                                    const next = new Set(prev);
                                    next.delete(v.vendor);
                                    return next;
                                  });
                                  if (projectId) {
                                    await fetch(`/api/projects/${projectId}/shortlist`, {
                                      method: "DELETE",
                                      headers: { "Content-Type": "application/json" },
                                      body: JSON.stringify({ vendor_name: v.vendor }),
                                    });
                                  }
                                } else {
                                  setShortlistedVendors((prev) => new Set([...prev, v.vendor]));
                                  toast("Vendor pinned to shortlist", "success");
                                  if (projectId) {
                                    await fetch(`/api/projects/${projectId}/shortlist`, {
                                      method: "POST",
                                      headers: { "Content-Type": "application/json" },
                                      body: JSON.stringify({ vendor_name: v.vendor, category: v.category }),
                                    });
                                  }
                                }
                              }}
                            >
                              📌
                            </button>
                          </td>
                          <td className="px-3 py-1.5 text-gray-500 text-xs">{v.category}</td>
                          <td className="px-3 py-1.5 font-medium">
                            {v.vendor}
                            {pinned && <span className="ml-1 text-xs text-amber-600">📌</span>}
                          </td>
                          <td className="px-3 py-1.5 text-gray-500 text-xs">{v.specialty}</td>
                          <td className="px-3 py-1.5 text-gray-500 text-xs">{v.area}</td>
                          <td className="px-3 py-1.5 text-center">{v.rating}</td>
                          <td className="px-3 py-1.5 text-xs">{v.phone}</td>
                        </tr>
                      );
                    })}
                </tbody>
              </table>
            </div>
          </section>
        )}
      </div>
    </main>
  );
}

// US-T2-10: Static alternative material suggestions by category keyword
function getAltSuggestions(description: string, category: string): { budget: string; premium: string } | null {
  const d = description.toLowerCase();
  const c = category.toLowerCase();
  if (d.includes('kajaria') || d.includes('somany') || c.includes('floor') || c.includes('tile')) {
    return { budget: "Somany/Johnson — ~10% cheaper", premium: "RAK/Porcelain+++ — ~20% higher" };
  }
  if (d.includes('legrand') || c.includes('electrical') || c.includes('switch')) {
    return { budget: "Anchor/Panasonic — ~35% cheaper", premium: "Schneider Unica — ~20% higher" };
  }
  if (d.includes('hettich') || d.includes('hafele') || c.includes('hardware')) {
    return { budget: "Dorset/local — ~30% cheaper", premium: "Blum/Grass — ~25% higher" };
  }
  if (d.includes('century') || d.includes('ply') || c.includes('carpentry')) {
    return { budget: "Local BWR ply — ~20% cheaper", premium: "Greenply Marine/Ecowood — ~15% higher" };
  }
  if (d.includes('asian paints') || d.includes('emulsion') || c.includes('paint')) {
    return { budget: "Berger Bison — ~15% cheaper", premium: "Dulux Velvet Touch — ~10% higher" };
  }
  return null;
}

// Extracted editable BOQ row to keep JSX clean
function BOQEditRow({
  r, rowIdx, editedBoqRows, setEditedBoqRows, setBoqSaved, i,
}: {
  r: BOQRow;
  rowIdx: number;
  editedBoqRows: BOQRow[];
  setEditedBoqRows: React.Dispatch<React.SetStateAction<BOQRow[]>>;
  setBoqSaved: React.Dispatch<React.SetStateAction<boolean>>;
  i: number;
}) {
  const [showAlt, setShowAlt] = React.useState(false);
  const alts = getAltSuggestions(r.description, r.category);

  function update(field: keyof BOQRow, value: string | number) {
    const u = [...editedBoqRows];
    u[rowIdx] = { ...u[rowIdx], [field]: value };
    setEditedBoqRows(u);
    setBoqSaved(false);
  }
  return (
    <tr className={i % 2 === 0 ? "bg-white" : "bg-gray-50"}>
      <td className="px-1 py-0.5">
        <input className="w-full text-xs text-gray-500 border-0 bg-transparent focus:bg-white focus:ring-1 focus:ring-green-400 rounded px-2 py-1"
          value={r.category} onChange={(e) => update("category", e.target.value)} />
      </td>
      <td className="px-1 py-0.5">
        <input className="w-full text-xs border-0 bg-transparent focus:bg-white focus:ring-1 focus:ring-green-400 rounded px-2 py-1"
          value={r.description} onChange={(e) => update("description", e.target.value)} />
      </td>
      <td className="px-1 py-0.5">
        <input className="w-full text-xs text-center text-gray-500 border-0 bg-transparent focus:bg-white focus:ring-1 focus:ring-green-400 rounded px-1 py-1"
          value={r.unit} onChange={(e) => update("unit", e.target.value)} />
      </td>
      <td className="px-1 py-0.5">
        <input type="number" className="w-full text-xs text-right border-0 bg-transparent focus:bg-white focus:ring-1 focus:ring-green-400 rounded px-1 py-1"
          value={r.qty} onChange={(e) => update("qty", parseFloat(e.target.value) || 0)} />
      </td>
      <td className="px-1 py-0.5">
        <input type="number" className="w-full text-xs text-right border-0 bg-transparent focus:bg-white focus:ring-1 focus:ring-green-400 rounded px-1 py-1"
          value={r.rate} onChange={(e) => update("rate", parseFloat(e.target.value) || 0)} />
      </td>
      <td className="px-3 py-1.5 text-right font-medium text-green-800 text-xs">₹{(r.qty * r.rate).toLocaleString("en-IN")}</td>
      <td className="px-3 py-1.5 text-center">
        <span className={`text-xs px-1.5 py-0.5 rounded-full font-medium ${
          r.confidence === "high" ? "bg-green-100 text-green-800" :
          r.confidence === "medium" ? "bg-yellow-100 text-yellow-800" :
          "bg-red-100 text-red-700"
        }`}>{r.confidence ?? "—"}</span>
      </td>
      <td className="px-2 py-1.5 text-center relative">
        {alts && (
          <>
            <button
              className="text-xs text-gray-400 hover:text-green-700 px-1"
              title="Alternative materials"
              onClick={() => setShowAlt((v) => !v)}
            >⇄</button>
            {showAlt && (
              <div
                className="absolute right-0 z-10 mt-1 w-56 bg-white border border-gray-200 rounded-lg shadow-lg p-2 text-left"
                onMouseLeave={() => setShowAlt(false)}
              >
                <p className="text-xs font-semibold text-gray-500 mb-1">Alternatives</p>
                <p className="text-xs text-green-700 mb-1">💰 Budget: {alts.budget}</p>
                <p className="text-xs text-amber-700">✨ Premium: {alts.premium}</p>
              </div>
            )}
          </>
        )}
      </td>
    </tr>
  );
}
