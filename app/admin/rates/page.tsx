"use client";

import { useState } from "react";

const CATEGORIES = [
  "Carpentry / Ceiling", "Flooring / Walls", "Lighting",
  "Electrical", "HVAC", "Hardware", "Textiles / Decor", "Bathroom",
];

interface VerifyResult {
  item: string;
  found: boolean;
  rate_min?: number;
  rate_max?: number;
  source_url?: string;
  notes?: string;
  error?: string;
}

export default function RatesAdminPage() {
  const [category, setCategory] = useState("Flooring / Walls");
  const [loading, setLoading] = useState(false);
  const [results, setResults] = useState<VerifyResult[]>([]);
  const [log, setLog] = useState<string[]>([]);

  async function runVerify() {
    setLoading(true);
    setResults([]);
    setLog([`Searching live prices for ${category}…`]);

    const res = await fetch(`/api/admin/verify-rates?category=${encodeURIComponent(category)}`);
    const data = await res.json() as { results: VerifyResult[] };
    setResults(data.results ?? []);
    const found = (data.results ?? []).filter((r) => r.found).length;
    setLog([`✓ ${found}/${data.results?.length ?? 0} items updated with live prices`]);
    setLoading(false);
  }

  const verified = results.filter((r) => r.found).length;

  return (
    <main className="min-h-screen bg-gray-50">
      <div className="bg-green-900 text-white px-6 py-4 flex items-center gap-4">
        <a href="/" className="text-green-300 hover:text-white text-sm">← Home</a>
        <h1 className="text-xl font-bold">Rate Verification Admin</h1>
        <span className="text-xs bg-yellow-500 text-black px-2 py-0.5 rounded font-medium">Uses Claude web_search</span>
      </div>

      <div className="max-w-3xl mx-auto px-6 py-8 space-y-6">
        <div className="bg-amber-50 border border-amber-300 rounded-xl p-4 text-sm text-amber-800">
          <strong>What this does:</strong> Searches brand websites (Kajaria, Hettich, Atomberg, Asian Paints etc.)
          for current 2025-26 India prices. Updates the rates table with verified figures and source URLs.
        </div>

        <div className="bg-white rounded-xl border border-gray-200 p-6 space-y-4">
          <h2 className="font-semibold text-gray-900">Verify Rates by Category</h2>
          <div className="flex gap-4 items-end">
            <div className="flex-1">
              <label className="block text-xs text-gray-500 mb-1">Category</label>
              <select className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm"
                value={category} onChange={(e) => setCategory(e.target.value)}>
                {CATEGORIES.map((c) => <option key={c}>{c}</option>)}
              </select>
            </div>
            <button
              className="bg-green-900 text-white px-6 py-2 rounded-lg text-sm font-semibold hover:bg-green-800 disabled:opacity-50"
              disabled={loading} onClick={runVerify}>
              {loading ? "⏳ Verifying…" : "🔍 Verify Live Prices"}
            </button>
          </div>
        </div>

        {log.length > 0 && (
          <div className="bg-gray-900 text-green-400 rounded-xl p-4 font-mono text-xs">
            {log.map((l, i) => <div key={i}>{l}</div>)}
          </div>
        )}

        {results.length > 0 && (
          <div className="bg-white rounded-xl border border-gray-200 p-6">
            <div className="flex items-center justify-between mb-4">
              <h2 className="font-semibold text-gray-900">Results — {category}</h2>
              <span className="text-sm text-green-700 font-medium">{verified}/{results.length} updated</span>
            </div>
            <div className="space-y-2">
              {results.map((r, i) => (
                <div key={i} className={`border rounded-lg p-3 text-sm ${r.found ? "border-green-200 bg-green-50" : "border-gray-200"}`}>
                  <div className="flex items-start justify-between gap-2">
                    <span className="font-medium text-gray-900">{r.item}</span>
                    {r.found
                      ? <span className="text-xs text-green-700 whitespace-nowrap">₹{r.rate_min?.toLocaleString("en-IN")}–{r.rate_max?.toLocaleString("en-IN")}</span>
                      : <span className="text-xs text-gray-400">not found</span>}
                  </div>
                  {r.notes && <p className="text-xs text-gray-500 mt-1">{r.notes}</p>}
                  {r.source_url && (
                    <a href={r.source_url} target="_blank" rel="noopener noreferrer"
                      className="text-xs text-blue-600 hover:underline mt-1 block truncate">
                      {r.source_url}
                    </a>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </main>
  );
}
