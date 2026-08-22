import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { validateState, exchangeCodeForTokens } from "@/lib/gmail";
import { encryptToken } from "@/lib/crypto";

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  // Build post-OAuth redirects from the configured public URL, NOT request.url:
  // behind the Caddy reverse proxy request.url resolves to the internal host
  // (https://localhost:3000), which would bounce the browser to a dead localhost
  // address after authorizing. NEXTAUTH_URL is the real public origin.
  const base = process.env.NEXTAUTH_URL || new URL(request.url).origin;
  const code = searchParams.get("code");
  const state = searchParams.get("state");
  const errorParam = searchParams.get("error");

  // User denied access
  if (errorParam) {
    return NextResponse.redirect(new URL("/settings?gmail=denied", base));
  }

  if (!code || !state) {
    return NextResponse.redirect(new URL("/settings?gmail=error", base));
  }

  // Validate state
  const userId = validateState(state);
  if (!userId) {
    return NextResponse.redirect(new URL("/settings?gmail=expired", base));
  }

  try {
    const { email, accessToken, refreshToken, expiresAt, scopes } = await exchangeCodeForTokens(code);
    const encAccess = encryptToken(accessToken);
    const encRefresh = encryptToken(refreshToken);

    // Upsert email account (tokens encrypted at rest)
    await prisma.emailAccount.upsert({
      where: { email_userId: { email, userId } },
      update: {
        accessToken: encAccess,
        refreshToken: encRefresh,
        tokenExpiresAt: expiresAt,
        scopes,
        needsReconnect: false, // fresh tokens — clear the reconnect flag
      },
      create: {
        email,
        provider: "gmail",
        accessToken: encAccess,
        refreshToken: encRefresh,
        tokenExpiresAt: expiresAt,
        scopes,
        userId,
      },
    });

    return NextResponse.redirect(new URL("/settings?gmail=connected", base));
  } catch (err) {
    console.error("Gmail callback error:", err);
    return NextResponse.redirect(new URL("/settings?gmail=error", base));
  }
}
