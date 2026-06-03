"use client";

import { useState } from "react";

export function ApproveButton({ id }: { id: string }) {
  const [approved, setApproved] = useState(false);
  const [loading, setLoading] = useState(false);

  async function handleApprove() {
    setLoading(true);
    await fetch(`/api/projects/${id}/approve`, { method: "POST" });
    setApproved(true);
    setLoading(false);
  }

  if (approved) {
    return (
      <span className="bg-green-100 text-green-800 text-sm font-semibold px-4 py-2 rounded-full">
        Approved ✓
      </span>
    );
  }

  return (
    <button
      onClick={handleApprove}
      disabled={loading}
      className="bg-green-900 text-white px-6 py-2.5 rounded-lg text-sm font-semibold hover:bg-green-800 disabled:opacity-50"
    >
      {loading ? "Approving…" : "Approve Budget ✓"}
    </button>
  );
}
