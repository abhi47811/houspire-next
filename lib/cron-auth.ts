import { timingSafeEqual } from "crypto";
import { NextResponse } from "next/server";

// Vercel Cron sends `Authorization: Bearer ${CRON_SECRET}` to the configured
// cron path. Verify it before the handler does any work. Returns a response to
// send back when the request is not authorized, or null to continue.
export function verifyCronSecret(req: Request): NextResponse | null {
  const secret = process.env.CRON_SECRET;
  if (!secret) {
    console.error("CRON_SECRET environment variable is not set");
    return NextResponse.json({ error: "Server misconfiguration" }, { status: 503 });
  }

  const expected = Buffer.from(`Bearer ${secret}`);
  const actual = Buffer.from(req.headers.get("authorization") ?? "");
  const valid = expected.length === actual.length && timingSafeEqual(expected, actual);
  if (!valid) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  return null;
}
