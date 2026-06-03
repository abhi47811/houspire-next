import { NextRequest, NextResponse } from "next/server";
import { Resend } from "resend";
import { loadProject } from "@/lib/db";

export async function POST(req: NextRequest) {
  const { projectId, recipientEmail } = await req.json() as { projectId: string; recipientEmail: string };

  if (!process.env.RESEND_API_KEY) {
    return NextResponse.json({ error: "RESEND_API_KEY not set" }, { status: 500 });
  }

  const resend = new Resend(process.env.RESEND_API_KEY);
  const data = await loadProject(projectId);
  if (!data.project) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const p = data.project as { client_name: string; city: string };
  const total = data.boq_rows.reduce((s, r) => s + r.qty * r.rate, 0);
  const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? "https://houspire-next.vercel.app";

  await resend.emails.send({
    from: "Houspire <noreply@houspire.ai>",
    to: recipientEmail,
    subject: `Houspire BOQ — ${p.client_name}, ${p.city}`,
    html: `
      <h2 style="color:#1B4D3E">Your Houspire Budget Estimate</h2>
      <p>Dear ${p.client_name},</p>
      <p>Your BOQ for ${p.city} is ready.</p>
      <p><strong>Total estimate: ₹${Math.round(total).toLocaleString("en-IN")}</strong></p>
      <p><a href="${appUrl}/approve/${projectId}" style="background:#1B4D3E;color:#fff;padding:10px 20px;border-radius:6px;text-decoration:none;display:inline-block;margin-top:12px">View &amp; Approve BOQ</a></p>
      <p style="margin-top:24px;color:#666;font-size:12px">— Houspire Team</p>
    `,
  });

  return NextResponse.json({ ok: true });
}
