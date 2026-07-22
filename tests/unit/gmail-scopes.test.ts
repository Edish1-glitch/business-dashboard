import { describe, it, expect } from "vitest";
import { canSendEmail, GMAIL_SEND_SCOPE, GMAIL_READONLY_SCOPE } from "@/lib/gmail-scopes";

// Gates whether an account may send invoices by email. A false positive would
// try to send with a read-only token and fail mid-flow; a false negative would
// wrongly block a properly connected account.
describe("canSendEmail", () => {
  it("is false when no scopes are stored", () => {
    expect(canSendEmail(null)).toBe(false);
    expect(canSendEmail(undefined)).toBe(false);
    expect(canSendEmail("")).toBe(false);
  });

  it("is false for a read-only-only grant", () => {
    expect(canSendEmail(GMAIL_READONLY_SCOPE)).toBe(false);
  });

  it("is true when the send scope is present (in any position)", () => {
    expect(canSendEmail(GMAIL_SEND_SCOPE)).toBe(true);
    expect(canSendEmail(`${GMAIL_READONLY_SCOPE} ${GMAIL_SEND_SCOPE}`)).toBe(true);
    expect(canSendEmail(`${GMAIL_SEND_SCOPE} openid email`)).toBe(true);
  });

  it("does not match a scope that merely contains the string as a prefix", () => {
    // guards against a substring bug (e.g. matching 'gmail.send' inside a longer token)
    expect(canSendEmail("https://www.googleapis.com/auth/gmail.send.extra")).toBe(false);
  });
});
