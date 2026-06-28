import puppeteer, { Browser } from "puppeteer";

let browserInstance: Browser | null = null;

async function getBrowser(): Promise<Browser> {
  if (browserInstance) {
    try {
      if (browserInstance.connected) return browserInstance;
    } catch { /* browser crashed */ }
    try { await browserInstance.close(); } catch { /* ignore */ }
    browserInstance = null;
  }
  browserInstance = await puppeteer.launch({
    headless: true,
    args: [
      "--no-sandbox",
      "--disable-setuid-sandbox",
      "--disable-dev-shm-usage",
      "--disable-gpu",
    ],
  });
  return browserInstance;
}

export async function htmlToPdf(html: string): Promise<Buffer> {
  let browser: Browser;
  try {
    browser = await getBrowser();
  } catch (err) {
    browserInstance = null;
    browser = await getBrowser();
  }

  const page = await browser.newPage();
  try {
    await page.setContent(html, { waitUntil: "domcontentloaded", timeout: 15000 });
    const pdf = await page.pdf({
      format: "A4",
      margin: { top: "10mm", bottom: "10mm", left: "10mm", right: "10mm" },
      printBackground: true,
    });
    return Buffer.from(pdf);
  } finally {
    try { await page.close(); } catch { /* ignore */ }
  }
}
