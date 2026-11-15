import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { getToken } from "next-auth/jwt";

export async function middleware(request: NextRequest) {
  const token = await getToken({ req: request, secret: process.env.NEXTAUTH_SECRET });

  const { pathname } = request.nextUrl;

  // Allow auth routes, login page, debug, PWA assets, and the secret-protected cron endpoint
  if (
    pathname.startsWith("/api/auth") ||
    pathname === "/login" ||
    pathname === "/tour" ||
    pathname === "/api/email-accounts/callback" ||
    pathname.startsWith("/api/cron") ||
    // MCP remote server: bearer-authed endpoint, OAuth endpoints, signed file
    // links, and public OAuth discovery metadata — never session-gated.
    pathname.startsWith("/api/mcp") ||
    pathname.startsWith("/.well-known/") ||
    pathname === "/privacy" ||
    pathname === "/terms" ||
    pathname === "/manifest.webmanifest" ||
    pathname === "/sw.js" ||
    pathname.startsWith("/icons")
  ) {
    return NextResponse.next();
  }

  // Redirect to login if not authenticated
  if (!token) {
    const loginUrl = new URL("/login", request.url);
    return NextResponse.redirect(loginUrl);
  }

  return NextResponse.next();
}

export const config = {
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico).*)",
  ],
};
