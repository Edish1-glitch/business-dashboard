# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

```bash
npm run dev                    # Start dev server (Turbopack)
npm run build                  # Production build
npm run lint                   # ESLint
npx playwright test            # Run all E2E tests (18 tests: desktop/mobile/tablet)
npx playwright test --grep "Mobile"  # Run specific test group
npx prisma generate           # Regenerate Prisma client (after schema changes)
npx prisma db push            # Push schema to running DB
DATABASE_URL="postgresql://findash:findash_dev_password@localhost:5432/findash?schema=public" npx tsx prisma/seed.ts  # Seed categories
brew services start postgresql@16  # Start local PostgreSQL (native, not Docker)
```

## Architecture

**Stack**: Next.js 16 (App Router) + TypeScript, Tailwind CSS v4, PostgreSQL + Prisma 7, Heebo font (Hebrew)

### Critical: Non-Obvious Patterns

**Prisma 7 requires an adapter** — you cannot write `new PrismaClient()`. Must use:
```ts
import { PrismaPg } from "@prisma/adapter-pg";
const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL! });
const prisma = new PrismaClient({ adapter });
```
See `src/lib/db.ts` for the singleton pattern. Generated client lives at `src/generated/prisma/` (gitignored).

**shadcn/ui uses @base-ui/react, NOT Radix UI.** There is no `asChild` prop. Use `render` prop instead. Components use `data-slot="..."` attributes. Always check the actual component source in `src/components/ui/` before using patterns from docs or training data.

**Mobile menu uses HTML checkbox + CSS `peer-checked:`** — not React state. This was required for Safari iOS touch compatibility. The `<label htmlFor>` toggles a hidden checkbox, and CSS `peer-checked:` controls sidebar visibility. See `src/components/layout/Header.tsx`.

**RTL layout** — `dir="rtl"` + `lang="he"` on `<html>`. Sidebar is on the right (`md:mr-64` on content). All UI text is Hebrew.

**Dynamic route params are Promises** in Next.js 16:
```ts
{ params }: { params: Promise<{ id: string }> }
const { id } = await params;
```

**Tailwind v4** uses `@theme inline` in CSS with OkLCH color space. See `src/app/globals.css`.

### File Storage

Files are stored in **Cloudflare R2** (S3-compatible). When R2 env vars are not set, falls back to base64 in DB.
- `src/lib/r2.ts` — R2 client with built-in safety limits (5MB/file, 500MB/user, 100 uploads/day)
- Upload: `uploadToR2()` → stores file, returns key
- Download: `downloadFromR2(key)` → returns buffer
- Invoice `filePath` starts with `r2://` for R2-stored files, `fileUrl` holds the R2 key
- Preview/download APIs auto-detect source (R2 vs DB base64 vs local filesystem)

Required env vars: `CLOUDFLARE_ACCOUNT_ID`, `R2_ACCESS_KEY_ID`, `R2_SECRET_ACCESS_KEY`, `R2_BUCKET_NAME`

### Invoice Workflow

Invoices follow a pending → approved flow:
1. PDF/image uploaded → split into pages → OCR text extraction → auto-categorization
2. Invoices saved with `status: "pending"` + file in R2 (no Expense record yet)
3. User reviews/edits on `/invoices/pending` page (supports bulk select, approve, delete)
4. On approval → Expense record created → counts in dashboard totals

### PDF Processing Pipeline

`src/lib/pdf/split.ts` → splits PDF by page (pdf-lib)
`src/lib/pdf/extract.ts` → text extraction (pdfjs-dist native, fallback: pdftoppm + tesseract OCR)
`src/lib/pdf/categorize.ts` → regex-based extraction of: amount, currency, date, vendor, category, credit card last 4 digits

**Supports both Israeli and international invoices:**
- Israeli: ₪, NIS, סה"כ כולל מע"מ, DD/MM/YYYY
- International: $, €, £, USD/EUR/GBP, Total/Amount Due, Jan-Dec months, ISO dates
- 13 categories including "תוכנה" (software/SaaS: Anthropic, AWS, GitHub, etc.)

OCR requires `poppler` installed locally (`brew install poppler`) for `pdftoppm`.

### Auth

Google OAuth via NextAuth.js v4. Session callback auto-creates user in DB if missing.
See `src/lib/auth.ts` for config, `src/lib/api-auth.ts` for API route helper.

### Sidebar Active State

Routes with sub-routes (like `/invoices` which has `/invoices/pending`) use `exact: true` flag to prevent both from highlighting. See navItems in `Sidebar.tsx` and `Header.tsx`.

## API Routes

- `POST /api/upload-invoices` — upload files (PDF/images), OCR + categorize, save to R2, streaming progress
- `GET /api/invoices?status=pending&categoryId=X&from=DATE&to=DATE` — list invoices
- `PATCH /api/invoices/[id]` — edit invoice fields
- `DELETE /api/invoices/[id]` — delete invoice + R2 file + associated expenses
- `POST /api/invoices/[id]/approve` — approve invoice → creates Expense
- `POST /api/invoices/bulk` — bulk approve or delete: `{ action: "approve"|"delete", ids: [...] }`
- `POST /api/invoices/approve-all` — batch approve all pending
- `GET /api/invoices/[id]/preview` — preview as image (supports R2/DB/local)
- `GET /api/invoices/[id]/download` — download file (supports R2/DB/local)
- `GET /api/dashboard` — summary stats, charts data, recent invoices
- `GET /api/pending-count` — pending invoice count for sidebar badge
- `GET/POST /api/categories` — list/create categories

## Database

13 default Hebrew categories seeded: דלק, סופר, מסעדות, תחבורה, ביטוח, תקשורת, חשמל ומים, שכירות, ציוד משרדי, שיווק ופרסום, מיסים, תוכנה, אחר.

Key relationships: Invoice → Category, Invoice → Expenses (1:many), Expense → CreditCard (optional).

Invoice has `currency` field (ILS/USD/EUR/GBP) for international invoice support.

## Deployment

Deployed on Render (Docker + PostgreSQL). Cloudflare R2 for file storage.
R2 env vars must be set on Render for production file storage.

@AGENTS.md
