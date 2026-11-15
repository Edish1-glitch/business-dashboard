import { registerClient } from "@/lib/mcp/oauth";

// RFC 7591 Dynamic Client Registration. Public clients only (PKCE, no secret).
export async function POST(req: Request) {
  let body: Record<string, unknown> = {};
  try {
    body = await req.json();
  } catch {
    return Response.json({ error: "invalid_client_metadata" }, { status: 400 });
  }

  const redirectUris = Array.isArray(body.redirect_uris)
    ? (body.redirect_uris as unknown[]).filter((u): u is string => typeof u === "string")
    : [];
  if (redirectUris.length === 0) {
    return Response.json({ error: "invalid_redirect_uri", error_description: "redirect_uris required" }, { status: 400 });
  }

  const name = typeof body.client_name === "string" && body.client_name.trim() ? body.client_name : "MCP Client";
  const client = await registerClient(name, redirectUris);

  return Response.json(
    {
      client_id: client.id,
      client_id_issued_at: Math.floor(client.createdAt.getTime() / 1000),
      client_name: client.name,
      redirect_uris: client.redirectUris,
      grant_types: ["authorization_code", "refresh_token"],
      response_types: ["code"],
      token_endpoint_auth_method: "none",
    },
    { status: 201, headers: { "cache-control": "no-store" } }
  );
}
