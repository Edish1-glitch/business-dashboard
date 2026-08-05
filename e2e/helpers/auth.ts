import { readFileSync } from "fs";
import path from "path";
import { encode } from "next-auth/jwt";
import type { BrowserContext } from "@playwright/test";

// Read NEXTAUTH_SECRET from the environment, falling back to .env so the suite
// works no matter how it's launched.
function getSecret(): string {
  if (process.env.NEXTAUTH_SECRET) return process.env.NEXTAUTH_SECRET;
  try {
    const env = readFileSync(path.join(process.cwd(), ".env"), "utf8");
    const m = env.match(/^NEXTAUTH_SECRET=(.*)$/m);
    if (m) return m[1].trim().replace(/^["']|["']$/g, "");
  } catch { /* ignore */ }
  throw new Error("NEXTAUTH_SECRET not found (needed to mint a test session)");
}

export const TEST_USER = {
  name: "בודק E2E",
  email: "e2e@test.local",
  sub: "e2e-user-id",
  sid: "e2e-sid",
};

// Mint a real NextAuth session cookie so the middleware treats the browser as
// logged in — no Google OAuth round-trip. All /api/* data is mocked per-test.
export async function login(context: BrowserContext) {
  const value = await encode({ token: { ...TEST_USER }, secret: getSecret() });
  await context.addCookies([
    { name: "next-auth.session-token", value, domain: "localhost", path: "/", httpOnly: true, sameSite: "Lax" },
  ]);
  // Skip the first-run onboarding modal (a z-[200] overlay that would intercept
  // clicks) and pin a stable theme.
  await context.addInitScript(() => {
    try {
      localStorage.setItem("findash-onboarding-v4", "true");
      localStorage.setItem("findash-theme", "light");
    } catch { /* ignore */ }
  });
}
