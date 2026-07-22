import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { validateState, exchangeCodeForTokens } from "@/lib/gmail";
import { encryptToken } from "@/lib/crypto";

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const code = searchParams.get("code");
  const state = searchParams.get("state");
  const errorParam = searchParams.get("error");

  // User denied access
  if (errorParam) {
    return NextResponse.redirect(new URL("/settings?gmail=denied", request.url));
  }

  if (!code || !state) {
    return NextResponse.redirect(new URL("/settings?gmail=error", request.url));
  }

  // Validate state
  const userId = validateState(state);
  if (!userId) {
    return NextResponse.redirect(new URL("/settings?gmail=expired", request.url));
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

    return NextResponse.redirect(new URL("/settings?gmail=connected", request.url));
  } catch (err) {
    console.error("Gmail callback error:", err);
    return NextResponse.redirect(new URL("/settings?gmail=error", request.url));
  }
}
