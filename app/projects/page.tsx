import { listProjects } from "@/lib/db";

export const dynamic = "force-dynamic";

export default async function ProjectsPage() {
  const projects = await listProjects();

  return (
    <main className="min-h-screen bg-gray-50">
      <div className="bg-white border-b border-gray-200 px-6 py-4 flex items-center justify-between">
        <div className="flex items-center gap-4">
          <a href="/" className="text-green-700 hover:underline text-sm">← Back</a>
          <h1 className="text-2xl font-bold text-green-900">📁 Past Projects</h1>
        </div>
        <a href="/projects/compare" className="text-sm bg-green-900 text-white px-4 py-2 rounded-lg hover:bg-green-800">⚖️ Compare</a>
      </div>

      <div className="max-w-5xl mx-auto px-6 py-8">
        {projects.length === 0 ? (
          <div className="bg-white rounded-xl border border-gray-200 p-12 text-center">
            <p className="text-gray-400 text-lg mb-2">No saved projects yet.</p>
            <a href="/" className="mt-4 inline-block text-sm text-green-700 hover:underline">Generate your first project →</a>
          </div>
        ) : (
          <div className="space-y-3">
            {projects.map((p) => (
              <div key={p.id} className="bg-white rounded-xl border border-gray-200 p-5">
                {/* Project header */}
                <div className="flex items-start justify-between mb-4">
                  <div>
                    <h3 className="font-semibold text-gray-900 text-lg">{p.client_name}</h3>
                    <p className="text-sm text-gray-500 mt-0.5">
                      {p.city} · {p.tier} · {new Date(p.created_at).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" })}
                      {p.status && p.status !== "draft" && (
                        <span className={`ml-2 text-xs px-2 py-0.5 rounded-full font-medium ${p.status === "approved" ? "bg-green-100 text-green-700" : "bg-yellow-100 text-yellow-700"}`}>
                          {p.status}
                        </span>
                      )}
                    </p>
                  </div>
                  {/* Redo / Edit button */}
                  <a
                    href={`/?reload=${p.id}&client=${encodeURIComponent(p.client_name)}&city=${encodeURIComponent(p.city)}&pincode=${encodeURIComponent(p.pincode)}&tier=${encodeURIComponent(p.tier)}`}
                    className="text-sm border border-green-700 text-green-700 px-4 py-2 rounded-lg hover:bg-green-50 font-medium"
                  >
                    ✏️ Edit / Redo
                  </a>
                </div>

                {/* Action buttons */}
                <div className="flex flex-wrap gap-2">
                  <a href={`/api/download/boq?id=${p.id}`} download
                    className="text-sm bg-green-800 text-white px-3 py-1.5 rounded-lg hover:bg-green-700">
                    📊 BOQ Excel
                  </a>
                  <a href={`/api/download/vendors?id=${p.id}`} download
                    className="text-sm bg-green-700 text-white px-3 py-1.5 rounded-lg hover:bg-green-600">
                    📍 Vendors Excel
                  </a>
                  <a href={`/api/download/boq-pdf?id=${p.id}`} download
                    className="text-sm bg-amber-600 text-white px-3 py-1.5 rounded-lg hover:bg-amber-500">
                    📑 BOQ PDF
                  </a>
                  <a href={`/api/download/vendors-pdf?id=${p.id}`} download
                    className="text-sm bg-amber-500 text-white px-3 py-1.5 rounded-lg hover:bg-amber-400">
                    📋 Vendor PDF
                  </a>
                  <a href={`/approve/${p.id}`} target="_blank"
                    className="text-sm bg-blue-600 text-white px-3 py-1.5 rounded-lg hover:bg-blue-500">
                    🔗 Approval Link
                  </a>
                  <a href={`/api/download/work-order?id=${p.id}&phase=all`} download
                    className="text-sm bg-gray-600 text-white px-3 py-1.5 rounded-lg hover:bg-gray-500">
                    📋 Work Order
                  </a>
                  <a href={`/quote/${p.id}`} target="_blank"
                    className="text-sm bg-purple-600 text-white px-3 py-1.5 rounded-lg hover:bg-purple-500">
                    💼 Contractor Quote
                  </a>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </main>
  );
}
