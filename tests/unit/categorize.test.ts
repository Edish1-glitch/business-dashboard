import { describe, it, expect } from "vitest";
import {
  extractAmount,
  extractDate,
  extractVendor,
  extractCreditCardLast4,
  detectCategory,
  isNegativeInvoice,
  hasInvoiceSignals,
  extractInvoiceData,
} from "@/lib/pdf/categorize";

/**
 * The invoice parser is the highest-risk pure logic in the app: a bug here puts
 * a wrong amount / date / vendor / category on every processed invoice. These
 * tests lock in its behavior, including the tricky bits (currency priority,
 * DD/MM vs MM/DD ambiguity, negative-invoice rejection).
 */

describe("extractAmount", () => {
  it("reads Israeli 'total incl. VAT' amounts", () => {
    expect(extractAmount('סה"כ כולל מע"מ 150.50')).toEqual({ amount: 150.5, currency: "ILS" });
  });

  it("reads shekel-symbol amounts on either side", () => {
    expect(extractAmount("₪150")).toEqual({ amount: 150, currency: "ILS" });
    expect(extractAmount("150 ₪")).toEqual({ amount: 150, currency: "ILS" });
  });

  it("reads NIS / ש\"ח amounts with thousands separators", () => {
    expect(extractAmount("1,234.56 NIS")).toEqual({ amount: 1234.56, currency: "ILS" });
    expect(extractAmount('99 ש"ח')).toEqual({ amount: 99, currency: "ILS" });
  });

  // Real bug: restaurant receipts print the total as 'סה"כ בש"ח 273.90' (currency
  // BEFORE the number, no ₪). The parser missed these and dropped real receipts.
  it('reads "סה"כ בש"ח <amount>" totals (currency before the number)', () => {
    expect(extractAmount('נאגטס עוף\nסה"כ בש"ח 273.90')).toEqual({ amount: 273.9, currency: "ILS" });
    expect(extractAmount('סה"כ בש"ח 598.90')).toEqual({ amount: 598.9, currency: "ILS" });
    expect(extractAmount('סה"כ בש"ח 139.75')).toEqual({ amount: 139.75, currency: "ILS" });
    expect(extractAmount('סך הכל בש"ח 1,187.90')).toEqual({ amount: 1187.9, currency: "ILS" });
  });

  it('prefers the סה"כ total over an earlier line-item בש"ח price', () => {
    const text = 'פריט בש"ח 45.00\nמשלוח בש"ח 15.00\nסה"כ בש"ח 138.90';
    expect(extractAmount(text)).toEqual({ amount: 138.9, currency: "ILS" });
  });

  it("reads international $, €, £ totals", () => {
    expect(extractAmount("Total: $99.99")).toEqual({ amount: 99.99, currency: "USD" });
    expect(extractAmount("Amount Due: €50.00")).toEqual({ amount: 50, currency: "EUR" });
    expect(extractAmount("Total: £25.00")).toEqual({ amount: 25, currency: "GBP" });
  });

  it("prefers the Israeli amount when both appear (Israeli invoices lead)", () => {
    const res = extractAmount("₪100\nsome total: $200");
    expect(res).toEqual({ amount: 100, currency: "ILS" });
  });

  it("rejects zero / out-of-range and non-amounts", () => {
    expect(extractAmount("hello world, no money here")).toBeNull();
    expect(extractAmount("₪0")).toBeNull();
  });
});

describe("extractDate", () => {
  const ymd = (d: Date | null) => (d ? [d.getFullYear(), d.getMonth() + 1, d.getDate()] : null);

  it("parses ISO dates first (unambiguous)", () => {
    expect(ymd(extractDate("Date: 2025-01-15"))).toEqual([2025, 1, 15]);
  });

  it("parses YYYY/MM/DD with slashes or dots (year-first is unambiguous)", () => {
    // Real bug: '2025/02/08' was read as 2008 because ISO parsing only handled dashes.
    expect(ymd(extractDate("Date subscribed 2025/02/08"))).toEqual([2025, 2, 8]);
    expect(ymd(extractDate("2025.02.08"))).toEqual([2025, 2, 8]);
  });

  it("parses DD/MM/YYYY when the first number > 12 (Israeli)", () => {
    expect(ymd(extractDate("15/03/2025"))).toEqual([2025, 3, 15]);
  });

  it("parses MM/DD/YYYY when the second number > 12 (US)", () => {
    expect(ymd(extractDate("03/15/2025"))).toEqual([2025, 3, 15]);
  });

  it("defaults ambiguous numeric dates to DD/MM (Israeli)", () => {
    // 05/03 -> both <= 12; should be day=5, month=3
    expect(ymd(extractDate("05/03/2025"))).toEqual([2025, 3, 5]);
  });

  it("parses English text months", () => {
    expect(ymd(extractDate("January 15, 2025"))).toEqual([2025, 1, 15]);
    expect(ymd(extractDate("15 Jan 2025"))).toEqual([2025, 1, 15]);
  });

  it("parses Hebrew text months", () => {
    expect(ymd(extractDate("15 בינואר 2025"))).toEqual([2025, 1, 15]);
  });

  it("returns null when there is no date", () => {
    expect(extractDate("no date at all")).toBeNull();
  });
});

describe("extractVendor", () => {
  it("returns the first meaningful line", () => {
    expect(extractVendor("ACME Corp\nInvoice #123\nTotal: $50")).toBe("ACME Corp");
  });

  it("skips header lines (invoice/date/separators) to find the vendor", () => {
    expect(extractVendor("Invoice #123\n-----\nACME Corp")).toBe("ACME Corp");
  });

  it("works for Hebrew vendors", () => {
    expect(extractVendor("סופר פארם\nחשבונית מס 123")).toBe("סופר פארם");
  });
});

describe("extractCreditCardLast4", () => {
  it("reads Hebrew masked card numbers", () => {
    expect(extractCreditCardLast4("כרטיס: ****1234")).toBe("1234");
  });

  it("reads English 'card ending in' and masked forms", () => {
    expect(extractCreditCardLast4("card ending in 5678")).toBe("5678");
    expect(extractCreditCardLast4("charged to ****9999")).toBe("9999");
  });

  it("returns null when no card is present", () => {
    expect(extractCreditCardLast4("cash payment")).toBeNull();
  });
});

describe("detectCategory", () => {
  it.each([
    ["תדלוק בתחנת פז", "דלק"],
    ["קנייה ברמי לוי", "סופר"],
    ["Anthropic subscription", "תוכנה"],
    ["בית קפה שלי", "מסעדות"],
    ["חשבון חשמל", "חשמל ומים"],
  ])("categorizes %s -> %s", (text, expected) => {
    expect(detectCategory(text)).toBe(expected);
  });

  it("falls back to 'אחר' for unknown text", () => {
    expect(detectCategory("zzz unknown vendor qqq")).toBe("אחר");
  });

  // Real bug: short Latin keyword 'ten' (fuel brand) matched inside common words
  // like 'content', turning many invoices into דלק.
  it("does not match a keyword inside a bigger word ('ten' in 'content')", () => {
    expect(detectCategory("Content management and settings")).not.toBe("דלק");
  });

  it("categorizes a Facebook/Meta subscription as תוכנה, not דלק/שיווק", () => {
    const text = "Meta Verified\nRecurring monthly payment\nTo cancel, go to Subscriptions settings.\nFacebook";
    expect(detectCategory(text)).toBe("תוכנה");
  });

  it("still categorizes actual ad spend as שיווק ופרסום", () => {
    expect(detectCategory("Facebook Ads — campaign receipt")).toBe("שיווק ופרסום");
    expect(detectCategory("Google Ads invoice")).toBe("שיווק ופרסום");
  });

  it("categorizes Google Cloud as תוכנה, not שיווק", () => {
    expect(detectCategory("Google Cloud Platform - invoice")).toBe("תוכנה");
  });

  // Generic boilerplate words that appear in almost every invoice/email must not
  // steal the category from the real signal.
  it("a subscription full of Tax/policy boilerplate is תוכנה, not מיסים/ביטוח", () => {
    const text = "Meta Verified\nRecurring monthly payment\nSubtotal ₪42.89\nTax ₪0.00\nTotal ₪42.89\nTo cancel, go to Subscriptions settings.\nprivacy policy\nFacebook";
    expect(detectCategory(text)).toBe("תוכנה");
  });

  it("does not turn any email with the word 'yes' into תקשורת", () => {
    expect(detectCategory("Yes, your order is confirmed. Thanks!")).not.toBe("תקשורת");
  });

  it("does not turn the common Hebrew word 'כלל' into ביטוח", () => {
    expect(detectCategory("סה\"כ כולל הכל - זהו סכום כללי")).not.toBe("ביטוח");
  });

  // ...but real tax-authority and insurance documents still classify correctly.
  it("still detects a real tax-authority invoice as מיסים", () => {
    expect(detectCategory("רשות המסים - מקדמות מס הכנסה")).toBe("מיסים");
  });

  it("still detects a real insurance policy as ביטוח", () => {
    expect(detectCategory("הראל חברה לביטוח - פוליסת ביטוח בריאות")).toBe("ביטוח");
  });

  // Real receipts that used to land in ביטוח/אחר: consumer digital subscriptions.
  it("classifies YouTube Premium / Google One receipts as תוכנה", () => {
    expect(detectCategory("הקבלה שלך עבור התשלום אל Google Payment Limited - YouTube Premium")).toBe("תוכנה");
    expect(detectCategory("התשלום ששלחת עבר בהצלחה - 100 GB (Google One)")).toBe("תוכנה");
  });

  // The Hebrew clitic-prefix boundary must not let "מים" match "ימים"/"תשלומים".
  it("does not classify text about ימים/תשלומים as חשמל ומים", () => {
    expect(detectCategory("החזר בתוך 180 ימים מיום העסקה, סכום התשלומים")).not.toBe("חשמל ומים");
  });
});

describe("isNegativeInvoice (things that are NOT expenses)", () => {
  it.each([
    "Payment failed",
    "refund processed",
    "תעודה רפואית",
    "click here to unsubscribe",
  ])("flags %s as negative", (text) => {
    expect(isNegativeInvoice(text)).toBe(true);
  });

  // Real-world false positives: employment/work agreements were pulled from
  // email and shown as invoices with garbage amounts. They must be rejected.
  it.each([
    "הסכם עבודה בין החברה לבין העובד",
    "חוזה עבודה אישי",
    "הסכם העסקה - תנאי שכר",
    "Employment Agreement between the parties",
    "Offer Letter — terms of employment",
  ])("flags work/employment agreement as negative: %s", (text) => {
    expect(isNegativeInvoice(text)).toBe(true);
  });

  it("does not flag a normal invoice", () => {
    expect(isNegativeInvoice('חשבונית מס 12345 סה"כ 100')).toBe(false);
  });

  it("does not over-reject an invoice that merely mentions an employee", () => {
    // 'עובד' alone must not trigger rejection — only actual agreement phrasing
    expect(isNegativeInvoice('חשבונית עבור שירותי עובד קבלן, סה"כ 500')).toBe(false);
  });
});

describe("hasInvoiceSignals", () => {
  it("detects Hebrew and English invoice signals", () => {
    expect(hasInvoiceSignals("חשבונית מס")).toBe(true);
    expect(hasInvoiceSignals("Invoice total due")).toBe(true);
  });

  it("returns false for unrelated text", () => {
    expect(hasInvoiceSignals("just a friendly hello")).toBe(false);
  });

  // Real bug: a 24-page PayPal *User Agreement* was imported as 24 "invoices"
  // because it mentions תשלום/סכום/עסקה. Generic money words are NOT enough —
  // require a real invoice keyword OR an actual amount.
  it("rejects legal/agreement prose that only mentions money generically", () => {
    const ua = "הסכם המשתמש. השירותים שלנו. הסכום של כל עסקה בלתי מורשית. תשלום. פעילות מוגבלת.";
    expect(hasInvoiceSignals(ua)).toBe(false);
  });

  it("rejects marketing text that mentions payment but has no amount", () => {
    expect(hasInvoiceSignals("מבצע מיוחד! שלמו פחות והצטרפו עכשיו")).toBe(false);
  });

  it("keeps a receipt that only shows a total amount (no 'invoice' word)", () => {
    expect(hasInvoiceSignals('נאגטס עוף\nסה"כ בש"ח 273.90')).toBe(true);
  });

  it("keeps anything that names itself an invoice/receipt", () => {
    expect(hasInvoiceSignals("חשבונית מס 123")).toBe(true);
    expect(hasInvoiceSignals("Payment receipt")).toBe(true);
  });
});

describe("extractInvoiceData (integration)", () => {
  it("pulls a full record from an Israeli invoice", () => {
    const text = [
      "סופר פארם",
      "חשבונית מס 5567",
      "תאריך: 15/03/2025",
      'סה"כ כולל מע"מ 250.90',
      "שולם בכרטיס ****4321",
    ].join("\n");
    const data = extractInvoiceData(text);
    expect(data.amount).toBe(250.9);
    expect(data.currency).toBe("ILS");
    expect(data.vendor).toBe("סופר פארם");
    expect(data.creditCardLast4).toBe("4321");
    expect(data.date && [data.date.getFullYear(), data.date.getMonth() + 1, data.date.getDate()]).toEqual([2025, 3, 15]);
  });

  it("pulls a full record from an international invoice", () => {
    const text = ["Anthropic, PBC", "Invoice", "Date: 2025-02-01", "Total: $20.00"].join("\n");
    const data = extractInvoiceData(text);
    expect(data.amount).toBe(20);
    expect(data.currency).toBe("USD");
    expect(data.category).toBe("תוכנה");
    expect(data.date && data.date.getFullYear()).toBe(2025);
  });
});
