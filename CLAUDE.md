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
docker run -d --name findash-db -e POSTGRES_USER=findash -e POSTGRES_PASSWORD=findash_dev_password -e POSTGRES_DB=findash -p 5432:5432 postgres:16-alpine  # Start PostgreSQL
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

### Invoice Workflow

Invoices follow a pending → approved flow:
1. PDF uploaded → split into pages → OCR text extraction → auto-categorization
2. Invoices saved with `status: "pending"` (no Expense record created yet)
3. User reviews/edits on `/invoices/pending` page
4. On approval → Expense record created → counts in dashboard totals

### PDF Processing Pipeline

`src/lib/pdf/split.ts` → splits PDF by page (pdf-lib)
`src/lib/pdf/extract.ts` → text extraction (pdfjs-dist native, fallback: pdftoppm + tesseract OCR)
`src/lib/pdf/categorize.ts` → regex-based extraction of: amount, date, vendor, category, credit card last 4 digits

OCR requires `poppler` installed locally (`brew install poppler`) for `pdftoppm`.

### Sidebar Active State

Routes with sub-routes (like `/invoices` which has `/invoices/pending`) use `exact: true` flag to prevent both from highlighting. See navItems in `Sidebar.tsx` and `Header.tsx`.

### Temp Auth

All API routes use `TEMP_USER_ID = "temp-user-1"` — no real auth yet. Default user created via upsert on first API call.

## API Routes

- `POST /api/pdf-split` — upload PDF, split + OCR + categorize, save as pending
- `GET /api/invoices?status=pending&categoryId=X&from=DATE&to=DATE` — list invoices
- `PATCH /api/invoices/[id]` — edit invoice fields
- `POST /api/invoices/[id]/approve` — approve invoice → creates Expense
- `POST /api/invoices/approve-all` — batch approve all pending
- `GET /api/invoices/[id]/download` — download invoice PDF
- `GET/POST /api/categories` — list/create categories

## Database

12 default Hebrew categories seeded: דלק, סופר, מסעדות, תחבורה, ביטוח, תקשורת, חשמל ומים, שכירות, ציוד משרדי, שיווק ופרסום, מיסים, אחר.

Key relationships: Invoice → Category, Invoice → Expenses (1:many), Expense → CreditCard (optional).

@AGENTS.md
