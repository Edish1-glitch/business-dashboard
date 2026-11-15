import { getServerSession } from "next-auth";
import { getPublicOrigin } from "mcp-handler";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { getClient, issueAuthCode } from "@/lib/mcp/oauth";

// OAuth 2.1 authorization endpoint (PKCE authorization-code flow). Authenticates
// the user via the existing FinDash NextAuth session, shows a consent screen,
// then issues a single-use authorization code to the client's redirect_uri.

interface AuthParams {
  clientId: string;
  redirectUri: string;
  codeChallenge: string;
  scope: string | null;
  state: string | null;
  resource: string | null;
}

function htmlResponse(html: string, status = 200) {
  return new Response(html, { status, headers: { "content-type": "text/html; charset=utf-8", "cache-control": "no-store" } });
}

function errorPage(message: string) {
  return htmlResponse(
    `<!doctype html><html lang="he" dir="rtl"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
     <body style="font-family:system-ui;background:#0a0a0a;color:#fafafa;display:grid;place-items:center;height:100vh;margin:0">
     <div style="text-align:center;max-width:420px;padding:24px">
       <h1 style="font-size:18px">שגיאת התחברות</h1>
       <p style="color:#a1a1aa">${message}</p>
     </div></body></html>`,
    400
  );
}

function redirectError(redirectUri: string, state: string | null, error: string, description: string) {
  const u = new URL(redirectUri);
  u.searchParams.set("error", error);
  u.searchParams.set("error_description", description);
  if (state) u.searchParams.set("state", state);
  return Response.redirect(u.toString(), 302);
}

function parseParams(url: URL): { params?: AuthParams; error?: string } {
  const p = url.searchParams;
  if (p.get("response_type") !== "code") return { error: "response_type חייב להיות code" };
  const clientId = p.get("client_id");
  const redirectUri = p.get("redirect_uri");
  const codeChallenge = p.get("code_challenge");
  const method = p.get("code_challenge_method");
  if (!clientId) return { error: "חסר client_id" };
  if (!redirectUri) return { error: "חסר redirect_uri" };
  if (!codeChallenge || method !== "S256") return { error: "נדרש PKCE עם code_challenge_method=S256" };
  return {
    params: {
      clientId,
      redirectUri,
      codeChallenge,
      scope: p.get("scope"),
      state: p.get("state"),
      resource: p.get("resource"),
    },
  };
}

function consentPage(clientName: string, params: AuthParams) {
  const hidden = (name: string, value: string | null) =>
    value === null ? "" : `<input type="hidden" name="${name}" value="${value.replace(/"/g, "&quot;")}">`;
  return htmlResponse(`<!doctype html><html lang="he" dir="rtl"><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1"><title>אישור גישה — FinDash</title></head>
<body style="font-family:system-ui,-apple-system,sans-serif;background:#0a0a0a;color:#fafafa;display:grid;place-items:center;min-height:100vh;margin:0;padding:16px">
  <div style="max-width:440px;width:100%;background:#141414;border:1px solid #262626;border-radius:16px;padding:28px">
    <div style="font-size:22px;font-weight:700;margin-bottom:4px">FinDash</div>
    <h1 style="font-size:17px;font-weight:600;margin:16px 0 8px">לאפשר ל-${clientName.replace(/</g, "&lt;")} גישה ל-FinDash?</h1>
    <p style="color:#a1a1aa;font-size:14px;line-height:1.6;margin:0 0 20px">
      החיבור יוכל לראות ולנהל את החשבוניות וההוצאות שלך, לאשר ולשלוח לרו"ח (רק אחרי אישור מפורש ממך), ולהפעיל סנכרון.
      הגישה פועלת רק על הנתונים שלך, וכל פעולה נרשמת ביומן. אפשר לנתק בכל רגע מההגדרות.
    </p>
    <form method="post" style="display:flex;gap:10px">
      ${hidden("client_id", params.clientId)}
      ${hidden("redirect_uri", params.redirectUri)}
      ${hidden("code_challenge", params.codeChallenge)}
      ${hidden("scope", params.scope)}
      ${hidden("state", params.state)}
      ${hidden("resource", params.resource)}
      <button type="submit" name="decision" value="deny"
        style="flex:1;padding:11px;border-radius:10px;border:1px solid #333;background:transparent;color:#fafafa;font-size:15px;cursor:pointer">ביטול</button>
      <button type="submit" name="decision" value="approve"
        style="flex:2;padding:11px;border-radius:10px;border:0;background:#7c3aed;color:#fff;font-size:15px;font-weight:600;cursor:pointer">אישור גישה</button>
    </form>
  </div>
</body></html>`);
}

export async function GET(req: Request) {
  const url = new URL(req.url);
  const { params, error } = parseParams(url);
  if (error || !params) return errorPage(error ?? "בקשה לא תקינה");

  const client = await getClient(params.clientId);
  if (!client) return errorPage("client_id לא מוכר");
  if (!client.redirectUris.includes(params.redirectUri)) return errorPage("redirect_uri לא מורשה");

  const session = await getServerSession(authOptions);
  if (!session?.user?.email) {
    // Send the user through the normal FinDash login, then back here with params intact.
    const origin = getPublicOrigin(req);
    const self = `${origin}${url.pathname}${url.search}`;
    const loginUrl = new URL("/login", origin);
    loginUrl.searchParams.set("callbackUrl", self);
    return Response.redirect(loginUrl.toString(), 302);
  }

  return consentPage(client.name, params);
}

export async function POST(req: Request) {
  const form = await req.formData();
  const get = (k: string) => {
    const v = form.get(k);
    return typeof v === "string" ? v : null;
  };
  const clientId = get("client_id");
  const redirectUri = get("redirect_uri");
  const codeChallenge = get("code_challenge");
  if (!clientId || !redirectUri || !codeChallenge) return errorPage("בקשה לא תקינה");

  const client = await getClient(clientId);
  if (!client || !client.redirectUris.includes(redirectUri)) return errorPage("client/redirect_uri לא תקין");

  const state = get("state");
  const scope = get("scope");
  const resource = get("resource");

  const session = await getServerSession(authOptions);
  if (!session?.user?.email) return errorPage("ההתחברות פגה — נסה שוב");
  const user = await prisma.user.findUnique({ where: { email: session.user.email }, select: { id: true } });
  if (!user) return errorPage("משתמש לא נמצא");

  if (get("decision") !== "approve") {
    return redirectError(redirectUri, state, "access_denied", "המשתמש ביטל את הבקשה");
  }

  const code = await issueAuthCode({
    clientId,
    userId: user.id,
    redirectUri,
    codeChallenge,
    scope,
    resource,
  });

  const redir = new URL(redirectUri);
  redir.searchParams.set("code", code);
  if (state) redir.searchParams.set("state", state);
  return Response.redirect(redir.toString(), 302);
}
