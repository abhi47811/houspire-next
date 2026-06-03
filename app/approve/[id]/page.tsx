import { getSupabaseClient } from "@/lib/supabase";
import type { BOQRow, VendorRow } from "@/lib/types";
import { ApproveButton } from "./ApproveButton";

interface PageProps {
  params: Promise<{ id: string }>;
}

async function getProject(id: string) {
  const db = getSupabaseClient();
  const [proj, boq, vnd] = await Promise.all([
    db.from("projects").select("*").eq("id", id).single(),
    db.from("boq_rows").select("*").eq("project_id", id),
    db.from("vendors").select("*").eq("project_id", id),
  ]);
  return {
    project: proj.data as Record<string, string> | null,
    boqRows: (boq.data ?? []) as BOQRow[],
    vendors: (vnd.data ?? []) as VendorRow[],
  };
}

export default async function ApprovePage({ params }: PageProps) {
  const { id } = await params;
  const { project, boqRows, vendors } = await getProject(id);

  if (!project) {
    return (
      <main className="min-h-screen bg-gray-50 flex items-center justify-center">
        <p className="text-gray-500">Project not found.</p>
      </main>
    );
  }

  const total = boqRows.reduce((s, r) => s + r.qty * r.rate, 0);
  const isApproved = project.status === "approved";

  return (
    <main className="min-h-screen bg-gray-50">
      {/* Header */}
      <div className="bg-green-900 text-white px-6 py-4">
        <h1 className="text-xl font-bold tracking-wide">HOUSPIRE</h1>
        <p className="text-xs text-green-300">Budget Approval</p>
      </div>

      <div className="max-w-5xl mx-auto px-6 py-8 space-y-6">
        {/* Project info */}
        <section className="bg-white rounded-xl border border-gray-200 p-6">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-lg font-semibold text-gray-900">{project.client_name}</h2>
              <p className="text-sm text-gray-500">{project.city} · {project.pincode} · {project.tier}</p>
            </div>
            {isApproved ? (
              <span className="bg-green-100 text-green-800 text-sm font-semibold px-4 py-2 rounded-full">
                Approved ✓
              </span>
            ) : (
              <ApproveButton id={id} />
            )}
          </div>
        </section>

        {/* BOQ Table */}
        {boqRows.length > 0 && (
          <section className="bg-white rounded-xl border border-gray-200 p-6">
            <h2 className="text-base font-semibold text-gray-900 mb-4">
              Bill of Quantities ({boqRows.length} items)
            </h2>
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
                      <td className="px-3 py-1.5 text-xs text-gray-500">{r.category}</td>
                      <td className="px-3 py-1.5 text-xs">{r.description}</td>
                      <td className="px-3 py-1.5 text-xs text-center text-gray-500">{r.unit}</td>
                      <td className="px-3 py-1.5 text-xs text-right">{r.qty}</td>
                      <td className="px-3 py-1.5 text-xs text-right">{r.rate.toLocaleString("en-IN")}</td>
                      <td className="px-3 py-1.5 text-xs text-right font-medium text-green-800">
                        ₹{(r.qty * r.rate).toLocaleString("en-IN")}
                      </td>
                    </tr>
                  ))}
                </tbody>
                <tfoot>
                  <tr className="bg-green-900 text-white">
                    <td colSpan={5} className="px-3 py-2.5 font-semibold text-right">Total</td>
                    <td className="px-3 py-2.5 font-bold text-right">
                      ₹{Math.round(total).toLocaleString("en-IN")}
                    </td>
                  </tr>
                </tfoot>
              </table>
            </div>
          </section>
        )}

        {/* Vendor list */}
        {vendors.length > 0 && (
          <section className="bg-white rounded-xl border border-gray-200 p-6">
            <h2 className="text-base font-semibold text-gray-900 mb-4">
              Local Vendors ({vendors.length})
            </h2>
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
                      <td className="px-3 py-1.5 text-xs text-gray-500">{v.category}</td>
                      <td className="px-3 py-1.5 text-xs font-medium">{v.vendor}</td>
                      <td className="px-3 py-1.5 text-xs text-gray-500">{v.specialty}</td>
                      <td className="px-3 py-1.5 text-xs text-gray-500">{v.area}</td>
                      <td className="px-3 py-1.5 text-xs text-center">{v.rating}</td>
                      <td className="px-3 py-1.5 text-xs">{v.phone}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>
        )}

        <p className="text-xs text-gray-400 text-center pb-4">
          Powered by Houspire · All rates are indicative for {project.city} market (2025-26)
        </p>
      </div>
    </main>
  );
}
