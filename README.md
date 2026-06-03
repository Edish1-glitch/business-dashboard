<p align="center">
  <img src="https://img.shields.io/badge/Next.js-16-black?logo=next.js" alt="Next.js 16" />
  <img src="https://img.shields.io/badge/TypeScript-5-blue?logo=typescript" alt="TypeScript" />
  <img src="https://img.shields.io/badge/Tailwind-v4-38bdf8?logo=tailwindcss" alt="Tailwind v4" />
  <img src="https://img.shields.io/badge/PostgreSQL-Prisma%207-4169e1?logo=postgresql" alt="PostgreSQL" />
  <img src="https://img.shields.io/badge/Cloudflare-R2-f38020?logo=cloudflare" alt="R2" />
</p>

# FinDash - ניהול פיננסי חכם

דאשבורד מודרני לניהול חשבוניות והוצאות עסקיות. מסנכרן אוטומטית חשבוניות מ-Gmail, מזהה נתונים באמצעות OCR, ומציג הכל בממשק נוח ומותאם למובייל.

## תכונות עיקריות

### סנכרון Gmail
- חיבור חשבונות Gmail עם OAuth2
- משיכה אוטומטית של חשבוניות מצרופות (PDF, תמונות)
- חילוץ חשבוניות מגוף המייל (HTML) - תומך ב-PayPal, Google, NordVPN, Stripe ועוד
- סינון חכם - 50+ patterns לזיהוי קבצים שאינם חשבוניות
- Progress bar בזמן אמת עם floating widget

### זיהוי אוטומטי (OCR)
- חילוץ ספק, סכום, תאריך, קטגוריה וכרטיס אשראי
- תמיכה בחשבוניות ישראליות (₪, עברית) ובינלאומיות ($, €, £)
- 16 קטגוריות כולל "תוכנה" (Anthropic, AWS, GitHub...)
- Tesseract OCR עם תמיכה בעברית + אנגלית

### דאשבורד
- כרטיסי סיכום: סה"כ הוצאות, מאושרות, ממתינות, כרטיסי אשראי
- גרפים: עוגה לפי קטגוריה, עמודות חודשיות
- סינון לפי תאריכים (חודש, רבעון, שנה, מותאם)
- חשבוניות אחרונות

### ממתינות לאישור
- Statistics strip: סה"כ לפי מטבע, כמות, ממוצע
- חיפוש לפי ספק / קובץ / קטגוריה
- מיון לפי תאריך, סכום, ספק
- Thumbnail preview + HTML preview ב-iframe
- Bulk select, approve, delete
- Waiting indicator (כמה זמן ממתינה)
- פס צבעוני לפי קטגוריה

### תמיכה במטבעות
- ₪ (ILS), $ (USD), € (EUR), £ (GBP)
- Dropdown לבחירת מטבע בעריכה
- סיכום סה"כ לפי מטבע

### העלאת קבצים
- PDF, תמונות (JPG, PNG, WebP, HEIC), צילום מהמצלמה
- פיצול PDF אוטומטי לעמודים
- Streaming progress bar
- Duplicate detection (SHA-256 hash)

### אחסון ענן
- Cloudflare R2 (S3-compatible) - 10GB חינם
- הגבלות בטיחות: 5MB/קובץ, 500MB/משתמש
- Fallback ל-base64 ב-DB כשאין R2

### נוספים
- Dark mode עם תמיכה ב-system preference
- Tour אינטראקטיבי (7 שלבים) עם demo components
- Mobile responsive (נבדק על iPhone 16 Pro)
- Google OAuth authentication
- CSV export

## ארכיטקטורה

```
Next.js 16 (App Router)
├── Frontend: React + Tailwind CSS v4
├── Backend: API Routes + Prisma 7
├── Database: PostgreSQL (Render)
├── Storage: Cloudflare R2
├── Auth: NextAuth.js v4 + Google OAuth
├── OCR: Tesseract + pdftoppm (Poppler)
├── Email: Gmail API (googleapis)
└── Deploy: Render (Docker)
```

## מודל נתונים

```
User ─┬─ Invoice (fileName, vendor, amount, currency, date, category, status)
      ├─ Expense (amount, description, date, source, paymentMethod)
      ├─ EmailAccount (email, accessToken, refreshToken, lastSyncAt)
      ├─ CreditCard (name, lastFour)
      └─ Category (name, icon, color)

SyncRange (fromDate, toDate, invoicesFound) ── EmailAccount
```

## התקנה

### דרישות מקדימות
- Node.js 20+
- PostgreSQL 16
- Poppler (`brew install poppler`)
- Tesseract (`brew install tesseract tesseract-lang`)

### הגדרה

```bash
# Clone
git clone https://github.com/Edish1-glitch/business-dashboard.git
cd business-dashboard

# Install
npm install

# Environment
cp .env.example .env
# Edit .env with your values

# Database
npx prisma db push
npx prisma generate
npx tsx prisma/seed.ts

# Run
npm run dev
```

## Environment Variables

| Variable | Description |
|----------|------------|
| `DATABASE_URL` | PostgreSQL connection string |
| `GOOGLE_CLIENT_ID` | Google OAuth client ID |
| `GOOGLE_CLIENT_SECRET` | Google OAuth client secret |
| `NEXTAUTH_SECRET` | NextAuth session secret |
| `NEXTAUTH_URL` | App base URL |
| `CLOUDFLARE_ACCOUNT_ID` | Cloudflare account ID |
| `R2_ACCESS_KEY_ID` | R2 S3 access key |
| `R2_SECRET_ACCESS_KEY` | R2 S3 secret key |
| `R2_BUCKET_NAME` | R2 bucket name |

## API Routes

| Method | Route | Description |
|--------|-------|-------------|
| `POST` | `/api/upload-invoices` | Upload + OCR + categorize |
| `GET` | `/api/invoices?status=pending` | List invoices |
| `PATCH` | `/api/invoices/[id]` | Edit invoice |
| `DELETE` | `/api/invoices/[id]` | Delete invoice + R2 file |
| `POST` | `/api/invoices/[id]/approve` | Approve → create Expense |
| `POST` | `/api/invoices/bulk` | Bulk approve/delete |
| `GET` | `/api/invoices/[id]/preview` | Preview (image/HTML/PDF) |
| `GET` | `/api/invoices/[id]/download` | Download file |
| `POST` | `/api/email-sync` | Gmail sync (streaming) |
| `GET` | `/api/email-accounts` | List Gmail accounts |
| `GET` | `/api/email-accounts/connect` | Gmail OAuth flow |
| `GET` | `/api/dashboard` | Dashboard stats + charts |
| `GET` | `/api/pending-count` | Sidebar badge count |
| `GET/POST` | `/api/categories` | List/create categories |

## Deploy

Deployed on [Render](https://render.com) with Docker.

```dockerfile
FROM node:20-slim
# Installs tesseract-ocr + poppler-utils for OCR
RUN apt-get install -y tesseract-ocr tesseract-ocr-heb poppler-utils
```

## License

Private project.
