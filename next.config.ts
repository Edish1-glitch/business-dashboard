import type { NextConfig } from "next";

// Content-Security-Policy. 'unsafe-inline'/'unsafe-eval' on scripts are required
// by Next's inline bootstrap (no nonce pipeline here) — but the real value is in
// the rest: default-src 'self' blocks loading any external script/resource,
// frame-ancestors 'self' stops cross-origin clickjacking while still letting our
// own pages frame same-origin content (the HTML invoice preview iframe),
// form-action limits where forms post, object/base are locked down. Tuned for
// what the app actually loads:
//   img  → self + data/blob + Google avatars (lh3.googleusercontent.com)
//   frame/worker → self (the preview iframe and the service worker)
//   form-action → self + accounts.google.com (Google OAuth sign-in)
// Applied in production only, so local dev's HMR eval/websocket stays unblocked.
function buildCsp(imgSrc: string): string {
  return [
    "default-src 'self'",
    "script-src 'self' 'unsafe-inline' 'unsafe-eval'",
    "style-src 'self' 'unsafe-inline'",
    imgSrc,
    "font-src 'self' data:",
    "connect-src 'self'",
    "frame-src 'self'",
    "worker-src 'self'",
    "manifest-src 'self'",
    "form-action 'self' https://accounts.google.com",
    "frame-ancestors 'self'",
    "base-uri 'self'",
    "object-src 'none'",
  ].join("; ");
}

// App-wide: only our own images + Google avatars.
const cspStrict = buildCsp("img-src 'self' data: blob: https://*.googleusercontent.com");

// The invoice-preview endpoint (/api/invoices/[id]/preview) renders untrusted
// email-HTML invoices that embed remote logos (e.g. paypalobjects.com). It runs
// in a sandbox WITHOUT allow-scripts, so remote images are safe here (no code
// runs, nothing readable to exfiltrate) — the only tradeoff is that a remote
// tracking pixel can load. Allow https images so receipts render with their logos.
const cspPreview = buildCsp("img-src 'self' data: blob: https:");

const isProd = process.env.NODE_ENV === "production";

// Security hardening headers. CSP is production-only (dev needs HMR eval/ws).
function securityHeaders(csp: string) {
  return [
    { key: "X-Content-Type-Options", value: "nosniff" },
    { key: "X-Frame-Options", value: "SAMEORIGIN" },
    { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
    { key: "Strict-Transport-Security", value: "max-age=63072000; includeSubDomains" },
    { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=()" },
    ...(isProd ? [{ key: "Content-Security-Policy", value: csp }] : []),
  ];
}

const nextConfig: NextConfig = {
  poweredByHeader: false, // don't advertise the framework
  async headers() {
    return [
      // The invoice-preview endpoint gets a relaxed img-src (see cspPreview).
      { source: "/api/invoices/:id/preview", headers: securityHeaders(cspPreview) },
      // Everything else gets the strict policy. The negative lookahead keeps this
      // rule from ALSO matching the preview path — two matching rules would emit
      // duplicate CSP headers and the browser enforces their intersection, so the
      // strict img-src would win and undo the relaxation above.
      { source: "/((?!api/invoices/.*/preview).*)", headers: securityHeaders(cspStrict) },
    ];
  },
};

export default nextConfig;
