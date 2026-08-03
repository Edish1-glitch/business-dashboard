import { describe, it, expect } from "vitest";
import { formatInvoiceAmount, buildNewInvoicePush } from "@/lib/notify-format";

describe("formatInvoiceAmount", () => {
  it("returns empty string when there is no amount", () => {
    expect(formatInvoiceAmount(null, "ILS")).toBe("");
  });

  it("formats ILS with the shekel sign", () => {
    expect(formatInvoiceAmount(100, "ILS")).toBe("₪100");
  });

  it("does not round — keeps exact fractional amounts", () => {
    expect(formatInvoiceAmount(47.65, "ILS")).toBe("₪47.65");
  });

  it("uses the right symbol per currency", () => {
    expect(formatInvoiceAmount(10, "USD")).toBe("$10");
    expect(formatInvoiceAmount(10, "EUR")).toBe("€10");
    expect(formatInvoiceAmount(10, "GBP")).toBe("£10");
  });

  it("defaults to shekel when currency is null/unknown", () => {
    expect(formatInvoiceAmount(5, null)).toBe("₪5");
    expect(formatInvoiceAmount(5, "XYZ")).toBe("₪5");
  });
});

describe("buildNewInvoicePush", () => {
  it("returns null for an empty list", () => {
    expect(buildNewInvoicePush([])).toBeNull();
  });

  it("builds a focused push for a single invoice (vendor + amount)", () => {
    const p = buildNewInvoicePush([{ id: "abc", vendor: "רמי לוי", amount: 47.65, currency: "ILS" }]);
    expect(p).toEqual({
      title: "חשבונית חדשה",
      body: "רמי לוי · ₪47.65",
      url: "/invoices/pending?focus=abc",
      tag: "invoice-abc",
      invoiceId: "abc",
    });
  });

  it("omits the amount when the invoice has none", () => {
    const p = buildNewInvoicePush([{ id: "x1", vendor: "ספק כלשהו", amount: null, currency: null }]);
    expect(p?.body).toBe("ספק כלשהו");
    expect(p?.url).toBe("/invoices/pending?focus=x1");
  });

  it("falls back to a generic vendor when vendor is missing", () => {
    const p = buildNewInvoicePush([{ id: "x2", vendor: null, amount: 10, currency: "ILS" }]);
    expect(p?.body).toBe("חשבונית חדשה · ₪10");
  });

  it("batches several invoices into one summary push", () => {
    const p = buildNewInvoicePush([
      { id: "a", vendor: "a", amount: 1, currency: "ILS" },
      { id: "b", vendor: "b", amount: 2, currency: "ILS" },
      { id: "c", vendor: "c", amount: 3, currency: "ILS" },
    ]);
    expect(p).toEqual({
      title: "חשבוניות חדשות",
      body: "3 חשבוניות חדשות ממתינות לאישור",
      url: "/invoices/pending",
      tag: "invoices-batch",
    });
  });
});
