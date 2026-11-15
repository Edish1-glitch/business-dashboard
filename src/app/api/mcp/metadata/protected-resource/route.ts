import { protectedResourceHandler, getPublicOrigin, metadataCorsOptionsRequestHandler } from "mcp-handler";

// RFC 9728 Protected Resource Metadata. Served at /.well-known/oauth-protected-
// resource via a rewrite in next.config.ts. Points MCP clients at our co-hosted
// authorization server.
export async function GET(req: Request) {
  const origin = getPublicOrigin(req);
  return protectedResourceHandler({ authServerUrls: [origin], resourceUrl: `${origin}/api/mcp` })(req);
}

export const OPTIONS = metadataCorsOptionsRequestHandler();
