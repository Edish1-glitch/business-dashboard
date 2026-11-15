import { consumeAuthCode, getClient, issueTokens, rotateRefreshToken, verifyPkceS256, MCP_SCOPE } from "@/lib/mcp/oauth";

function tokenError(error: string, description?: string, status = 400) {
  return Response.json(
    { error, ...(description && { error_description: description }) },
    { status, headers: { "cache-control": "no-store", "pragma": "no-cache" } }
  );
}

function tokenOk(data: Record<string, unknown>) {
  return Response.json(data, { headers: { "cache-control": "no-store", "pragma": "no-cache" } });
}

export async function POST(req: Request) {
  let form: FormData;
  try {
    form = await req.formData();
  } catch {
    return tokenError("invalid_request", "expected application/x-www-form-urlencoded");
  }
  const get = (k: string) => {
    const v = form.get(k);
    return typeof v === "string" ? v : undefined;
  };

  const grantType = get("grant_type");

  if (grantType === "authorization_code") {
    const code = get("code");
    const verifier = get("code_verifier");
    const clientId = get("client_id");
    const redirectUri = get("redirect_uri");
    if (!code || !verifier || !clientId || !redirectUri) {
      return tokenError("invalid_request", "missing code/code_verifier/client_id/redirect_uri");
    }
    const row = await consumeAuthCode(code);
    if (!row) return tokenError("invalid_grant", "authorization code invalid or expired");
    if (row.clientId !== clientId) return tokenError("invalid_grant", "client mismatch");
    if (row.redirectUri !== redirectUri) return tokenError("invalid_grant", "redirect_uri mismatch");
    if (!verifyPkceS256(verifier, row.codeChallenge)) return tokenError("invalid_grant", "PKCE verification failed");

    const client = await getClient(row.clientId);
    const { accessToken, refreshToken, expiresIn } = await issueTokens({
      clientId: row.clientId,
      userId: row.userId,
      scope: row.scope,
      resource: row.resource,
      label: client?.name ?? null,
    });
    return tokenOk({
      access_token: accessToken,
      token_type: "Bearer",
      expires_in: expiresIn,
      refresh_token: refreshToken,
      scope: row.scope ?? MCP_SCOPE,
    });
  }

  if (grantType === "refresh_token") {
    const refreshToken = get("refresh_token");
    if (!refreshToken) return tokenError("invalid_request", "missing refresh_token");
    const rotated = await rotateRefreshToken(refreshToken);
    if (!rotated) return tokenError("invalid_grant", "refresh token invalid or expired");
    return tokenOk({
      access_token: rotated.accessToken,
      token_type: "Bearer",
      expires_in: rotated.expiresIn,
      refresh_token: rotated.refreshToken,
      scope: rotated.row.scope ?? MCP_SCOPE,
    });
  }

  return tokenError("unsupported_grant_type", `grant_type '${grantType}' not supported`);
}
