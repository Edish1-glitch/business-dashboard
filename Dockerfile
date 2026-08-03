FROM node:20-slim AS base

# Install tesseract + poppler for OCR, chromium for HTML-to-PDF
RUN apt-get update && apt-get install -y \
  tesseract-ocr \
  tesseract-ocr-heb \
  tesseract-ocr-eng \
  poppler-utils \
  chromium \
  && rm -rf /var/lib/apt/lists/*

ENV CHROMIUM_PATH=/usr/bin/chromium

WORKDIR /app

# Copy everything and install
COPY package.json package-lock.json ./
RUN npm ci

COPY . .

# Generate Prisma client
RUN npx prisma generate

# NEXT_PUBLIC_* vars are inlined into the client bundle at BUILD time, so they
# must be present during `npm run build` — runtime env vars are too late. Render
# supplies matching service env vars as build args when declared as ARG here.
ARG NEXT_PUBLIC_VAPID_PUBLIC_KEY
ENV NEXT_PUBLIC_VAPID_PUBLIC_KEY=$NEXT_PUBLIC_VAPID_PUBLIC_KEY

# Build Next.js
RUN npm run build

# Create uploads directory
RUN mkdir -p /app/uploads

EXPOSE 3000
ENV PORT=3000
ENV HOSTNAME="0.0.0.0"
ENV NODE_ENV=production

# Cap the V8 heap so it respects the 512MB container limit. Without this, V8
# sizes its old-space heap against the host's (much larger) RAM, lets the heap
# grow past 512MB, and the container gets OOM-killed and restarted. Set AFTER
# the build step so the memory-hungry `next build` is not throttled.
# Leaves headroom for native memory (Node runtime, buffers, Chromium on the PDF path).
ENV NODE_OPTIONS="--max-old-space-size=350"

# Push schema to DB then start server
CMD ["sh", "-c", "node scripts/setup-db.mjs && npm run start"]
