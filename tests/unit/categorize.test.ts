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

  it("does not flag a normal invoice", () => {
    expect(isNegativeInvoice('חשבונית מס 12345 סה"כ 100')).toBe(false);
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
