import { loadProject, listProjects } from "@/lib/db";
import type { BOQRow } from "@/lib/types";

export const dynamic = "force-dynamic";

export default async function ComparePage({
  searchParams,
}: {
  searchParams: Promise<{ a?: string; b?: string }>;
}) {
  const { a, b } = await searchParams;

  const projects = await listProjects();

  if (!a || !b) {
    return (
      <main className="min-h-screen bg-gray-50">
        <div className="bg-green-900 text-white px-6 py-4 flex items-center gap-4">
          <a href="/projects" className="text-green-300 hover:text-white text-sm">← Projects</a>
          <h1 className="text-xl font-bold">Compare Projects</h1>
        </div>
        <div className="max-w-3xl mx-auto px-6 py-8">
          <div className="bg-white rounded-xl border border-gray-200 p-6">
            <p className="text-sm text-gray-500 mb-4">Select two projects to compare:</p>
            <form method="GET" className="flex gap-4 items-end">
              <div className="flex-1">
                <label className="block text-xs text-gray-500 mb-1">Project A</label>
                <select name="a" className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm">
                  {projects.map((p) => <option key={p.id} value={p.id}>{p.client_name} · {p.city} · {p.created_at.slice(0, 10)}</option>)}
                </select>
              </div>
              <div className="flex-1">
                <label className="block text-xs text-gray-500 mb-1">Project B</label>
                <select name="b" className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm">
                  {projects.map((p) => <option key={p.id} value={p.id}>{p.client_name} · {p.city} · {p.created_at.slice(0, 10)}</option>)}
                </select>
              </div>
              <button type="submit" className="bg-green-900 text-white px-6 py-2 rounded-lg text-sm font-medium hover:bg-green-800">Compare →</button>
            </form>
          </div>
        </div>
      </main>
    );
  }

  const [dataA, dataB] = await Promise.all([loadProject(a), loadProject(b)]);
  if (!dataA.project || !dataB.project) {
    return <main className="p-8 text-red-600">One or both projects not found.</main>;
  }

  const pA = dataA.project as { client_name: string; city: string; tier: string };
  const pB = dataB.project as { client_name: string; city: string; tier: string };

  const totalA = dataA.boq_rows.reduce((s: number, r: BOQRow) => s + r.qty * r.rate, 0);
  const totalB = dataB.boq_rows.reduce((s: number, r: BOQRow) => s + r.qty * r.rate, 0);

  // Find categories present in both
  const catsA = new Set(dataA.boq_rows.map((r: BOQRow) => r.category));
  const catsB = new Set(dataB.boq_rows.map((r: BOQRow) => r.category));
  const allCats = [...new Set([...catsA, ...catsB])].sort();

  function catTotal(rows: BOQRow[], cat: string) {
    return rows.filter((r) => r.category === cat).reduce((s, r) => s + r.qty * r.rate, 0);
  }

  return (
    <main className="min-h-screen bg-gray-50">
      <div className="bg-green-900 text-white px-6 py-4 flex items-center gap-4">
        <a href="/projects" className="text-green-300 hover:text-white text-sm">← Projects</a>
        <h1 className="text-xl font-bold">Compare Projects</h1>
      </div>

      <div className="max-w-5xl mx-auto px-6 py-8 space-y-6">
        {/* Summary */}
        <div className="grid grid-cols-2 gap-4">
          {[
            { p: pA, total: totalA, rows: dataA.boq_rows.length, label: "A" },
            { p: pB, total: totalB, rows: dataB.boq_rows.length, label: "B" },
          ].map(({ p, total, rows, label }) => (
            <div key={label} className="bg-white rounded-xl border border-gray-200 p-5">
              <div className="text-xs text-gray-400 mb-1">Project {label}</div>
              <div className="font-bold text-gray-900 text-lg">{p.client_name}</div>
              <div className="text-sm text-gray-500">{p.city} · {p.tier}</div>
              <div className="mt-3 text-2xl font-bold text-green-900">₹{Math.round(total).toLocaleString("en-IN")}</div>
              <div className="text-xs text-gray-400">{rows} line items</div>
            </div>
          ))}
        </div>

        <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 text-sm">
          Difference: <strong className="text-green-900">₹{Math.abs(Math.round(totalA - totalB)).toLocaleString("en-IN")}</strong>
          {" "}({totalA > totalB ? "A is higher" : "B is higher"} by {Math.round(Math.abs((totalA - totalB) / Math.max(totalA, totalB)) * 100)}%)
        </div>

        {/* Category comparison */}
        <div className="bg-white rounded-xl border border-gray-200 p-6">
          <h2 className="text-base font-semibold text-gray-900 mb-4">By Category</h2>
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-green-900 text-white">
                <th className="px-3 py-2.5 text-left font-medium">Category</th>
                <th className="px-3 py-2.5 text-right font-medium">{pA.client_name} (₹)</th>
                <th className="px-3 py-2.5 text-right font-medium">{pB.client_name} (₹)</th>
                <th className="px-3 py-2.5 text-right font-medium">Diff</th>
              </tr>
            </thead>
            <tbody>
              {allCats.map((cat, i) => {
                const tA = catTotal(dataA.boq_rows, cat);
                const tB = catTotal(dataB.boq_rows, cat);
                const diff = tA - tB;
                const onlyA = tA > 0 && tB === 0;
                const onlyB = tB > 0 && tA === 0;
                return (
                  <tr key={cat} className={`${i % 2 === 0 ? "bg-white" : "bg-gray-50"} ${onlyA ? "border-l-4 border-blue-400" : onlyB ? "border-l-4 border-orange-400" : ""}`}>
                    <td className="px-3 py-2 text-gray-700">{cat}</td>
                    <td className="px-3 py-2 text-right">{tA > 0 ? tA.toLocaleString("en-IN") : <span className="text-gray-300">—</span>}</td>
                    <td className="px-3 py-2 text-right">{tB > 0 ? tB.toLocaleString("en-IN") : <span className="text-gray-300">—</span>}</td>
                    <td className={`px-3 py-2 text-right font-medium ${diff > 0 ? "text-red-600" : diff < 0 ? "text-green-600" : "text-gray-400"}`}>
                      {diff !== 0 ? (diff > 0 ? "+" : "") + diff.toLocaleString("en-IN") : "—"}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
          <div className="mt-2 text-xs text-gray-400">Blue border = only in A · Orange border = only in B</div>
        </div>
      </div>
    </main>
  );
}
