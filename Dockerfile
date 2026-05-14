FROM node:20-slim AS base

# Install tesseract + poppler for OCR
RUN apt-get update && apt-get install -y \
  tesseract-ocr \
  tesseract-ocr-heb \
  tesseract-ocr-eng \
  poppler-utils \
  && rm -rf /var/lib/apt/lists/*

WORKDIR /app

# Copy everything and install
COPY package.json package-lock.json ./
RUN npm ci

COPY . .

# Generate Prisma client
RUN npx prisma generate

# Build Next.js
RUN npm run build

# Create uploads directory
RUN mkdir -p /app/uploads

EXPOSE 3000
ENV PORT=3000
ENV HOSTNAME="0.0.0.0"
ENV NODE_ENV=production

# Push schema to DB then start server
CMD ["sh", "-c", "node scripts/setup-db.mjs && npm run start"]
