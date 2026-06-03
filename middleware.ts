import { NextRequest, NextResponse } from "next/server";

// Auth middleware disabled — app is internal, login is optional
// Re-enable when @supabase/ssr cookie-based auth is wired properly
export function middleware(_req: NextRequest) {
  return NextResponse.next();
}

export const config = { matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"] };
