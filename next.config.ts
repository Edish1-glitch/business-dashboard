import type { NextConfig } from "next";

// Content-Security-Policy. 'unsafe-inline'/'unsafe-eval' on scripts are required
// by Next's inline bootstrap (no nonce pipeline here) — but the real value is in
// the rest: default-src 'self' blocks loading any external script/resource,
// frame-ancestors 'none' stops clickjacking, form-action limits where forms post,
// object/base are locked down. Tuned for what the app actually loads:
//   img  → self + data/blob + Google avatars (lh3.googleusercontent.com)
//   frame/worker → self (the preview iframe and the service worker)
//   form-action → self + accounts.google.com (Google OAuth sign-in)
// Applied in production only, so local dev's HMR eval/websocket stays unblocked.
const csp = [
  "default-src 'self'",
  "script-src 'self' 'unsafe-inline' 'unsafe-eval'",
  "style-src 'self' 'unsafe-inline'",
  "img-src 'self' data: blob: https://*.googleusercontent.com",
  "font-src 'self' data:",
  "connect-src 'self'",
  "frame-src 'self'",
  "worker-src 'self'",
  "manifest-src 'self'",
  "form-action 'self' https://accounts.google.com",
  "frame-ancestors 'none'",
  "base-uri 'self'",
  "object-src 'none'",
].join("; ");

// Security hardening headers applied to every response.
const securityHeaders = [
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "X-Frame-Options", value: "SAMEORIGIN" },
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  { key: "Strict-Transport-Security", value: "max-age=63072000; includeSubDomains" },
  { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=()" },
  ...(process.env.NODE_ENV === "production"
    ? [{ key: "Content-Security-Policy", value: csp }]
    : []),
];

const nextConfig: NextConfig = {
  poweredByHeader: false, // don't advertise the framework
  async headers() {
    return [{ source: "/:path*", headers: securityHeaders }];
  },
};

export default nextConfig;
