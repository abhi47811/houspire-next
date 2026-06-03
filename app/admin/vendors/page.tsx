"use client";

import { useState, useEffect } from "react";
import { CITIES } from "@/lib/config";

const CATEGORIES = [
  "Flooring", "Carpentry / Wardrobe", "Electrical",
  "Lighting / Fans", "Hardware", "HVAC", "Painting",
];

interface SeedResult {
  category: string;
  inserted: number;
  vendors?: Array<{ vendor: string; phone: string; rating: string }>;
  error?: string;
}

export default function VendorAdminPage() {
  const [accessGranted, setAccessGranted] = useState(false);
  const [city, setCity] = useState("Hyderabad");
  const [pincode, setPincode] = useState("");
  const [category, setCategory] = useState("Flooring");
  const [mode, setMode] = useState<"single" | "all">("single");
  const [loading, setLoading] = useState(false);
  const [results, setResults] = useState<SeedResult[]>([]);
  const [log, setLog] = useState<string[]>([]);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    setAccessGranted(params.get("key") === "houspire-admin-2026");
  }, []);

  if (!accessGranted) {
    return (
      <main className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="bg-white rounded-xl border border-red-200 p-8 text-center max-w-md">
          <p className="text-red-600 font-semibold text-lg mb-2">Access Denied</p>
          <p className="text-gray-500 text-sm">Add <code className="bg-gray-100 px-1 rounded">?key=houspire-admin-2026</code> to the URL.</p>
        </div>
      </main>
    );
  }

  async function runSeed() {
    setLoading(true);
    setResults([]);
    setLog([]);

    if (mode === "single") {
      setLog([`Searching Google Maps for ${category} vendors in ${city}…`]);
      const res = await fetch("/api/admin/seed-vendors", {
        method: "POST",
        headers: { "Content-Type": "application/json", "x-admin-key": "houspire-admin-2026" },
        body: JSON.stringify({ city, category, pincode: pincode || undefined }),
      });
      const data = await res.json() as SeedResult & { inserted?: number };
      setResults([{ category, inserted: data.inserted ?? 0, vendors: data.vendors, error: data.error }]);
      setLog([data.error ? `✗ ${data.error}` : `✓ ${data.inserted} real vendors saved for ${category} in ${city}`]);
    } else {
      const allResults: SeedResult[] = [];
      for (const cat of CATEGORIES) {
        setLog((prev) => [...prev, `Searching ${cat} in ${city}…`]);
        const res = await fetch("/api/admin/seed-vendors", {
          method: "POST",
          headers: { "Content-Type": "application/json", "x-admin-key": "houspire-admin-2026" },
          body: JSON.stringify({ city, category: cat, pincode: pincode || undefined }),
        });
        const data = await res.json() as SeedResult & { inserted?: number };
        const result = { category: cat, inserted: data.inserted ?? 0, vendors: data.vendors, error: data.error };
        allResults.push(result);
        setResults([...allResults]);
        setLog((prev) => [...prev, data.error ? `  ✗ ${cat}: ${data.error}` : `  ✓ ${cat}: ${data.inserted} vendors`]);
      }
    }
    setLoading(false);
  }

  const totalInserted = results.reduce((s, r) => s + r.inserted, 0);

  return (
    <main className="min-h-screen bg-gray-50">
      <div className="bg-green-900 text-white px-6 py-4 flex items-center gap-4">
        <a href="/" className="text-green-300 hover:text-white text-sm">← Home</a>
        <h1 className="text-xl font-bold">Vendor Data Admin</h1>
        <span className="text-xs bg-yellow-500 text-black px-2 py-0.5 rounded font-medium">Uses Claude web_search — costs API credits</span>
      </div>

      <div className="max-w-3xl mx-auto px-6 py-8 space-y-6">

        <div className="bg-amber-50 border border-amber-300 rounded-xl p-4 text-sm text-amber-800">
          <strong>What this does:</strong> Uses Claude + Google web search to find REAL vendors for each city+category.
          Replaces seed/unverified rows with actual Google Maps listings. Each category costs ~1 API call.
        </div>

        <div className="bg-white rounded-xl border border-gray-200 p-6 space-y-4">
          <h2 className="font-semibold text-gray-900">Seed Real Vendor Data</h2>

          <div className="grid grid-cols-3 gap-4">
            <div>
              <label className="block text-xs text-gray-500 mb-1">City</label>
              <select className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm"
                value={city} onChange={(e) => setCity(e.target.value)}>
                {CITIES.filter((c) => c !== "Other").map((c) => <option key={c}>{c}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-xs text-gray-500 mb-1">Pincode (optional)</label>
              <input className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm"
                placeholder="e.g. 500034"
                value={pincode} onChange={(e) => setPincode(e.target.value)} />
            </div>
            <div>
              <label className="block text-xs text-gray-500 mb-1">Mode</label>
              <select className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm"
                value={mode} onChange={(e) => setMode(e.target.value as "single" | "all")}>
                <option value="single">Single category</option>
                <option value="all">All 7 categories</option>
              </select>
            </div>
          </div>

          {mode === "single" && (
            <div>
              <label className="block text-xs text-gray-500 mb-1">Category</label>
              <select className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm"
                value={category} onChange={(e) => setCategory(e.target.value)}>
                {CATEGORIES.map((c) => <option key={c}>{c}</option>)}
              </select>
            </div>
          )}

          <button
            className="bg-green-900 text-white px-6 py-2.5 rounded-lg text-sm font-semibold hover:bg-green-800 disabled:opacity-50"
            disabled={loading}
            onClick={runSeed}
          >
            {loading ? "⏳ Searching Google Maps…" : `🔍 Fetch Real Vendors — ${mode === "all" ? "All 7 categories" : category}`}
          </button>
        </div>

        {log.length > 0 && (
          <div className="bg-gray-900 text-green-400 rounded-xl p-4 font-mono text-xs space-y-0.5">
            {log.map((l, i) => <div key={i}>{l}</div>)}
          </div>
        )}

        {results.length > 0 && (
          <div className="bg-white rounded-xl border border-gray-200 p-6 space-y-4">
            <div className="flex items-center justify-between">
              <h2 className="font-semibold text-gray-900">Results</h2>
              <span className="text-sm text-green-700 font-medium">{totalInserted} real vendors saved to DB</span>
            </div>
            {results.map((r, i) => (
              <div key={i} className={`border rounded-lg p-3 ${r.error ? "border-red-200 bg-red-50" : "border-green-200 bg-green-50"}`}>
                <div className="flex items-center justify-between mb-2">
                  <span className="text-sm font-medium">{r.category}</span>
                  {r.error
                    ? <span className="text-xs text-red-600">✗ {r.error}</span>
                    : <span className="text-xs text-green-700">✓ {r.inserted} vendors</span>}
                </div>
                {r.vendors && (
                  <div className="space-y-1">
                    {r.vendors.map((v, j) => (
                      <div key={j} className="text-xs text-gray-600 flex items-center gap-2">
                        <span className="font-medium">{v.vendor}</span>
                        <span className="text-gray-400">|</span>
                        <span>{v.phone}</span>
                        <span className="text-gray-400">|</span>
                        <span>{v.rating}</span>
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
