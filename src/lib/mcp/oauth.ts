import { createHash, randomBytes, timingSafeEqual } from "crypto";
import { prisma } from "@/lib/db";

// MCP OAuth 2.1 authorization server, co-hosted with the resource server.
// Public clients + PKCE (no client secret). Tokens are opaque and stored hashed.

export const MCP_SCOPE = "findash";
const ACCESS_TTL_MS = 60 * 60 * 1000; // 1 hour
const REFRESH_TTL_MS = 180 * 24 * 60 * 60 * 1000; // 180 days
const CODE_TTL_MS = 2 * 60 * 1000; // 2 minutes

/** A URL-safe opaque secret (token / auth code). */
export function randomToken(bytes = 32): string {
  return randomBytes(bytes).toString("base64url");
}

/** Deterministic hash for at-rest storage + constant-time lookup keys. */
export function sha256(s: string): string {
  return createHash("sha256").update(s).digest("base64url");
}

/** Verify a PKCE S256 challenge: challenge === base64url(sha256(verifier)). */
export function verifyPkceS256(verifier: string, challenge: string): boolean {
  const expected = Buffer.from(sha256(verifier));
  const got = Buffer.from(challenge);
  return expected.length === got.length && timingSafeEqual(expected, got);
}

// ── Clients (Dynamic Client Registration) ───────────────────────────────────

export async function registerClient(name: string, redirectUris: string[]) {
  return prisma.mcpClient.create({ data: { name: name.slice(0, 200), redirectUris } });
}

export async function getClient(clientId: string) {
  return prisma.mcpClient.findUnique({ where: { id: clientId } });
}

// ── Authorization codes ─────────────────────────────────────────────────────

export async function issueAuthCode(params: {
  clientId: string;
  userId: string;
  redirectUri: string;
  codeChallenge: string;
  scope: string | null;
  resource: string | null;
}): Promise<string> {
  const code = randomToken();
  await prisma.mcpAuthCode.create({
    data: {
      codeHash: sha256(code),
      clientId: params.clientId,
      userId: params.userId,
      redirectUri: params.redirectUri,
      codeChallenge: params.codeChallenge,
      scope: params.scope,
      resource: params.resource,
      expiresAt: new Date(Date.now() + CODE_TTL_MS),
    },
  });
  return code;
}

/** Single-use: fetch and delete the code, returning it only if still valid. */
export async function consumeAuthCode(code: string) {
  const row = await prisma.mcpAuthCode.findUnique({ where: { codeHash: sha256(code) } });
  if (!row) return null;
  await prisma.mcpAuthCode.delete({ where: { id: row.id } }).catch(() => {});
  if (row.expiresAt < new Date()) return null;
  return row;
}

// ── Access / refresh tokens ─────────────────────────────────────────────────

export async function issueTokens(params: {
  clientId: string;
  userId: string;
  scope: string | null;
  resource: string | null;
  label: string | null;
}) {
  const accessToken = randomToken();
  const refreshToken = randomToken();
  const now = Date.now();
  await prisma.mcpToken.create({
    data: {
      accessTokenHash: sha256(accessToken),
      refreshTokenHash: sha256(refreshToken),
      clientId: params.clientId,
      userId: params.userId,
      scope: params.scope,
      resource: params.resource,
      label: params.label,
      accessExpiresAt: new Date(now + ACCESS_TTL_MS),
      refreshExpiresAt: new Date(now + REFRESH_TTL_MS),
    },
  });
  return { accessToken, refreshToken, expiresIn: Math.floor(ACCESS_TTL_MS / 1000) };
}

/** Rotate a refresh token (RFC 6749 §10.4 / MCP spec: public clients MUST rotate). */
export async function rotateRefreshToken(refreshToken: string) {
  const row = await prisma.mcpToken.findUnique({ where: { refreshTokenHash: sha256(refreshToken) } });
  if (!row || row.revoked) return null;
  if (row.refreshExpiresAt && row.refreshExpiresAt < new Date()) return null;

  const accessToken = randomToken();
  const newRefresh = randomToken();
  const now = Date.now();
  await prisma.mcpToken.update({
    where: { id: row.id },
    data: {
      accessTokenHash: sha256(accessToken),
      refreshTokenHash: sha256(newRefresh),
      accessExpiresAt: new Date(now + ACCESS_TTL_MS),
      refreshExpiresAt: new Date(now + REFRESH_TTL_MS),
      lastUsedAt: new Date(),
    },
  });
  return { row, accessToken, refreshToken: newRefresh, expiresIn: Math.floor(ACCESS_TTL_MS / 1000) };
}

/** Validate a bearer access token → the token row (or null). Touches lastUsedAt. */
export async function lookupAccessToken(accessToken: string) {
  const row = await prisma.mcpToken.findUnique({ where: { accessTokenHash: sha256(accessToken) } });
  if (!row || row.revoked) return null;
  if (row.accessExpiresAt < new Date()) return null;
  prisma.mcpToken.update({ where: { id: row.id }, data: { lastUsedAt: new Date() } }).catch(() => {});
  return row;
}
