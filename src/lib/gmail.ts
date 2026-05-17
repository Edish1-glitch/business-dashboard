import { google, gmail_v1 } from "googleapis";
import { prisma } from "@/lib/db";
import { R2_LIMITS } from "@/lib/r2";

const SCOPES = ["https://www.googleapis.com/auth/gmail.readonly"];
const REDIRECT_PATH = "/api/email-accounts/callback";

function getOAuth2Client() {
  return new google.auth.OAuth2(
    process.env.GOOGLE_CLIENT_ID,
    process.env.GOOGLE_CLIENT_SECRET,
    `${process.env.NEXTAUTH_URL}${REDIRECT_PATH}`
  );
}

/**
 * Generate Google OAuth URL for Gmail access.
 * State contains userId for the callback.
 */
export function getGmailAuthUrl(userId: string): string {
  const oauth2Client = getOAuth2Client();
  const state = Buffer.from(JSON.stringify({
    userId,
    ts: Date.now(),
  })).toString("base64url");

  return oauth2Client.generateAuthUrl({
    access_type: "offline",
    prompt: "consent",
    scope: SCOPES,
    state,
  });
}

/**
 * Validate and decode the OAuth state parameter.
 * Returns userId or null if invalid/expired (10 min TTL).
 */
export function validateState(state: string): string | null {
  try {
    const data = JSON.parse(Buffer.from(state, "base64url").toString());
    if (Date.now() - data.ts > 10 * 60 * 1000) return null; // expired
    return data.userId || null;
  } catch {
    return null;
  }
}

/**
 * Exchange authorization code for tokens and get user email.
 */
export async function exchangeCodeForTokens(code: string) {
  const oauth2Client = getOAuth2Client();
  const { tokens } = await oauth2Client.getToken(code);

  oauth2Client.setCredentials(tokens);

  // Get the user's email
  const gmail = google.gmail({ version: "v1", auth: oauth2Client });
  const profile = await gmail.users.getProfile({ userId: "me" });

  return {
    email: profile.data.emailAddress!,
    accessToken: tokens.access_token!,
    refreshToken: tokens.refresh_token!,
    expiresAt: tokens.expiry_date ? new Date(tokens.expiry_date) : null,
  };
}

/**
 * Get an authenticated Gmail client for an EmailAccount.
 * Auto-refreshes expired tokens.
 */
export async function getGmailClient(
  emailAccount: { id: string; accessToken: string | null; refreshToken: string | null; tokenExpiresAt: Date | null }
): Promise<gmail_v1.Gmail> {
  if (!emailAccount.accessToken || !emailAccount.refreshToken) {
    throw new Error("חשבון אימייל לא מחובר כראוי");
  }

  const oauth2Client = getOAuth2Client();
  oauth2Client.setCredentials({
    access_token: emailAccount.accessToken,
    refresh_token: emailAccount.refreshToken,
    expiry_date: emailAccount.tokenExpiresAt?.getTime(),
  });

  // Auto-refresh if expired or about to expire (5 min buffer)
  const expiresAt = emailAccount.tokenExpiresAt?.getTime() || 0;
  if (Date.now() > expiresAt - 5 * 60 * 1000) {
    const { credentials } = await oauth2Client.refreshAccessToken();
    oauth2Client.setCredentials(credentials);

    // Update tokens in DB
    await prisma.emailAccount.update({
      where: { id: emailAccount.id },
      data: {
        accessToken: credentials.access_token,
        tokenExpiresAt: credentials.expiry_date ? new Date(credentials.expiry_date) : null,
        ...(credentials.refresh_token && { refreshToken: credentials.refresh_token }),
      },
    });
  }

  return google.gmail({ version: "v1", auth: oauth2Client });
}

/**
 * Search Gmail for invoice-related emails in a date range.
 * Two strategies:
 * 1. Emails with PDF/image attachments (original)
 * 2. Emails with invoice keywords in subject (catches inline HTML invoices)
 */
export async function searchEmails(
  gmail: gmail_v1.Gmail,
  afterDate: Date,
  beforeDate?: Date | null
): Promise<string[]> {
  const afterStr = `${afterDate.getFullYear()}/${String(afterDate.getMonth() + 1).padStart(2, "0")}/${String(afterDate.getDate()).padStart(2, "0")}`;
  let dateFilter = `after:${afterStr}`;
  if (beforeDate) {
    const beforeStr = `${beforeDate.getFullYear()}/${String(beforeDate.getMonth() + 1).padStart(2, "0")}/${String(beforeDate.getDate()).padStart(2, "0")}`;
    dateFilter += ` before:${beforeStr}`;
  }

  // Strategy 1: Attachments (PDF/images) - but filter by invoice-related subjects
  const attachmentQuery = `has:attachment (filename:pdf OR filename:jpg OR filename:jpeg OR filename:png) ${dateFilter} -subject:(newsletter OR עדכון OR הודעה OR "terms of service" OR שינוי OR עלון OR ברכות)`;

  // Strategy 2: Invoice keywords in subject (catches inline HTML invoices from PayPal, Uber, etc.)
  const subjectQuery = `subject:(חשבונית OR קבלה OR receipt OR invoice OR "tax invoice" OR "order confirmation" OR הזמנה OR תשלום OR payment OR billing) ${dateFilter} -subject:(newsletter OR spam)`;

  const allIds = new Set<string>();

  // Run both queries
  for (const query of [attachmentQuery, subjectQuery]) {
    let pageToken: string | undefined;

    do {
      const res = await gmail.users.messages.list({
        userId: "me",
        q: query,
        maxResults: 100,
        pageToken,
      });

      if (res.data.messages) {
        for (const msg of res.data.messages) {
          if (msg.id) allIds.add(msg.id);
        }
      }

      pageToken = res.data.nextPageToken || undefined;
      if (pageToken) await new Promise((r) => setTimeout(r, 100));
    } while (pageToken);
  }

  return [...allIds];
}

export interface EmailAttachment {
  fileName: string;
  buffer: Buffer;
  mimeType: string;
  messageDate: Date | null;
  subject: string;
  from: string;
}

/**
 * Extract inline invoice data from email HTML body.
 * Catches invoices from PayPal, Uber, Wolt, Google, AWS, Stripe etc.
 * that are embedded in the email and not attached as PDF.
 */
export interface InlineInvoice {
  subject: string;
  from: string;
  date: Date | null;
  htmlBody: string;
  textBody: string;
}

export async function getInlineInvoice(
  gmail: gmail_v1.Gmail,
  messageId: string
): Promise<InlineInvoice | null> {
  const msg = await gmail.users.messages.get({
    userId: "me",
    id: messageId,
    format: "full",
  });

  const headers = msg.data.payload?.headers || [];
  const subject = headers.find((h) => h.name?.toLowerCase() === "subject")?.value || "";
  const from = headers.find((h) => h.name?.toLowerCase() === "from")?.value || "";
  const dateHeader = headers.find((h) => h.name?.toLowerCase() === "date")?.value;
  const date = dateHeader ? new Date(dateHeader) : null;

  // Check if this email has PDF attachments - if so, skip inline extraction
  // (the attachment handler already processes these)
  let hasInvoiceAttachment = false;
  function checkForAttachments(parts: gmail_v1.Schema$MessagePart[] | undefined) {
    if (!parts) return;
    for (const part of parts) {
      if (part.filename && part.filename.length > 0 && part.body?.attachmentId) {
        const lower = part.filename.toLowerCase();
        if (lower.endsWith(".pdf") && !shouldSkipFile(part.filename)) {
          hasInvoiceAttachment = true;
        }
      }
      if (part.parts) checkForAttachments(part.parts);
    }
  }
  checkForAttachments(msg.data.payload?.parts);
  if (hasInvoiceAttachment) return null; // Already handled by attachment processing

  // Extract HTML and text body
  let htmlBody = "";
  let textBody = "";

  function extractBody(parts: gmail_v1.Schema$MessagePart[] | undefined) {
    if (!parts) return;
    for (const part of parts) {
      if (part.mimeType === "text/html" && part.body?.data) {
        htmlBody += Buffer.from(part.body.data, "base64url").toString("utf-8");
      }
      if (part.mimeType === "text/plain" && part.body?.data) {
        textBody += Buffer.from(part.body.data, "base64url").toString("utf-8");
      }
      if (part.parts) extractBody(part.parts);
    }
  }

  // Handle single-part messages
  if (msg.data.payload?.mimeType === "text/html" && msg.data.payload?.body?.data) {
    htmlBody = Buffer.from(msg.data.payload.body.data, "base64url").toString("utf-8");
  } else if (msg.data.payload?.mimeType === "text/plain" && msg.data.payload?.body?.data) {
    textBody = Buffer.from(msg.data.payload.body.data, "base64url").toString("utf-8");
  } else {
    extractBody(msg.data.payload?.parts);
  }

  if (!htmlBody && !textBody) return null;

  // Check if the email body looks like it contains invoice/receipt data
  const bodyToCheck = (htmlBody + textBody).toLowerCase();
  const invoiceKeywords = [
    "total", "amount", "סה\"כ", "סכום", "לתשלום", "מע\"מ", "vat", "tax",
    "invoice", "receipt", "חשבונית", "קבלה", "order", "הזמנה",
    "payment", "תשלום", "charged", "חויב", "billing",
    "$", "₪", "€", "£", "usd", "ils",
  ];

  const matchCount = invoiceKeywords.filter((kw) => bodyToCheck.includes(kw)).length;
  if (matchCount < 3) return null; // Need at least 3 invoice keywords

  return { subject, from, date, htmlBody, textBody };
}

/**
 * Strip HTML tags and extract plain text for OCR/categorization.
 */
export function htmlToText(html: string): string {
  return html
    .replace(/<style[^>]*>[\s\S]*?<\/style>/gi, "")
    .replace(/<script[^>]*>[\s\S]*?<\/script>/gi, "")
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/<\/?(p|div|tr|li|h[1-6])[^>]*>/gi, "\n")
    .replace(/<\/?(td|th)[^>]*>/gi, " ")
    .replace(/<[^>]+>/g, "")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#?\w+;/g, "")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

/**
 * Filter out files that are clearly NOT invoices based on filename patterns.
 * Returns true if the file should be SKIPPED (not an invoice).
 *
 * Sources for patterns:
 * - Israeli invoice requirements: must contain "חשבונית מס" or "עוסק מורשה"
 * - Common email signature/logo filenames from corporate email systems
 * - Legal/insurance document patterns from Israeli businesses
 */
function shouldSkipFile(fileName: string): boolean {
  const lower = fileName.toLowerCase();

  const skipPatterns = [
    // ===== Legal / Terms / Agreements (Hebrew) =====
    /תנאי.*(שימוש|הצטרפות|שירות|תובלה)/,
    /הסכם.*(הלוואה|שירות|הצטרפות)/,
    /מדיניות.*פרטיות/,
    /נספח/,
    /טופס.?101/,
    /פרק\s+[א-ת]/,  // פרק א, פרק ב, etc.

    // ===== Legal / Terms (English) =====
    /terms.?(of.?service|and.?conditions|of.?use)/i,
    /privacy.?policy/i,
    /consolidationagreement/i,
    /accepted.?terms/i,
    /end.?user.?license/i,
    /eula/i,

    // ===== Insurance / Policies =====
    /passportcard.?policy/i,
    /policy.?details/i,
    /פוליסה/,
    /ביטוח.*(מקיף|חובה)/,
    /כיסויים/,
    /שירותי.?דרך/,
    /כתב.?שירות/,
    /רשימה.?לביטוח/,
    /דף.?פרטי.*(ביטוח|הביטוח)/,

    // ===== Travel / Boarding =====
    /boardingpass/i,
    /boarding.?card/i,
    /itinerary/i,
    /e.?ticket/i,
    /lkpass/i,
    /כרטיס.?עלייה/,

    // ===== Email signature images / logos / icons =====
    /^(icon|logo|signature|banner|image00\d|spacer|pixel|tracking)/i,
    /^(checkedgray|check_2|attention|wifi_g|companylogo|headerimg)/i,
    /admailbnr/i,
    /email.?signature/i,
    /^(facebook|twitter|linkedin|instagram|youtube|social)/i,
    /\blogo\b.*\.(png|jpg|gif)/i,

    // ===== Bank / Financial tips =====
    /טיפ.?מספר/,

    // ===== Income reports (not invoices) =====
    /^income\.\d+/i,

    // ===== Medical / Personal =====
    /פסיכו/,
    /מכתב.?שחרור/,
    /תמונת.?פסיכו/,
    /סיכום.?טיפול/,

    // ===== Licenses / IDs =====
    /driverlicense/i,
    /carlicense/i,
    /driver.?license/i,
    /car.?license/i,

    // ===== QR codes =====
    /^qr(reservation|ticket|voucher|code)/i,

    // ===== Newsletter / Marketing =====
    /newsletter/i,
    /unsubscribe/i,
    /campaign/i,
    /promotional/i,
    /^(header|footer|masthead)/i,

    // ===== Vouchers / Coupons =====
    /voucher/i,
    /coupon/i,
    /gift.?card/i,

    // ===== Government forms =====
    /בל\/?\s?\d{4}/,  // ביטוח לאומי forms
    /T2201/i,

    // ===== Shipping labels =====
    /shipping.?label/i,
    /waybill/i,
    /tracking.?number/i,
  ];

  return skipPatterns.some((p) => p.test(lower) || p.test(fileName));
}

/**
 * Minimum file size to consider as an invoice.
 * Very small files (<5KB) are usually logos, icons, or tracking pixels.
 */
const MIN_INVOICE_FILE_SIZE = 5 * 1024; // 5KB

/**
 * Get PDF/image attachments from a specific email message.
 * Skips inline images and files over the R2 size limit.
 */
export async function getAttachments(
  gmail: gmail_v1.Gmail,
  messageId: string
): Promise<EmailAttachment[]> {
  const msg = await gmail.users.messages.get({
    userId: "me",
    id: messageId,
    format: "full",
  });

  const headers = msg.data.payload?.headers || [];
  const subject = headers.find((h) => h.name?.toLowerCase() === "subject")?.value || "";
  const from = headers.find((h) => h.name?.toLowerCase() === "from")?.value || "";
  const dateHeader = headers.find((h) => h.name?.toLowerCase() === "date")?.value;
  const messageDate = dateHeader ? new Date(dateHeader) : null;

  const attachments: EmailAttachment[] = [];
  const validMimeTypes = ["application/pdf", "image/jpeg", "image/png", "image/jpg"];

  function findParts(parts: gmail_v1.Schema$MessagePart[] | undefined) {
    if (!parts) return;
    for (const part of parts) {
      // Check for attachments (not inline images)
      if (
        part.filename &&
        part.filename.length > 0 &&
        part.body?.attachmentId &&
        validMimeTypes.includes(part.mimeType || "")
      ) {
        // Skip if Content-Disposition is inline (usually embedded images)
        const disposition = part.headers?.find(
          (h) => h.name?.toLowerCase() === "content-disposition"
        )?.value;
        if (disposition && disposition.startsWith("inline")) continue;

        // Skip files that are clearly not invoices
        if (shouldSkipFile(part.filename)) continue;

        attachments.push({
          fileName: part.filename,
          buffer: Buffer.alloc(0), // placeholder, will be filled below
          mimeType: part.mimeType || "",
          messageDate,
          subject,
          from,
        });

        // Store attachmentId temporarily
        (attachments[attachments.length - 1] as { _attachmentId?: string })._attachmentId = part.body.attachmentId;
        (attachments[attachments.length - 1] as { _estimatedSize?: number })._estimatedSize = part.body.size || 0;
      }

      // Recurse into nested parts
      if (part.parts) findParts(part.parts);
    }
  }

  findParts(msg.data.payload?.parts);

  // Download actual attachment data
  const downloaded: EmailAttachment[] = [];
  for (const att of attachments) {
    const meta = att as { _attachmentId?: string; _estimatedSize?: number };

    // Skip files likely over 5MB (base64 size is ~33% larger than actual)
    if (meta._estimatedSize && meta._estimatedSize > R2_LIMITS.MAX_FILE_SIZE * 1.4) continue;

    // Skip very small files (logos, icons, tracking pixels)
    if (meta._estimatedSize && meta._estimatedSize < MIN_INVOICE_FILE_SIZE) continue;

    try {
      const attachmentData = await gmail.users.messages.attachments.get({
        userId: "me",
        messageId,
        id: meta._attachmentId!,
      });

      if (attachmentData.data.data) {
        const buffer = Buffer.from(attachmentData.data.data, "base64url");
        if (buffer.length <= R2_LIMITS.MAX_FILE_SIZE) {
          downloaded.push({
            fileName: att.fileName,
            buffer,
            mimeType: att.mimeType,
            messageDate: att.messageDate,
            subject: att.subject,
            from: att.from,
          });
        }
      }
    } catch {
      // Skip failed attachments
    }

    // Small delay between attachment downloads
    await new Promise((r) => setTimeout(r, 50));
  }

  return downloaded;
}
