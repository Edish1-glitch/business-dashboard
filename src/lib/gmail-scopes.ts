// Lightweight Gmail scope helpers.
//
// IMPORTANT: this file must NOT import "googleapis" (or anything that does).
// The full googleapis package loads tens of MB into memory, which on Render's
// 512MB free instance can push the process over its memory limit. Routes that
// only need a cheap scope check (e.g. /api/settings, called on every approved-
// invoices page load) import from here instead of from ./gmail.
export const GMAIL_SEND_SCOPE = "https://www.googleapis.com/auth/gmail.send";
export const GMAIL_READONLY_SCOPE = "https://www.googleapis.com/auth/gmail.readonly";

/** True if the stored scopes string grants permission to send email. */
export function canSendEmail(scopes: string | null | undefined): boolean {
  return !!scopes && scopes.split(/\s+/).includes(GMAIL_SEND_SCOPE);
}
