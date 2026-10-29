import type { NextRequest } from "next/server";

// Server-only admin key. Set ADMIN_API_KEY in the deployment environment and
// send it in the x-admin-key request header. When the variable is unset every
// request is denied, so a missing secret fails closed instead of open.
export function isAdminAuthorized(req: NextRequest): boolean {
  const expected = process.env.ADMIN_API_KEY;
  if (!expected) return false;
  return req.headers.get("x-admin-key") === expected;
}
