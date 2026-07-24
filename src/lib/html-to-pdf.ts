import puppeteer, { Browser } from "puppeteer-core";

/**
 * Global one-at-a-time gate for Chromium launches.
 *
 * A single Chromium is ~150-300MB. On Render's 512MB instance TWO concurrent
 * conversions (e.g. a bulk-download rendering while a user downloads/sends
 * another invoice, or two browser tabs) push native memory past the limit and
 * the container is OOM-killed. Launching per-call already frees memory quickly,
 * but nothing serialized the calls — this queue guarantees only one htmlToPdf
 * runs at a time; the rest wait a beat. Errors are swallowed on the chain so a
 * single failed conversion never wedges the queue for everyone.
 */
let chromiumQueue: Promise<unknown> = Promise.resolve();
function withChromiumLock<T>(fn: () => Promise<T>): Promise<T> {
  const result = chromiumQueue.then(fn, fn);
  chromiumQueue = result.then(
    () => undefined,
    () => undefined
  );
  return result;
}

function getChromePath(): string {
  if (process.env.CHROMIUM_PATH) return process.env.CHROMIUM_PATH;
  if (process.platform === "darwin") {
    return "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome";
  }
  // Linux (Docker / Render)
  return "/usr/bin/chromium";
}

/**
 * Convert HTML to a PDF buffer.
 *
 * Memory note: we deliberately launch a FRESH Chromium per call and close it
 * immediately afterwards, rather than keeping a persistent singleton browser.
 * On Render's 512MB free instance a resident Chromium (~150-300MB) kept the
 * process near its memory ceiling and any conversion tipped it into an OOM
 * restart (observed 2026-07-21). Launching per-call releases that memory as
 * soon as the PDF is produced; the tradeoff is ~1s extra startup per call,
 * which is negligible for our volume. The extra flags (--single-process /
 * --no-zygote) further cut peak memory during conversion.
 */
export async function htmlToPdf(html: string): Promise<Buffer> {
  // Serialize all Chromium launches process-wide (see withChromiumLock above).
  return withChromiumLock(() => convertHtmlToPdf(html));
}

async function convertHtmlToPdf(html: string): Promise<Buffer> {
  const browser: Browser = await puppeteer.launch({
    headless: true,
    executablePath: getChromePath(),
    args: [
      "--no-sandbox",
      "--disable-setuid-sandbox",
      "--disable-dev-shm-usage",
      "--disable-gpu",
      "--single-process",
      "--no-zygote",
      "--disable-extensions",
    ],
  });

  try {
    const page = await browser.newPage();
    await page.setContent(html, { waitUntil: "domcontentloaded", timeout: 15000 });
    const pdf = await page.pdf({
      format: "A4",
      margin: { top: "10mm", bottom: "10mm", left: "10mm", right: "10mm" },
      printBackground: true,
    });
    return Buffer.from(pdf);
  } finally {
    // Always release Chromium's memory, even if conversion failed.
    try { await browser.close(); } catch { /* ignore */ }
  }
}
