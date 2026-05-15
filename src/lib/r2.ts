import { S3Client, PutObjectCommand, GetObjectCommand, DeleteObjectCommand, HeadObjectCommand } from "@aws-sdk/client-s3";

// ===== SAFETY LIMITS =====
// These limits ensure we never exceed the free tier
const LIMITS = {
  MAX_FILE_SIZE: 5 * 1024 * 1024,        // 5MB per file
  MAX_STORAGE_PER_USER: 500 * 1024 * 1024, // 500MB per user (20 users = 10GB max)
  MAX_TOTAL_STORAGE: 8 * 1024 * 1024 * 1024, // 8GB total (leave 2GB buffer from 10GB free)
  MAX_UPLOADS_PER_DAY: 100,                // max 100 uploads per day per user
  MAX_FILES_PER_UPLOAD: 20,                // max 20 files per single upload
};

export { LIMITS as R2_LIMITS };

// R2 client (S3-compatible)
let r2Client: S3Client | null = null;

function getR2Client(): S3Client {
  if (r2Client) return r2Client;

  const accountId = process.env.CLOUDFLARE_ACCOUNT_ID;
  const accessKeyId = process.env.R2_ACCESS_KEY_ID;
  const secretAccessKey = process.env.R2_SECRET_ACCESS_KEY;

  if (!accountId || !accessKeyId || !secretAccessKey) {
    throw new Error("R2 credentials not configured");
  }

  r2Client = new S3Client({
    region: "auto",
    endpoint: `https://${accountId}.r2.cloudflarestorage.com`,
    credentials: { accessKeyId, secretAccessKey },
  });

  return r2Client;
}

const BUCKET = process.env.R2_BUCKET_NAME || "findash-invoices";

/**
 * Check if R2 is configured (env vars present)
 */
export function isR2Configured(): boolean {
  return !!(
    process.env.CLOUDFLARE_ACCOUNT_ID &&
    process.env.R2_ACCESS_KEY_ID &&
    process.env.R2_SECRET_ACCESS_KEY
  );
}

/**
 * Upload a file to R2 with safety checks.
 * Key format: {userId}/{timestamp}-{fileName}
 */
export async function uploadToR2(
  buffer: Buffer,
  fileName: string,
  userId: string,
  contentType: string = "application/octet-stream"
): Promise<{ key: string; size: number }> {
  // Safety check: file size
  if (buffer.length > LIMITS.MAX_FILE_SIZE) {
    throw new Error(`קובץ גדול מדי (${(buffer.length / 1024 / 1024).toFixed(1)}MB). מקסימום ${LIMITS.MAX_FILE_SIZE / 1024 / 1024}MB`);
  }

  const client = getR2Client();
  const timestamp = Date.now();
  const safeFileName = fileName.replace(/[^a-zA-Z0-9._\-\u0590-\u05FF]/g, "_");
  const key = `${userId}/${timestamp}-${safeFileName}`;

  await client.send(new PutObjectCommand({
    Bucket: BUCKET,
    Key: key,
    Body: buffer,
    ContentType: contentType,
  }));

  return { key, size: buffer.length };
}

/**
 * Download a file from R2.
 */
export async function downloadFromR2(key: string): Promise<{ buffer: Buffer; contentType: string }> {
  const client = getR2Client();

  const response = await client.send(new GetObjectCommand({
    Bucket: BUCKET,
    Key: key,
  }));

  const chunks: Uint8Array[] = [];
  const stream = response.Body as AsyncIterable<Uint8Array>;
  for await (const chunk of stream) {
    chunks.push(chunk);
  }

  return {
    buffer: Buffer.concat(chunks),
    contentType: response.ContentType || "application/octet-stream",
  };
}

/**
 * Delete a file from R2.
 */
export async function deleteFromR2(key: string): Promise<void> {
  const client = getR2Client();
  await client.send(new DeleteObjectCommand({
    Bucket: BUCKET,
    Key: key,
  }));
}

/**
 * Check if a file exists in R2.
 */
export async function existsInR2(key: string): Promise<boolean> {
  try {
    const client = getR2Client();
    await client.send(new HeadObjectCommand({
      Bucket: BUCKET,
      Key: key,
    }));
    return true;
  } catch {
    return false;
  }
}
