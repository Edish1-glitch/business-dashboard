import { getPublicOrigin, metadataCorsOptionsRequestHandler } from "mcp-handler";

// RFC 8414 Authorization Server Metadata for our co-hosted OAuth 2.1 server.
// Served at /.well-known/oauth-authorization-server via a next.config rewrite.
export async function GET(req: Request) {
  const origin = getPublicOrigin(req);
  const metadata = {
    issuer: origin,
    authorization_endpoint: `${origin}/api/mcp/oauth/authorize`,
    token_endpoint: `${origin}/api/mcp/oauth/token`,
    registration_endpoint: `${origin}/api/mcp/oauth/register`,
    response_types_supported: ["code"],
    grant_types_supported: ["authorization_code", "refresh_token"],
    code_challenge_methods_supported: ["S256"],
    token_endpoint_auth_methods_supported: ["none"],
    scopes_supported: ["findash"],
  };
  return Response.json(metadata, {
    headers: { "access-control-allow-origin": "*", "cache-control": "public, max-age=3600" },
  });
}

export const OPTIONS = metadataCorsOptionsRequestHandler();
