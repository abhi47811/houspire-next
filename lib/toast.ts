// Simple toast via custom DOM element — works without external lib
export function toast(message: string, type: "success" | "error" | "info" = "info") {
  if (typeof window === "undefined") return;
  const existing = document.getElementById("houspire-toast");
  if (existing) existing.remove();
  const el = document.createElement("div");
  el.id = "houspire-toast";
  el.textContent = message;
  el.style.cssText = `
    position:fixed;bottom:24px;right:24px;padding:12px 20px;border-radius:8px;
    font-size:14px;font-weight:500;z-index:9999;max-width:400px;
    animation:slideIn 0.2s ease;
    background:${type === "error" ? "#dc2626" : type === "success" ? "#166534" : "#1B4D3E"};
    color:white;box-shadow:0 4px 12px rgba(0,0,0,0.15);
  `;
  document.body.appendChild(el);
  setTimeout(() => el.remove(), 4000);
}
