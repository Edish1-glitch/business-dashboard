FROM node:20-slim AS base

# Install tesseract + poppler for OCR
RUN apt-get update && apt-get install -y \
  tesseract-ocr \
  tesseract-ocr-heb \
  tesseract-ocr-eng \
  poppler-utils \
  && rm -rf /var/lib/apt/lists/*

WORKDIR /app

# Install dependencies
FROM base AS deps
COPY package.json package-lock.json ./
RUN npm ci --omit=dev

# Build
FROM base AS builder
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci
COPY . .
RUN npx prisma generate
RUN npm run build

# Production
FROM base AS runner
WORKDIR /app
ENV NODE_ENV=production

RUN mkdir -p /app/uploads

# Copy standalone build
COPY --from=builder /app/public ./public
COPY --from=builder /app/.next/standalone ./
COPY --from=builder /app/.next/static ./.next/static

# Copy prisma schema, config, and generated client
COPY --from=builder /app/prisma ./prisma
COPY --from=builder /app/prisma.config.ts ./prisma.config.ts
COPY --from=builder /app/src/generated ./src/generated
COPY --from=builder /app/scripts ./scripts
COPY --from=builder /app/package.json ./package.json

# Copy production node_modules + prisma CLI from builder
COPY --from=deps /app/node_modules ./node_modules
COPY --from=builder /app/node_modules/prisma ./node_modules/prisma
COPY --from=builder /app/node_modules/@prisma/engines ./node_modules/@prisma/engines

EXPOSE 3000
ENV PORT=3000
ENV HOSTNAME="0.0.0.0"

# Push schema to DB then start server
CMD ["sh", "-c", "node scripts/setup-db.mjs && node server.js"]
