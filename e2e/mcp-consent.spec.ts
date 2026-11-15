import { test, expect } from "@playwright/test";
import { login } from "./helpers/auth";

// The MCP OAuth consent screen renders for a logged-in user and a registered client.
test("MCP OAuth consent page renders", async ({ context, page }) => {
  await login(context);

  const redirect = "https://claude.ai/api/mcp/auth_callback";
  const reg = await page.request.post("/api/mcp/oauth/register", {
    data: { client_name: "Claude", redirect_uris: [redirect] },
  });
  const client = await reg.json();
  expect(client.client_id).toBeTruthy();

  const url =
    `/api/mcp/oauth/authorize?response_type=code&client_id=${client.client_id}` +
    `&redirect_uri=${encodeURIComponent(redirect)}` +
    `&code_challenge=E9Melhoa2OwvFrEMTJguCHaoeK1t8URWbuGJSstw-cM&code_challenge_method=S256&scope=findash&state=s`;

  await page.goto(url);
  await expect(page.getByText("אישור גישה")).toBeVisible();
  await expect(page.getByText(/לאפשר ל-Claude גישה ל-FinDash/)).toBeVisible();
  await page.screenshot({ path: "test-results/mcp-consent.png" });
});
