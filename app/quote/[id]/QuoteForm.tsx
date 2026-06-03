"use client";
import { useState } from "react";
import type { BOQRow } from "@/lib/types";

interface Props {
  projectId: string;
  boqRows: BOQRow[];
}

export default function QuoteForm({ projectId, boqRows }: Props) {
  const [contractorName, setContractorName] = useState("");
  const [companyName, setCompanyName] = useState("");
  // Category-level quotes: { [category]: price }
  const categories = Array.from(new Set(boqRows.map((r) => r.category)));
  const [quotes, setQuotes] = useState<Record<string, string>>({});
  const [submitted, setSubmitted] = useState(false);
  const [error, setError] = useState("");

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const lineItemQuotes = categories.map((cat) => ({
      category: cat,
      quoted_price: parseFloat(quotes[cat] ?? "0") || 0,
    }));
    const res = await fetch("/api/quotes", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        project_id: projectId,
        contractor_name: contractorName,
        company_name: companyName,
        line_item_quotes: lineItemQuotes,
      }),
    });
    if (res.ok) setSubmitted(true);
    else setError("Submission failed — please try again.");
  }

  if (submitted) {
    return (
      <div className="bg-green-50 border border-green-200 rounded-xl p-8 text-center">
        <p className="text-green-900 font-semibold text-lg">Quote submitted successfully!</p>
        <p className="text-sm text-green-700 mt-2">Houspire will review and get back to you.</p>
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div>
          <label className="block text-xs font-medium text-gray-600 mb-1">Your Name *</label>
          <input
            type="text"
            required
            value={contractorName}
            onChange={(e) => setContractorName(e.target.value)}
            className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm"
            placeholder="e.g. Ravi Kumar"
          />
        </div>
        <div>
          <label className="block text-xs font-medium text-gray-600 mb-1">Company Name</label>
          <input
            type="text"
            value={companyName}
            onChange={(e) => setCompanyName(e.target.value)}
            className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm"
            placeholder="e.g. Kumar Interiors"
          />
        </div>
      </div>

      <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
        <table className="w-full text-sm">
          <thead>
            <tr className="bg-green-900 text-white">
              <th className="px-4 py-3 text-left font-semibold">Category</th>
              <th className="px-4 py-3 text-left font-semibold">Items</th>
              <th className="px-4 py-3 text-left font-semibold">Your Quote (₹)</th>
            </tr>
          </thead>
          <tbody>
            {categories.map((cat, i) => {
              const items = boqRows.filter((r) => r.category === cat);
              return (
                <tr key={cat} className={i % 2 === 0 ? "bg-white" : "bg-gray-50"}>
                  <td className="px-4 py-3 font-medium text-gray-800">{cat}</td>
                  <td className="px-4 py-3 text-gray-500 text-xs">{items.length} item(s)</td>
                  <td className="px-4 py-3">
                    <input
                      type="number"
                      min="0"
                      placeholder="0"
                      value={quotes[cat] ?? ""}
                      onChange={(e) => setQuotes((prev) => ({ ...prev, [cat]: e.target.value }))}
                      className="w-36 border border-gray-300 rounded px-2 py-1 text-sm"
                    />
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {error && <p className="text-red-600 text-sm">{error}</p>}

      <button
        type="submit"
        disabled={!contractorName}
        className="bg-green-900 text-white px-8 py-3 rounded-lg text-sm font-semibold hover:bg-green-800 disabled:opacity-50 disabled:cursor-not-allowed"
      >
        Submit Quote
      </button>
    </form>
  );
}
