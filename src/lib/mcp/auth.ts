import type { AuthInfo } from "@modelcontextprotocol/server";
import { prisma } from "@/lib/db";
import { lookupAccessToken, MCP_SCOPE } from "@/lib/mcp/oauth";

/**
 * Bearer-token verifier for the MCP endpoint (wired via mcp-handler's
 * withMcpAuth). Returns an AuthInfo whose `extra.userId` scopes every tool call,
 * or undefined to reject (→ 401 challenge).
 *
 * Two paths:
 *  - a real opaque OAuth access token issued by our authorization server
 *    (the production path for the claude.ai connector), and
 *  - an optional static MCP_DEV_TOKEN for local MCP Inspector testing.
 */
export async function verifyMcpToken(_req: Request, bearer?: string): Promise<AuthInfo | undefined> {
  if (!bearer) return undefined;

  // Production path: a hashed opaque access token → its owning user.
  const row = await lookupAccessToken(bearer);
  if (row) {
    return {
      token: bearer,
      clientId: row.clientId,
      scopes: row.scope ? row.scope.split(" ") : [MCP_SCOPE],
      expiresAt: Math.floor(row.accessExpiresAt.getTime() / 1000),
      extra: { userId: row.userId, tokenId: row.id },
    };
  }

  // Local dev path: a static token mapped to a single user (never set in prod).
  const devToken = process.env.MCP_DEV_TOKEN;
  const devEmail = process.env.MCP_DEV_USER_EMAIL;
  if (devToken && devEmail && timingSafeEqual(bearer, devToken)) {
    const user = await prisma.user.findUnique({ where: { email: devEmail }, select: { id: true } });
    if (user) {
      return { token: bearer, clientId: "dev", scopes: [MCP_SCOPE], extra: { userId: user.id } };
    }
  }

  return undefined;
}

/** Resolve the authenticated user id from a tool handler's ctx, or throw. */
export function userIdFromCtx(ctx: { http?: { authInfo?: AuthInfo } }): string {
  const uid = ctx.http?.authInfo?.extra?.userId;
  if (typeof uid !== "string" || !uid) throw new Error("לא מאומת");
  return uid;
}

/** Resolve the client id (connector) from ctx, for the action log. */
export function clientIdFromCtx(ctx: { http?: { authInfo?: AuthInfo } }): string {
  return ctx.http?.authInfo?.clientId || "unknown";
}

/** Constant-time string compare (avoids leaking the dev token via timing). */
function timingSafeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}
