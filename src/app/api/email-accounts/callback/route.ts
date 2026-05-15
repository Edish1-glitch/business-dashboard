import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { validateState, exchangeCodeForTokens } from "@/lib/gmail";

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
    const { email, accessToken, refreshToken, expiresAt } = await exchangeCodeForTokens(code);

    // Upsert email account
    await prisma.emailAccount.upsert({
      where: { email_userId: { email, userId } },
      update: {
        accessToken,
        refreshToken,
        tokenExpiresAt: expiresAt,
      },
      create: {
        email,
        provider: "gmail",
        accessToken,
        refreshToken,
        tokenExpiresAt: expiresAt,
        userId,
      },
    });

    return NextResponse.redirect(new URL("/settings?gmail=connected", request.url));
  } catch (err) {
    console.error("Gmail callback error:", err);
    return NextResponse.redirect(new URL("/settings?gmail=error", request.url));
  }
}
