# FinDash MCP server

A remote **Model Context Protocol** server that exposes FinDash to an AI
assistant (e.g. the claude.ai personal assistant) as a **custom connector**.

- **Endpoint:** `https://findashapp.com/api/mcp` (Streamable HTTP, HTTPS :443)
- **Transport:** Streamable HTTP via [`mcp-handler`](https://www.npmjs.com/package/mcp-handler) v2 + `@modelcontextprotocol/server` v2
- **Auth:** OAuth 2.1 (PKCE, refresh rotation, Dynamic Client Registration), co-hosted authorization server that delegates login to the existing FinDash Google sign-in + a consent screen.

## Connecting from claude.ai

Settings → **Connectors** → **Add custom connector** → URL `https://findashapp.com/api/mcp` →
**Connect** → sign in to FinDash (Google) → approve on the "לאפשר ל-Claude גישה ל-FinDash" screen.

Manage/disconnect under FinDash → **הגדרות → חיבורי MCP** (also shows the action log).

## OAuth endpoints

| Path | Purpose |
|---|---|
| `/.well-known/oauth-protected-resource` | RFC 9728 Protected Resource Metadata |
| `/.well-known/oauth-authorization-server` | RFC 8414 Authorization Server Metadata |
| `/api/mcp/oauth/register` | Dynamic Client Registration (RFC 7591) |
| `/api/mcp/oauth/authorize` | Authorization endpoint + consent screen |
| `/api/mcp/oauth/token` | Token endpoint (authorization_code + refresh_token) |
| `/api/mcp/files/[id]?t=…` | Short-lived signed invoice download (15 min) |

Access tokens live 1h; refresh tokens 180d and **rotate** on use. Tokens are
opaque and stored hashed (`McpToken`). Every grant = one row; revoke it from
settings to disconnect that connector.

## Tools (core)

| Tool | What it does |
|---|---|
| `get_overview` | Totals (all / business / private), pending, approved, business-approved-not-yet-sent, mailbox statuses. Optional date range. |
| `list_invoices` | Filter by status, business/private, sent-to-accountant, date range, vendor, category, mailbox, deleted; paginated. |
| `get_invoice` | Full details + temporary download link + in-app view link. |
| `update_invoice` | Change classification, category, vendor, amount, currency, date. |
| `approve_invoices` | Approve a list (creates an expense each, like manual approval). |
| `mark_private` | Mark a list as private (`isBusiness=false`), incl. linked expenses. |
| `delete_invoice` / `restore_invoice` | Soft-delete (recoverable) and restore. |
| `send_to_accountant` | Send a list to the accountant email in settings. **Requires `confirm:true`**; skips already-sent unless `force:true`; only ever sends to the configured accountant address. |
| `sync_mailboxes` | Run an incremental Gmail sync (one mailbox or all, optional date range). |
| `get_sync_status` | Per-mailbox last sync + recent runs. |
| `get_mailbox_status` | Per-mailbox connected/expired + last error. |
| `list_categories` | Existing categories. |

## Safety

- Every tool is scoped to the user behind the bearer token (`userId`).
- `send_to_accountant` can only send to `User.accountantEmail` — never an arbitrary address — and needs explicit `confirm:true`.
- No tool changes the accountant address, permanently deletes data, or touches Gmail connections.
- Every tool call is written to an **audit log** (`McpActionLog`), visible under settings.
- `send_to_accountant` is rate-limited (shared with the UI send: 10/min/user).

## Local testing

```bash
# Set a dev bearer in .env (local only — never in prod):
#   MCP_DEV_TOKEN=<random>   MCP_DEV_USER_EMAIL=you@example.com
npx @modelcontextprotocol/inspector   # or drive /api/mcp over Streamable HTTP
```

The production bearer path (opaque OAuth access token) and the dev path coexist
in `src/lib/mcp/auth.ts`.

## Code map

- `src/app/api/mcp/route.ts` — the MCP handler (tools + `withMcpAuth`)
- `src/lib/mcp/tools.ts` — tool definitions
- `src/lib/mcp/oauth.ts` — token/code/client helpers (hashing, PKCE, rotation)
- `src/lib/mcp/auth.ts` — bearer verifier → AuthInfo
- `src/app/api/mcp/oauth/*` — register / authorize (consent) / token
- `src/app/api/mcp/metadata/*` — OAuth discovery docs (rewritten to `/.well-known/*`)
- `src/components/settings/McpSettings.tsx` — connections + action log UI
