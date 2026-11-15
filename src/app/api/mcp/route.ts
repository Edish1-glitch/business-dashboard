import { createMcpHandler, withMcpAuth } from "mcp-handler";
import { registerFindashTools } from "@/lib/mcp/tools";
import { verifyMcpToken } from "@/lib/mcp/auth";

// FinDash remote MCP server (Streamable HTTP), consumed by the claude.ai
// personal assistant as a custom connector. Every tool is scoped to the user
// behind the bearer access token (see verifyMcpToken + the tools' userId).
const handler = createMcpHandler(
  (server) => {
    registerFindashTools(server);
  },
  { serverInfo: { name: "findash", version: "1.0.0" } }
);

// Require a valid OAuth bearer token; unauthenticated requests get a 401 with a
// WWW-Authenticate challenge pointing at our protected-resource metadata.
const authHandler = withMcpAuth(handler, verifyMcpToken, {
  required: true,
  resourceMetadataPath: "/.well-known/oauth-protected-resource",
  requiredScopes: ["findash"],
});

export { authHandler as GET, authHandler as POST };
