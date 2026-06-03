import { NextRequest, NextResponse } from "next/server";

export function middleware(req: NextRequest) {
  const pathname = req.nextUrl.pathname;
  const publicRoutes = ["/login", "/approve", "/quote", "/api/", "/_next/", "/manifest.json", "/sw.js", "/icon"];
  if (publicRoutes.some((p) => pathname.startsWith(p))) return NextResponse.next();
  const hasAuth =
    req.cookies.has("sb-prhsjeryvbasofzebtnx-auth-token") ||
    req.cookies.has("sb-access-token");
  if (!hasAuth) return NextResponse.redirect(new URL("/login", req.url));
  return NextResponse.next();
}

export const config = { matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"] };
