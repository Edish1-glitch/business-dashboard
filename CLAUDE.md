# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

```bash
npm run dev                    # Dev server (Turbopack). Runs React StrictMode → effects double-invoke.
npm run build                  # Production build (also runs ESLint; lint errors fail the build)
npm start                      # Production server (next start) — use this to test memory / double-fetch behavior
npm run lint                   # ESLint
npm test                       # Unit tests (vitest, tests/unit/**) — pure logic, no DB/network
npx playwright test            # E2E tests (desktop/mobile/tablet)
npx playwright test --grep "Mobile"
npx prisma generate            # Regenerate client after schema changes (client → src/generated/prisma, gitignored)
npx prisma db push             # Push schema to the DB in .env (see DB note below)
```

`.env` `DATABASE_URL` points at a **Neon cloud Postgres (EU)** — dev and production share the *same* DB, so schema changes are immediately live everywhere. Prefer **additive-only** schema changes (new nullable columns / new tables) so deployed old code keeps working.

Standalone `tsx` scripts don't auto-load `.env` — run them as:
`set -a && . ./.env && set +a && npx tsx script.ts`

## Architecture

**Stack**: Next.js 16 (App Router) + TypeScript, Tailwind v4, Prisma 7 + Postgres (Neon), NextAuth v4 (Google OAuth), Cloudflare R2, puppeteer-core + system Chromium, tesseract/poppler OCR, archiver 7 (streaming ZIP — v8 dropped the callable export, keep 7 + `@types/archiver` 6). Heebo font, RTL, Hebrew UI.

### Critical non-obvious patterns

**Prisma 7 needs an adapter** — never `new PrismaClient()` alone:
```ts
import { PrismaPg } from "@prisma/adapter-pg";
const prisma = new PrismaClient({ adapter: new PrismaPg({ connectionString: process.env.DATABASE_URL! }) });
```
See `src/lib/db.ts` (singleton).

**shadcn/ui here uses @base-ui/react, NOT Radix.** No `asChild` — use the `render` prop; components carry `data-slot="..."`. Check the real source in `src/components/ui/` before copying patterns from docs/training.

**Mobile menu = HTML checkbox + CSS `peer-checked:`**, not React state (Safari iOS touch compat). See `Header.tsx`.

**RTL**: `dir="rtl" lang="he"` on `<html>`; sidebar on the right (`md:mr-64` on content). All UI text Hebrew.

**Dynamic route params are Promises**: `{ params }: { params: Promise<{ id: string }> }` → `const { id } = await params;`

**Tailwind v4** — `@theme inline` + OkLCH in `src/app/globals.css`.

**Never round monetary amounts** — show the exact value (₪47.65, not ₪48) in summaries, per-item displays, and PDF filenames. Use `toLocaleString(..., {maximumFractionDigits: 2})` / `Math.round(x*100)/100`, never `maximumFractionDigits: 0` on a real amount.

### Global state & long-running work (providers + floating widgets)

Long-running client work (Gmail sync, file upload) must **survive client-side navigation**. It lives in a context provider mounted in the **root layout** (`src/app/layout.tsx`), not in a page's local state — otherwise leaving the page unmounts it and the progress/result is lost (the fetch keeps running server-side, so data still saves, but the UI feedback vanishes).

Providers (root layout, order matters — keep the tree structure **stable**): `SessionProvider → ThemeProvider → SyncProvider → UploadProvider → PendingCountProvider`.
- `SyncProvider` / `UploadProvider` — hold the fetch + streamed progress; expose `startX()` + state. A matching floating widget (`SyncFloatingWidget`, `UploadFloatingWidget`, rendered in `src/app/(dashboard)/layout.tsx`) shows progress on every page **except** the page that owns the inline UI (`/settings`, `/upload`).
- `PendingCountProvider` — single source for the sidebar badge; both `Sidebar` and `Header` consume it (previously each polled independently).

**Provider gotcha (caused a real bug):** a provider must render the **same tree** on every render. `ThemeProvider` once returned a bare `<>{children}</>` until mounted then swapped to `<Ctx.Provider>` — that structural change **remounted the whole app on hydration**, firing every data fetch twice. Apply side effects (e.g. theme classes) in an effect; don't gate the tree shape.

### Streaming APIs

`/api/email-sync` and `/api/upload-invoices` return a **newline-delimited JSON stream** (not SSE): each line is `{type:"progress", message, current, total}` or `{type:"done", ...}`. Clients read via `response.body.getReader()`. The provider pattern above consumes these.

### Gmail integration

`src/lib/gmail.ts` wraps `googleapis` — OAuth (readonly + `gmail.send` scopes), `getGmailClient` (auto-refreshes tokens), `searchEmails`/`getAttachments` (sync), `sendGmailMessage` (MIME builder for send-email). Tokens live on the `EmailAccount` row.

**Do NOT import `src/lib/gmail.ts` from a route that runs on every page load.** The full `googleapis` package loads tens of MB into memory — enough to OOM the 512MB instance. Cheap scope checks (`canSendEmail`, scope constants) live in **`src/lib/gmail-scopes.ts`** (imports nothing heavy); import those on hot paths (e.g. `/api/settings`). `googleapis` should only load on real Gmail actions (sync / connect / callback / send).

Tokens expire (Google revokes refresh tokens after ~6 months idle → `invalid_grant`); the account must be reconnected. Sync surfaces per-account auth failures instead of reporting a silent empty success.

### File storage (R2)

Files in **Cloudflare R2** (S3-compatible); falls back to base64 in the DB `fileData` column when R2 env vars are unset. `src/lib/r2.ts` enforces limits (5MB/file, 500MB/user, 100 uploads/day). Invoice `filePath` starts with `r2://` and `fileUrl` holds the key. Preview/download/send auto-detect R2 vs DB-base64 vs local. Env: `CLOUDFLARE_ACCOUNT_ID`, `R2_ACCESS_KEY_ID`, `R2_SECRET_ACCESS_KEY`, `R2_BUCKET_NAME`.

### PDF / HTML→PDF

Ingest pipeline: `src/lib/pdf/split.ts` (pdf-lib, split by page) → `extract.ts` (pdfjs-dist, fallback pdftoppm+tesseract OCR) → `categorize.ts` (regex extraction of amount/currency/date/vendor/category/last-4). Handles Israeli (₪, מע"מ, DD/MM/YYYY) and international ($/€/£, ISO dates) invoices.

**`categorize.ts` non-obvious rules (all TDD-covered in `tests/unit/categorize.test.ts` — extend the tests when you touch these):**
- `detectCategory` matches keywords at a **Hebrew-aware word boundary** (`(?<![a-z0-9א-ת])[בהוכלמש]?<kw>`): a keyword may carry one Hebrew clitic prefix (בכלמ ה ו ש) but must not be embedded mid-word. This is why short keywords don't misfire — `"מים"` (water) does NOT match `"ימים"`/`"תשלומים"`, `"ten"` does not match `"content"` — while `"רמי לוי"` still matches inside `"ברמי לוי"`. Keep category keywords **specific**; generic footer words (tax/policy/total/yes/כלל) were removed because they stole categories.
- `extractAmount` must handle **currency-before-number** Israeli totals (`סה"כ בש"ח 273.90`, no ₪), not just number-before-currency. Missing this silently dropped real receipts as "no amount".
- `hasInvoiceSignals` (the email-ingest gate) requires a **strong** invoice keyword (חשבונית/קבלה/invoice/receipt/…) **OR** a parsed amount. Generic money words (תשלום/סכום/total/payment) are NOT sufficient — that's how a 24-page PayPal *User Agreement* once imported as 24 "invoices". "No amount" alone is NOT a safe non-invoice signal (fix the parser first).

`src/lib/html-to-pdf.ts` renders HTML invoices (inline-email invoices) to PDF via **puppeteer-core + system Chromium** (`CHROMIUM_PATH`, `/usr/bin/chromium` in Docker, local Chrome on macOS). It launches Chromium **per call and closes it immediately** (no persistent singleton) + `--single-process` flags — a resident Chromium (~150-300MB) OOMs the 512MB instance. Launches are also **serialized process-wide** via a queue in the module: two *concurrent* Chromiums (~300-600MB) are an instant OOM, so `htmlToPdf` runs one conversion at a time. Every caller (bulk-download, per-invoice download, send-email) goes through it.

### Invoice workflow

`pending → approved`. Upload/sync → OCR + categorize → saved `status:"pending"` (no Expense yet) → user reviews on `/invoices/pending` → approve → creates `Expense` (counts in dashboard). Approved invoices (`/invoices`) can be emailed to an accountant as per-invoice PDFs (`/api/invoices/send-email`), tracked via `InvoiceSend`. Both invoice pages share the same client-side filter/sort/paginate UX: a "מיין" sort dropdown + a collapsible "סינון" panel (date range, amount range + currency, category).

### Auth & sidebar

NextAuth v4 Google OAuth; session callback auto-creates the user. `src/lib/auth.ts` (config), `src/lib/api-auth.ts` (`getAuthUser()` for routes). `src/middleware.ts` redirects unauthenticated requests to `/login` (allowlists `/api/auth`, `/login`, `/api/email-accounts/callback`, `/tour`). Sidebar/Header nav items use an `exact` flag so a parent route (`/invoices`) doesn't stay highlighted on a child (`/invoices/pending`).

### Security invariants (do not regress)

- **Multi-tenant: every route that touches user data MUST scope by `userId`.** Either query `where: { …, userId: user.id }` or fetch then check `record.userId === user.id`. Anyone can register (open Google sign-up), so a missing check = IDOR. (This bit the download/preview/delete/approve invoice routes — now fixed.)
- **OAuth tokens are encrypted at rest** via `lib/crypto` (AES-256-GCM). The key derives from `GOOGLE_CLIENT_SECRET` (identical across local+Render, so both decrypt). Read/write tokens ONLY through `lib/gmail.ts` (`getGmailClient` decrypts, callback/refresh encrypt); never select them into an API response. `decryptToken` passes legacy plaintext through.
- **Throttle abuse-prone mutations.** `send-email` uses `lib/rate-limit` (10/min per user) so a session can't spam through the user's Gmail.
- Hardening headers live in `next.config.ts`. A full CSP is still TODO (must be tested against Next inline scripts / Google OAuth / avatars / R2).

## Deployment & runtime constraints

Deployed on **Render (Docker, Free tier: 512MB RAM, 0.1 CPU, spins down after ~15 min)**. Service `srv-d82olhv7f7vs738c5qdg`, URL `https://business-dashboard-362m.onrender.com`, auto-deploys on push to `main`.

Memory is tight — the Dockerfile sets `NODE_OPTIONS=--max-old-space-size=350` **after** the build step (V8 otherwise sizes its heap against host RAM and OOM-restarts the container). The 350MB heap cap leaves only ~160MB of native headroom, and one Chromium needs 150-300MB, so a single unbounded spike restarts the container.

**Memory invariants (do not regress — these are what fixed the recurring OOM):**
- **Serialize Chromium** — only through `htmlToPdf` (never launch puppeteer elsewhere); it queues launches so two never run at once.
- **Never `SELECT fileData` (the base64 blob) unless you actually stream the file.** List/aggregate endpoints (`/api/invoices`, `export`, `bulk`, `approve-all`, `dashboard`) use an **explicit `select`** that omits `fileData`. `include:{…}` returns every scalar (incl. `fileData`) — don't use it on invoice queries. The client fetches file bytes on demand via the preview/download routes.
- **Sum storage in SQL**, never by loading blobs — `email-sync` `getStorageUsed` / `getTotalStorageUsed` use `SUM(LENGTH("fileData"))`.
- **`bulk-download` streams the ZIP** (`archiver` → `Readable.toWeb` response), fetching one file at a time — it never buffers the whole archive, so "download all" is unbounded in count but bounded in memory.
- **`upload-invoices` processes one file at a time** (pre-count pages with `countPdfPages`, then split+process+release per file) rather than accumulating every page buffer.
- **No `googleapis` on hot paths** — only in real Gmail actions (see Gmail integration above); use `gmail-scopes.ts` for cheap checks.

The Render instance runs in **Oregon (US)** while Neon is in **Frankfurt (EU)** → cross-Atlantic latency on every query is the main speed bottleneck (plus 0.1 CPU). A GitHub Actions workflow (`.github/workflows/keep-alive.yml`) pings the app every 5 min to avoid cold-start spin-down.

## API routes (beyond the obvious CRUD)

`/api/invoices` (list, filterable) · `/api/invoices/[id]` (PATCH/DELETE) · `.../approve` · `.../unapprove` · `.../preview` · `.../download` (HTML→PDF on the fly) · `/api/invoices/bulk` (approve/delete) · `/api/invoices/approve-all` · `/api/invoices/bulk-download` (streaming ZIP via `archiver`) · `/api/invoices/export` (CSV) · `/api/invoices/send-email` (per-invoice PDFs → Gmail) · `/api/settings` (GET/PATCH accountant email + sender-account send flags; imports gmail-scopes, NOT gmail) · `/api/email-sync` + `/api/email-accounts/*` (Gmail connect/callback/sync) · `/api/dashboard` · `/api/pending-count`.

## Database

Models: `User` (has `accountantEmail`), `Category`, `CreditCard`, `Expense`, `Invoice` (`currency` ILS/USD/EUR/GBP, `fileHash` for dedup, `status`), `EmailAccount` (Gmail `accessToken`/`refreshToken`/`scopes`), `SyncRange` (sync history), `InvoiceSend` (email-send tracking). 13 seeded Hebrew categories (דלק, סופר, …, תוכנה, אחר). Relationships: Invoice→Category, Invoice→Expenses (1:many), Invoice→InvoiceSend (1:many), Expense→CreditCard (optional), EmailAccount→Invoice.

@AGENTS.md
