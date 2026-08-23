import { describe, it, expect } from "vitest";
import { createHash } from "crypto";
import { PDFDocument } from "pdf-lib";
import { splitPdfToPages, countPdfPages } from "@/lib/pdf/split";

// Build a small multi-page PDF in-memory (no fixtures, no network).
async function makePdf(pageCount: number): Promise<Buffer> {
  const doc = await PDFDocument.create();
  for (let i = 0; i < pageCount; i++) {
    doc.addPage([300, 300]).drawText(`page ${i + 1}`);
  }
  return Buffer.from(await doc.save());
}

const sha = (b: Buffer) => createHash("sha256").update(b).digest("hex");

describe("splitPdfToPages", () => {
  it("splits into one buffer per page", async () => {
    const pdf = await makePdf(3);
    const pages = await splitPdfToPages(pdf);
    expect(pages).toHaveLength(3);
  });

  // This is the guard for the "flood" bug: the background cron re-splits the same
  // Gmail attachment every run, and dedup keys off sha256(pageBytes). If the split
  // isn't byte-deterministic the hash changes each pass and the invoice is
  // re-imported forever. Splitting the SAME source twice must yield identical bytes.
  it("is byte-deterministic — same source page yields the same hash across runs", async () => {
    const pdf = await makePdf(2);
    const first = await splitPdfToPages(pdf);
    // Re-load and split the exact same source bytes a moment later.
    const second = await splitPdfToPages(pdf);
    expect(first.map(sha)).toEqual(second.map(sha));
  });

  it("counts pages without splitting", async () => {
    const pdf = await makePdf(5);
    expect(await countPdfPages(pdf)).toBe(5);
  });
});
