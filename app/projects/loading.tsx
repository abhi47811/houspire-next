export default function Loading() {
  return (
    <main className="min-h-screen bg-gray-50">
      <div className="bg-white border-b border-gray-200 px-6 py-4">
        <div className="h-8 w-48 bg-gray-200 rounded animate-pulse" />
      </div>
      <div className="max-w-5xl mx-auto px-6 py-8 space-y-3">
        {[1, 2, 3].map((i) => (
          <div key={i} className="bg-white rounded-xl border border-gray-200 p-5">
            <div className="h-5 w-48 bg-gray-200 rounded animate-pulse mb-2" />
            <div className="h-4 w-32 bg-gray-100 rounded animate-pulse mb-4" />
            <div className="flex gap-2">
              {[1, 2, 3].map((j) => <div key={j} className="h-8 w-24 bg-gray-100 rounded animate-pulse" />)}
            </div>
          </div>
        ))}
      </div>
    </main>
  );
}
