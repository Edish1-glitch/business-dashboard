# FinDash - Business Finance Dashboard

## Project Overview
אפליקציית דאשבורד לניהול פיננסי אישי/עסקי. כוללת ניהול חשבוניות, פיצול PDF, אינטגרציה עם Gmail וחשבונית ירוקה.

## Tech Stack
- **Framework**: Next.js 16 (App Router) + TypeScript
- **UI**: Tailwind CSS v4 + shadcn/ui (base-ui, NOT Radix - no `asChild`, use `render` prop instead)
- **Database**: PostgreSQL + Prisma 7 ORM (requires adapter - see `src/lib/db.ts`)
- **Icons**: lucide-react

## Key Architecture Notes
- RTL layout (Hebrew) - `dir="rtl"` on `<html>`
- Prisma 7 uses `@prisma/adapter-pg` - PrismaClient requires `{ adapter }` option
- Generated Prisma client at `src/generated/prisma/` (gitignored, run `npx prisma generate`)
- shadcn/ui components use `@base-ui/react` (NOT Radix UI) - check component source before using patterns from older docs

## Commands
- `npm run dev` - Start dev server
- `npx next build` - Production build
- `npx prisma generate` - Generate Prisma client
- `npx prisma db push` - Push schema to DB
- `docker compose up -d` - Start PostgreSQL

## Project Structure
```
src/
  app/              # Next.js App Router pages
  components/
    layout/         # Sidebar, Header
    dashboard/      # Dashboard-specific components
    ui/             # shadcn/ui components
  generated/prisma/ # Generated Prisma client (gitignored)
  lib/
    db.ts           # Prisma client singleton
    utils.ts        # Utility functions
prisma/
  schema.prisma     # Database schema
  seed.ts           # Seed data (categories)
```

## Development Setup
1. `docker compose up -d` (PostgreSQL)
2. `npx prisma db push`
3. `npx prisma db seed` (default categories)
4. `npm run dev`

@AGENTS.md
