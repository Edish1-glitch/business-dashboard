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
 * Search Gmail for emails with PDF/image attachments in a date range.
 * Returns all matching message IDs (no pagination cap).
 */
export async function searchEmails(
  gmail: gmail_v1.Gmail,
  afterDate: Date,
  beforeDate?: Date | null
): Promise<string[]> {
  const afterStr = `${afterDate.getFullYear()}/${String(afterDate.getMonth() + 1).padStart(2, "0")}/${String(afterDate.getDate()).padStart(2, "0")}`;
  let query = `has:attachment (filename:pdf OR filename:jpg OR filename:jpeg OR filename:png) after:${afterStr}`;
  if (beforeDate) {
    const beforeStr = `${beforeDate.getFullYear()}/${String(beforeDate.getMonth() + 1).padStart(2, "0")}/${String(beforeDate.getDate()).padStart(2, "0")}`;
    query += ` before:${beforeStr}`;
  }

  const messageIds: string[] = [];
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
        if (msg.id) messageIds.push(msg.id);
      }
    }

    pageToken = res.data.nextPageToken || undefined;

    // Small delay to respect rate limits
    if (pageToken) {
      await new Promise((r) => setTimeout(r, 100));
    }
  } while (pageToken);

  return messageIds;
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
