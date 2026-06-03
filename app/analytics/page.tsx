import { getSupabaseClient } from "@/lib/supabase";
import Link from "next/link";

interface Project {
  id: string;
  client_name: string;
  city: string;
  tier: string;
  created_at: string;
}

interface BOQRowRaw {
  project_id: string;
  qty: number;
  rate: number;
}

async function getAnalyticsData() {
  const db = getSupabaseClient();
  const [projRes, boqRes] = await Promise.all([
    db.from("projects").select("id, client_name, city, tier, created_at").order("created_at", { ascending: false }),
    db.from("boq_rows").select("project_id, qty, rate"),
  ]);

  const projects = (projRes.data ?? []) as Project[];
  const boqRows = (boqRes.data ?? []) as BOQRowRaw[];

  // Compute per-project totals
  const totalsMap: Record<string, number> = {};
  for (const r of boqRows) {
    totalsMap[r.project_id] = (totalsMap[r.project_id] ?? 0) + r.qty * r.rate;
  }

  const projectsWithTotals = projects.map((p) => ({
    ...p,
    total: totalsMap[p.id] ?? 0,
  }));

  const totalEstimated = projectsWithTotals.reduce((s, p) => s + p.total, 0);
  const avgPerProject = projects.length > 0 ? totalEstimated / projects.length : 0;

  // City breakdown
  const cityMap: Record<string, { count: number; total: number }> = {};
  for (const p of projectsWithTotals) {
    if (!cityMap[p.city]) cityMap[p.city] = { count: 0, total: 0 };
    cityMap[p.city].count++;
    cityMap[p.city].total += p.total;
  }
  const topCities = Object.entries(cityMap)
    .sort((a, b) => b[1].total - a[1].total)
    .slice(0, 5);
  const maxCityTotal = topCities[0]?.[1].total ?? 1;

  return { projects: projectsWithTotals, totalEstimated, avgPerProject, topCities, maxCityTotal };
}

export default async function AnalyticsPage() {
  const { projects, totalEstimated, avgPerProject, topCities, maxCityTotal } = await getAnalyticsData();
  const recent = projects.slice(0, 10);

  return (
    <main className="min-h-screen bg-gray-50">
      <div className="bg-green-900 text-white px-6 py-4 flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold tracking-wide">HOUSPIRE</h1>
          <p className="text-xs text-green-300">Analytics Dashboard</p>
        </div>
        <div className="flex gap-3">
          <Link href="/projects" className="text-sm bg-green-700 hover:bg-green-600 px-4 py-2 rounded-lg font-medium">
            📁 Past Projects
          </Link>
          <Link href="/" className="text-sm bg-green-700 hover:bg-green-600 px-4 py-2 rounded-lg font-medium">
            ← Home
          </Link>
        </div>
      </div>

      <div className="max-w-5xl mx-auto px-6 py-8 space-y-6">
        {/* KPI Cards */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="bg-white rounded-xl border border-gray-200 p-6">
            <p className="text-xs text-gray-500 font-medium uppercase tracking-wide">Total Projects</p>
            <p className="text-3xl font-bold text-green-900 mt-1">{projects.length}</p>
          </div>
          <div className="bg-white rounded-xl border border-gray-200 p-6">
            <p className="text-xs text-gray-500 font-medium uppercase tracking-wide">Total Estimated Value</p>
            <p className="text-3xl font-bold text-green-900 mt-1">
              ₹{(totalEstimated / 1_00_000).toFixed(1)}L
            </p>
          </div>
          <div className="bg-white rounded-xl border border-gray-200 p-6">
            <p className="text-xs text-gray-500 font-medium uppercase tracking-wide">Avg per Project</p>
            <p className="text-3xl font-bold text-green-900 mt-1">
              ₹{(avgPerProject / 1_00_000).toFixed(1)}L
            </p>
          </div>
        </div>

        {/* City breakdown */}
        {topCities.length > 0 && (
          <section className="bg-white rounded-xl border border-gray-200 p-6">
            <h2 className="text-base font-semibold text-gray-900 mb-4">Top Cities by Value</h2>
            <div className="space-y-3">
              {topCities.map(([city, stat]) => {
                const pct = Math.round((stat.total / maxCityTotal) * 100);
                return (
                  <div key={city}>
                    <div className="flex items-center justify-between text-sm mb-1">
                      <span className="font-medium text-gray-700">{city}</span>
                      <span className="text-gray-500">{stat.count} project{stat.count !== 1 ? "s" : ""} · ₹{(stat.total / 1_00_000).toFixed(1)}L</span>
                    </div>
                    <div className="w-full bg-gray-100 rounded-full h-4">
                      <div
                        className="bg-green-700 h-4 rounded-full"
                        style={{ width: `${pct}%` }}
                      />
                    </div>
                  </div>
                );
              })}
            </div>
          </section>
        )}

        {/* Recent projects table */}
        <section className="bg-white rounded-xl border border-gray-200 p-6">
          <h2 className="text-base font-semibold text-gray-900 mb-4">Recent Projects</h2>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-green-900 text-white">
                  <th className="px-4 py-2.5 text-left font-medium rounded-tl-lg">Client</th>
                  <th className="px-4 py-2.5 text-left font-medium">City</th>
                  <th className="px-4 py-2.5 text-left font-medium">Tier</th>
                  <th className="px-4 py-2.5 text-right font-medium">Est. Value</th>
                  <th className="px-4 py-2.5 text-left font-medium rounded-tr-lg">Date</th>
                </tr>
              </thead>
              <tbody>
                {recent.map((p, i) => (
                  <tr key={p.id} className={i % 2 === 0 ? "bg-white" : "bg-gray-50"}>
                    <td className="px-4 py-2.5 font-medium text-gray-900">
                      <Link href={`/approve/${p.id}`} className="hover:text-green-700 hover:underline">
                        {p.client_name}
                      </Link>
                    </td>
                    <td className="px-4 py-2.5 text-gray-600">{p.city}</td>
                    <td className="px-4 py-2.5 text-gray-600">{p.tier}</td>
                    <td className="px-4 py-2.5 text-right font-semibold text-green-800">
                      {p.total > 0 ? `₹${(p.total / 1_00_000).toFixed(1)}L` : "—"}
                    </td>
                    <td className="px-4 py-2.5 text-gray-500 text-xs">
                      {new Date(p.created_at).toLocaleDateString("en-IN")}
                    </td>
                  </tr>
                ))}
                {recent.length === 0 && (
                  <tr>
                    <td colSpan={5} className="px-4 py-8 text-center text-gray-400">No projects yet</td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </section>
      </div>
    </main>
  );
}
