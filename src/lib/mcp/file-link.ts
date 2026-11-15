import { createHmac, timingSafeEqual } from "crypto";

// Short-lived signed links so an MCP client can download an invoice file without
// a FinDash session. The token binds the invoice id + owner + expiry under an
// HMAC; the files route recovers them from the token (nothing sensitive in the
// URL besides the opaque token itself).

const TTL_MS = 15 * 60 * 1000; // 15 minutes

function secret(): string {
  return process.env.MCP_FILE_SECRET || process.env.NEXTAUTH_SECRET || "insecure-dev-secret";
}

export function signFileLink(invoiceId: string, userId: string, ttlMs = TTL_MS): string {
  const body = Buffer.from(JSON.stringify({ i: invoiceId, u: userId, e: Date.now() + ttlMs })).toString("base64url");
  const sig = createHmac("sha256", secret()).update(body).digest("base64url");
  return `${body}.${sig}`;
}

export function verifyFileLink(token: string): { invoiceId: string; userId: string } | null {
  const dot = token.indexOf(".");
  if (dot < 0) return null;
  const body = token.slice(0, dot);
  const sig = token.slice(dot + 1);
  const expected = createHmac("sha256", secret()).update(body).digest("base64url");
  const a = Buffer.from(sig);
  const b = Buffer.from(expected);
  if (a.length !== b.length || !timingSafeEqual(a, b)) return null;
  try {
    const { i, u, e } = JSON.parse(Buffer.from(body, "base64url").toString());
    if (typeof i !== "string" || typeof u !== "string" || typeof e !== "number" || e < Date.now()) return null;
    return { invoiceId: i, userId: u };
  } catch {
    return null;
  }
}
