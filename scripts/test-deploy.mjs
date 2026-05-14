#!/usr/bin/env node

/**
 * Post-deploy health check script.
 * Run: node scripts/test-deploy.mjs https://business-dashboard-362m.onrender.com
 */

const BASE_URL = process.argv[2] || "http://localhost:3000";
const results = [];
let passed = 0;
let failed = 0;

async function test(name, fn) {
  try {
    await fn();
    results.push({ name, status: "✅" });
    passed++;
  } catch (e) {
    results.push({ name, status: "❌", error: e.message });
    failed++;
  }
}

function assert(condition, msg) {
  if (!condition) throw new Error(msg);
}

async function fetchJson(path, options = {}) {
  const res = await fetch(`${BASE_URL}${path}`, { redirect: "manual", ...options });
  return { status: res.status, headers: res.headers, body: res.headers.get("content-type")?.includes("json") ? await res.json() : null };
}

// ---- Tests ----

await test("Server is reachable", async () => {
  const res = await fetch(BASE_URL, { redirect: "manual" });
  assert(res.status < 500, `Server returned ${res.status}`);
});

await test("Unauthenticated redirects to login", async () => {
  const res = await fetch(BASE_URL, { redirect: "manual" });
  const location = res.headers.get("location") || "";
  assert(res.status === 307 || res.status === 302 || location.includes("login"), `Expected redirect to login, got ${res.status}`);
});

await test("Login page loads", async () => {
  const res = await fetch(`${BASE_URL}/login`);
  assert(res.status === 200, `Login page returned ${res.status}`);
  const html = await res.text();
  assert(html.includes("FinDash"), "Login page missing FinDash branding");
  assert(html.includes("Google"), "Login page missing Google button");
});

await test("Auth providers endpoint works", async () => {
  const { status, body } = await fetchJson("/api/auth/providers");
  assert(status === 200, `Providers returned ${status}`);
  assert(body?.google, "Google provider not configured");
  assert(body.google.id === "google", "Google provider ID mismatch");
});

await test("Auth CSRF endpoint works", async () => {
  const { status, body } = await fetchJson("/api/auth/csrf");
  assert(status === 200, `CSRF returned ${status}`);
  assert(body?.csrfToken, "No CSRF token returned");
});

await test("Categories API returns 401 without auth", async () => {
  const { status } = await fetchJson("/api/categories");
  // Should be 401 (unauthorized) or redirect
  assert(status === 401 || status === 307 || status === 302, `Expected 401/redirect, got ${status}`);
});

await test("Invoices API returns 401 without auth", async () => {
  const { status } = await fetchJson("/api/invoices?status=pending");
  assert(status === 401 || status === 307 || status === 302, `Expected 401/redirect, got ${status}`);
});

await test("Debug env vars (if available)", async () => {
  const { status, body } = await fetchJson("/api/debug-env");
  if (status === 200 && body) {
    assert(body.hasGoogleClientId, "GOOGLE_CLIENT_ID not set");
    assert(body.hasGoogleClientSecret, "GOOGLE_CLIENT_SECRET not set");
    assert(body.hasNextAuthSecret, "NEXTAUTH_SECRET not set");
    assert(body.hasDatabaseUrl, "DATABASE_URL not set");
    assert(body.nextAuthUrl !== "not set", "NEXTAUTH_URL not set");
  }
  // If endpoint doesn't exist (404), skip silently
});

await test("Static assets load", async () => {
  const res = await fetch(`${BASE_URL}/login`);
  const html = await res.text();
  const cssMatch = html.match(/href="(\/_next\/static\/chunks\/[^"]+\.css)"/);
  if (cssMatch) {
    const cssRes = await fetch(`${BASE_URL}${cssMatch[1]}`);
    assert(cssRes.status === 200, `CSS returned ${cssRes.status}`);
  }
});

// ---- Report ----

console.log(`\n🔍 Deploy Health Check: ${BASE_URL}\n`);
console.log("─".repeat(50));
for (const r of results) {
  console.log(`${r.status} ${r.name}${r.error ? ` → ${r.error}` : ""}`);
}
console.log("─".repeat(50));
console.log(`\n${passed} passed, ${failed} failed\n`);

process.exit(failed > 0 ? 1 : 0);
