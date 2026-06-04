"use client";

import { useState, useEffect } from "react";
import { CITIES } from "@/lib/config";

interface VendorResult {
  vendor: string;
  phone: string;
  rating: string;
  area: string;
}

interface ZoneResult {
  zone: string;
  category: string;
  inserted: number;
  vendors?: VendorResult[];
  error?: string;
}

export default function VendorAdminPage() {
  const [accessGranted, setAccessGranted] = useState(false);
  const [city, setCity] = useState("Hyderabad");
  const [category, setCategory] = useState("");
  const [runAllCategories, setRunAllCategories] = useState(false);
  const [zones, setZones] = useState<string[]>([]);
  const [categories, setCategories] = useState<string[]>([]);
  const [selectedZones, setSelectedZones] = useState<string[]>([]);
  const [loading, setLoading] = useState(false);
  const [results, setResults] = useState<ZoneResult[]>([]);
  const [log, setLog] = useState<string[]>([]);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    setAccessGranted(params.get("key") === "houspire-admin-2026");
  }, []);

  // Load zones + categories when city changes
  useEffect(() => {
    if (!accessGranted) return;
    fetch(`/api/admin/seed-vendors?city=${encodeURIComponent(city)}`, {
      headers: { "x-admin-key": "houspire-admin-2026" },
    })
      .then((r) => r.json())
      .then((data: { zones: string[]; categories: string[] }) => {
        setZones(data.zones || []);
        setCategories(data.categories || []);
        setSelectedZones(data.zones?.slice(0, 4) || []);
        if (!category && data.categories?.length) setCategory(data.categories[0]);
      })
      .catch(() => {});
  }, [city, accessGranted]);

  if (!accessGranted) {
    return (
      <main className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="bg-white rounded-xl border border-red-200 p-8 text-center max-w-md">
          <p className="text-red-600 font-semibold text-lg mb-2">Access Denied</p>
          <p className="text-gray-500 text-sm">Add <code className="bg-gray-100 px-1 rounded">?key=houspire-admin-2026</code> to URL.</p>
        </div>
      </main>
    );
  }

  const totalInserted = results.reduce((s, r) => s + r.inserted, 0);

  async function seedOneCategory(cat: string, allResults: ZoneResult[]) {
    for (const zone of selectedZones) {
      setLog((prev) => [...prev, `→ [${cat}] ${zone}…`]);
      try {
        const res = await fetch("/api/admin/seed-vendors", {
          method: "POST",
          headers: { "Content-Type": "application/json", "x-admin-key": "houspire-admin-2026" },
          body: JSON.stringify({ city, category: cat, zone }),
        });
        const data = await res.json() as ZoneResult & { inserted?: number };
        const r: ZoneResult = { zone, category: cat, inserted: data.inserted ?? 0, vendors: data.vendors, error: data.error };
        allResults.push(r);
        setResults([...allResults]);
        setLog((prev) => [...prev, data.error
          ? `  ✗ ${zone}: ${data.error}`
          : `  ✓ ${zone}: ${data.inserted} vendors`]);
      } catch (e) {
        allResults.push({ zone, category: cat, inserted: 0, error: String(e) });
        setResults([...allResults]);
        setLog((prev) => [...prev, `  ✗ ${zone}: ${e}`]);
      }
    }
  }

  async function runSeed() {
    if (selectedZones.length === 0) return;
    const catsToRun = runAllCategories ? categories : (category ? [category] : []);
    if (catsToRun.length === 0) return;

    setLoading(true);
    setResults([]);
    setLog([`Seeding ${catsToRun.length} category(s) × ${selectedZones.length} zones in ${city}…`,
      `Estimated time: ~${Math.ceil(catsToRun.length * selectedZones.length * 0.5)} min`]);

    const allResults: ZoneResult[] = [];
    for (const cat of catsToRun) {
      setLog((prev) => [...prev, `\n── ${cat} ──`]);
      await seedOneCategory(cat, allResults);
    }
    setLog((prev) => [...prev, `\n✅ Done. ${allResults.reduce((s, r) => s + r.inserted, 0)} total vendors saved.`]);
    setLoading(false);
  }

  return (
    <main className="min-h-screen bg-gray-50">
      <div className="bg-green-900 text-white px-6 py-4 flex items-center gap-4">
        <a href="/" className="text-green-300 hover:text-white text-sm">← Home</a>
        <h1 className="text-xl font-bold">Vendor Data Admin</h1>
        <span className="text-xs bg-yellow-500 text-black px-2 py-0.5 rounded font-medium">Uses Claude web_search</span>
      </div>

      <div className="max-w-4xl mx-auto px-6 py-8 space-y-6">

        <div className="bg-amber-50 border border-amber-300 rounded-xl p-4 text-sm text-amber-800">
          <strong>How this works:</strong> Searches Justdial/Sulekha zone-by-zone within a city.
          Select 4-6 zones to get 20-30 vendors covering the whole city.
          Phones locked behind Justdial login are stored as Justdial URLs — users click through.
          Run once per category per city. ~1 API call per zone.
        </div>

        <div className="bg-white rounded-xl border border-gray-200 p-6 space-y-4">
          <h2 className="font-semibold text-gray-900">Seed Vendor Data</h2>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-xs text-gray-500 mb-1">City</label>
              <select className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm"
                value={city} onChange={(e) => setCity(e.target.value)}>
                {CITIES.filter((c) => c !== "Other").map((c) => <option key={c}>{c}</option>)}
              </select>
            </div>
            <div>
              <div className="flex items-center justify-between mb-1">
                <label className="text-xs text-gray-500">Category ({categories.length} available)</label>
                <label className="flex items-center gap-1.5 cursor-pointer">
                  <input type="checkbox" className="accent-green-700"
                    checked={runAllCategories} onChange={(e) => setRunAllCategories(e.target.checked)} />
                  <span className="text-xs font-medium text-green-800">All {categories.length} categories</span>
                </label>
              </div>
              {!runAllCategories && (
                <select className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm"
                  value={category} onChange={(e) => setCategory(e.target.value)}>
                  {categories.map((c) => <option key={c}>{c}</option>)}
                </select>
              )}
              {runAllCategories && (
                <div className="w-full border border-green-300 bg-green-50 rounded-lg px-3 py-2 text-sm text-green-800">
                  Will run all {categories.length} categories × {selectedZones.length} zones
                  <span className="ml-2 text-xs text-green-600">~{Math.ceil(categories.length * selectedZones.length * 0.5)} min</span>
                </div>
              )}
            </div>
          </div>

          {/* Zone selector */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <label className="text-xs text-gray-500">
                City Zones ({selectedZones.length}/{zones.length} selected)
              </label>
              <div className="flex gap-2">
                <button onClick={() => setSelectedZones([...zones])}
                  className="text-xs text-green-700 hover:underline">Select All</button>
                <span className="text-gray-300">|</span>
                <button onClick={() => setSelectedZones([])}
                  className="text-xs text-gray-500 hover:underline">Clear</button>
              </div>
            </div>
            <div className="flex flex-wrap gap-2">
              {zones.map((z) => (
                <button key={z}
                  onClick={() => setSelectedZones((prev) =>
                    prev.includes(z) ? prev.filter((x) => x !== z) : [...prev, z]
                  )}
                  className={`text-xs px-3 py-1.5 rounded-full border font-medium transition-colors ${
                    selectedZones.includes(z)
                      ? "bg-green-900 text-white border-green-900"
                      : "bg-white text-gray-600 border-gray-300 hover:border-green-600"
                  }`}
                >
                  {z}
                </button>
              ))}
            </div>
          </div>

          <button
            className="bg-green-900 text-white px-6 py-2.5 rounded-lg text-sm font-semibold hover:bg-green-800 disabled:opacity-50"
            disabled={loading || (!runAllCategories && !category) || selectedZones.length === 0}
            onClick={runSeed}
          >
            {loading
              ? `⏳ ${results.length} zones done…`
              : runAllCategories
                ? `🔍 Seed ALL ${categories.length} categories × ${selectedZones.length} zones in ${city}`
                : `🔍 Seed ${category} in ${selectedZones.length} zones`}
          </button>
        </div>

        {/* Log */}
        {log.length > 0 && (
          <div className="bg-gray-900 text-green-400 rounded-xl p-4 font-mono text-xs space-y-0.5 max-h-48 overflow-y-auto">
            {log.map((l, i) => <div key={i}>{l}</div>)}
          </div>
        )}

        {/* Results */}
        {results.length > 0 && (
          <div className="bg-white rounded-xl border border-gray-200 p-6 space-y-3">
            <div className="flex items-center justify-between">
              <h2 className="font-semibold text-gray-900">{category} — {city}</h2>
              <span className="text-sm text-green-700 font-medium">{totalInserted} vendors saved to DB</span>
            </div>
            {results.map((r, i) => (
              <div key={i} className={`border rounded-lg p-3 ${r.error ? "border-red-200 bg-red-50" : "border-green-200 bg-green-50"}`}>
                <div className="flex items-center justify-between mb-1">
                  <span className="text-sm font-medium">{r.zone}</span>
                  {r.error
                    ? <span className="text-xs text-red-600">✗ {r.error}</span>
                    : <span className="text-xs text-green-700">✓ {r.inserted} vendors</span>}
                </div>
                {r.vendors && (
                  <div className="space-y-0.5 mt-1">
                    {r.vendors.map((v, j) => (
                      <div key={j} className="text-xs text-gray-600 flex items-center gap-2 flex-wrap">
                        <span className="font-medium">{v.vendor}</span>
                        <span className="text-gray-400">·</span>
                        <span>{v.area}</span>
                        <span className="text-gray-400">·</span>
                        <span className="text-green-700">{v.phone}</span>
                        {v.rating && <span className="text-gray-400">· {v.rating}</span>}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    </main>
  );
}
