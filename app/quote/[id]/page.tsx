import { loadProject } from "@/lib/db";
import QuoteForm from "./QuoteForm";

export default async function QuotePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const data = await loadProject(id);
  if (!data.project) return <div className="p-8 text-red-600">Project not found</div>;
  const p = data.project as { client_name: string; city: string };
  return (
    <main className="min-h-screen bg-gray-50">
      <div className="bg-green-900 text-white px-6 py-4">
        <h1 className="text-xl font-bold">HOUSPIRE — Contractor Quote</h1>
      </div>
      <div className="max-w-4xl mx-auto px-6 py-8">
        <h2 className="text-lg font-semibold mb-2">
          {p.client_name} · {p.city}
        </h2>
        <p className="text-sm text-gray-500 mb-6">
          Submit your price per category below. All quotes are confidential.
        </p>
        <QuoteForm projectId={id} boqRows={data.boq_rows} />
      </div>
    </main>
  );
}
