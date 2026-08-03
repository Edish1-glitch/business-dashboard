/**
 * One-time cache warmer for invoice previews.
 *
 * Renders the first page of every pending PDF invoice to PNG (locally, via
 * pdftoppm) and uploads it to R2 at `previews/<id>.png` — the exact key the
 * app's preview route reads. This warms the backlog without hammering the tiny
 * Render instance; new invoices cache lazily on first view.
 *
 * Run:  set -a && . ./.env && set +a && npx tsx scripts/backfill-previews.ts
 * Add `all` as an arg to also warm approved invoices:  ... backfill-previews.ts all
 */
import { PrismaClient } from "../src/generated/prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
import { S3Client, GetObjectCommand, PutObjectCommand, HeadObjectCommand } from "@aws-sdk/client-s3";
import { execFile } from "child_process";
import { promisify } from "util";
import { writeFile, readFile, mkdtemp, rm } from "fs/promises";
import path from "path";
import os from "os";

const execFileAsync = promisify(execFile);
const prisma = new PrismaClient({ adapter: new PrismaPg({ connectionString: process.env.DATABASE_URL! }) });

const BUCKET = process.env.R2_BUCKET_NAME || "findash-invoices";
const s3 = new S3Client({
  region: "auto",
  endpoint: `https://${process.env.CLOUDFLARE_ACCOUNT_ID}.r2.cloudflarestorage.com`,
  credentials: {
    accessKeyId: process.env.R2_ACCESS_KEY_ID!,
    secretAccessKey: process.env.R2_SECRET_ACCESS_KEY!,
  },
});

async function r2Download(key: string): Promise<Buffer> {
  const res = await s3.send(new GetObjectCommand({ Bucket: BUCKET, Key: key }));
  const chunks: Uint8Array[] = [];
  for await (const chunk of res.Body as AsyncIterable<Uint8Array>) chunks.push(chunk);
  return Buffer.concat(chunks);
}

async function r2Exists(key: string): Promise<boolean> {
  try { await s3.send(new HeadObjectCommand({ Bucket: BUCKET, Key: key })); return true; }
  catch { return false; }
}

async function sourceBuffer(inv: { fileData: string | null; fileUrl: string | null; filePath: string }): Promise<Buffer> {
  if (inv.fileUrl && inv.filePath.startsWith("r2://")) return await r2Download(inv.fileUrl);
  if (inv.fileData) return Buffer.from(inv.fileData, "base64");
  return await readFile(inv.filePath);
}

async function renderPdf(pdf: Buffer): Promise<Buffer> {
  const tmp = await mkdtemp(path.join(os.tmpdir(), "backfill-preview-"));
  try {
    const pdfPath = path.join(tmp, "input.pdf");
    await writeFile(pdfPath, pdf);
    await execFileAsync("pdftoppm", ["-png", "-r", "150", "-singlefile", pdfPath, path.join(tmp, "page")]);
    return await readFile(path.join(tmp, "page.png"));
  } finally {
    await rm(tmp, { recursive: true, force: true });
  }
}

async function main() {
  const includeAll = process.argv.includes("all");
  const where = includeAll ? {} : { status: "pending" };
  const invoices = await prisma.invoice.findMany({
    where,
    select: { id: true, fileName: true, filePath: true, fileUrl: true, fileData: true },
  });

  const pdfs = invoices.filter(
    (i) => !i.fileName.endsWith(".html") && i.filePath !== "inline-html" && !/\.(jpg|jpeg|png|webp)$/i.test(i.fileName)
  );
  console.log(`Found ${invoices.length} invoices; ${pdfs.length} PDF candidates. Warming...`);

  let done = 0, skipped = 0, failed = 0;
  for (const inv of pdfs) {
    const key = `previews/${inv.id}.png`;
    try {
      if (await r2Exists(key)) { skipped++; continue; }
      const png = await renderPdf(await sourceBuffer(inv));
      await s3.send(new PutObjectCommand({ Bucket: BUCKET, Key: key, Body: png, ContentType: "image/png" }));
      done++;
      if (done % 10 === 0) console.log(`  cached ${done} (skipped ${skipped}, failed ${failed})`);
    } catch (e) {
      failed++;
      console.warn(`  ✗ ${inv.id} (${inv.fileName}): ${(e as Error).message}`);
    }
  }
  console.log(`\nDone. cached ${done}, already-cached ${skipped}, failed ${failed}.`);
  await prisma.$disconnect();
}

main().catch((e) => { console.error(e); process.exit(1); });
