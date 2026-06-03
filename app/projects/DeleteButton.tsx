"use client";
import { useState } from "react";

export function DeleteButton({ projectId }: { projectId: string }) {
  const [confirming, setConfirming] = useState(false);
  const [deleting, setDeleting] = useState(false);

  async function handleDelete() {
    setDeleting(true);
    await fetch(`/api/projects?id=${projectId}`, { method: "DELETE" });
    window.location.reload();
  }

  if (confirming) return (
    <div className="flex items-center gap-2">
      <span className="text-xs text-red-600">Delete?</span>
      <button onClick={handleDelete} disabled={deleting}
        className="text-xs bg-red-600 text-white px-2 py-1 rounded hover:bg-red-700">
        {deleting ? "..." : "Yes"}
      </button>
      <button onClick={() => setConfirming(false)} className="text-xs text-gray-500 hover:text-gray-700">No</button>
    </div>
  );

  return (
    <button onClick={() => setConfirming(true)} className="text-xs text-red-500 hover:text-red-700 px-2 py-1 rounded hover:bg-red-50">
      🗑 Delete
    </button>
  );
}
