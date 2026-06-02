import { listProjects } from "@/lib/db";

export const dynamic = "force-dynamic";

export default async function ProjectsPage() {
  const projects = await listProjects();

  return (
    <main className="min-h-screen bg-gray-50">
      <div className="bg-white border-b border-gray-200 px-6 py-4 flex items-center gap-4">
        <a href="/" className="text-green-700 hover:underline text-sm">← Back</a>
        <h1 className="text-2xl font-bold text-green-900">📁 Past Projects</h1>
      </div>

      <div className="max-w-4xl mx-auto px-6 py-8">
        {projects.length === 0 ? (
          <div className="bg-white rounded-xl border border-gray-200 p-12 text-center">
            <p className="text-gray-400">No saved projects yet.</p>
            <a href="/" className="mt-4 inline-block text-sm text-green-700 hover:underline">Generate your first project →</a>
          </div>
        ) : (
          <div className="space-y-3">
            {projects.map((p) => (
              <div key={p.id} className="bg-white rounded-xl border border-gray-200 p-5 flex items-center justify-between">
                <div>
                  <h3 className="font-semibold text-gray-900">{p.client_name}</h3>
                  <p className="text-sm text-gray-500">{p.city} · {p.tier} · {new Date(p.created_at).toLocaleDateString("en-IN")}</p>
                </div>
                <div className="flex items-center gap-3">
                  <a
                    href={`/api/download/boq?id=${p.id}`}
                    className="text-sm bg-green-800 text-white px-4 py-2 rounded-lg hover:bg-green-700"
                    download
                  >
                    📊 BOQ Excel
                  </a>
                  <a
                    href={`/api/download/vendors?id=${p.id}`}
                    className="text-sm bg-green-700 text-white px-4 py-2 rounded-lg hover:bg-green-600"
                    download
                  >
                    📍 Vendors Excel
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
