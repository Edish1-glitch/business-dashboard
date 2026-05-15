/**
 * Extracts structured invoice data from OCR/extracted text.
 * Supports both Israeli (Hebrew) and international invoices.
 */
export interface InvoiceData {
  amount: number | null;
  currency: string | null;
  date: Date | null;
  vendor: string | null;
  category: string | null;
  creditCardLast4: string | null;
}

// Category detection keywords - Hebrew + English
const categoryKeywords: Record<string, string[]> = {
  דלק: ["דלק", "תדלוק", "סונול", "פז", "דור אלון", "yellow", "ילוו", "ten", "טן", "אלון", "בנזין", "fuel", "gas station", "gasoline"],
  סופר: ["סופר", "רמי לוי", "שופרסל", "מגא", "יוחננוף", "חצי חינם", "ויקטורי", "אושר עד", "טיב טעם", "grocery", "supermarket"],
  מסעדות: ["מסעדה", "קפה", "פיצה", "המבורגר", "סושי", "מסעדת", "בית קפה", "ארוחה", "restaurant", "cafe", "coffee", "food", "dining", "uber eats", "wolt", "doordash"],
  תחבורה: ["חניה", "חנייה", "רכבת", "אוטובוס", "מונית", "גט", "אגד", "דן", "רכב", "uber", "lyft", "taxi", "parking", "transit"],
  ביטוח: ["ביטוח", "פוליסה", "הראל", "מגדל", "כלל", "הפניקס", "מנורה", "insurance", "policy", "coverage"],
  תקשורת: ["סלקום", "פלאפון", "הוט", "פרטנר", "012", "013", "בזק", "yes", "אינטרנט", "סלולר", "internet", "mobile", "cellular", "phone", "telecom", "broadband"],
  "חשמל ומים": ["חשמל", "חברת חשמל", "מים", "מקורות", "עירייה", "ארנונה", "electricity", "water", "utility", "utilities"],
  שכירות: ["שכירות", "שכ\"ד", "דמי שכירות", "rent", "lease", "rental"],
  "ציוד משרדי": ["משרדי", "ציוד", "מחשב", "מדפסת", "נייר", "דיו", "office supplies", "equipment", "printer", "computer"],
  "שיווק ופרסום": ["פרסום", "שיווק", "גוגל", "פייסבוק", "מודעה", "קמפיין", "advertising", "marketing", "google ads", "facebook ads", "campaign", "meta ads"],
  מיסים: ["מע\"מ", "מס הכנסה", "ביטוח לאומי", "מס", "ניכוי", "tax", "vat", "levy"],
  תוכנה: [
    "software", "saas", "subscription", "license", "cloud", "hosting",
    "anthropic", "claude", "openai", "chatgpt", "github", "copilot",
    "aws", "amazon web services", "azure", "google cloud", "gcp",
    "vercel", "netlify", "heroku", "render", "railway", "fly.io",
    "stripe", "twilio", "sendgrid", "mailgun",
    "notion", "slack", "zoom", "figma", "canva", "adobe",
    "dropbox", "1password", "lastpass",
    "jira", "atlassian", "linear", "asana",
    "docker", "datadog", "sentry", "newrelic",
    "mongodb", "supabase", "planetscale", "neon",
    "cloudflare", "namecheap", "godaddy", "domain",
    "app store", "play store",
  ],
};

/**
 * Detects the expense category from invoice text.
 */
export function detectCategory(text: string): string {
  const lowerText = text.toLowerCase();

  for (const [category, keywords] of Object.entries(categoryKeywords)) {
    for (const keyword of keywords) {
      if (lowerText.includes(keyword.toLowerCase())) {
        return category;
      }
    }
  }

  return "אחר";
}

/**
 * Extracts amount from invoice text.
 * Supports Israeli (₪/NIS/ILS) and international ($, EUR, GBP, etc.) formats.
 */
export function extractAmount(text: string): { amount: number; currency: string } | null {
  // Israeli patterns (highest priority for Israeli invoices)
  const israeliPatterns: [RegExp, string][] = [
    [/סה"כ\s+כולל\s+מע["\u05F4]?מ\s*([\d,]+\.?\d*)/, "ILS"],
    [/סה"כ\s+כולל\s+מע.?[םמ]\s*([\d,]+\.?\d*)/, "ILS"],
    [/סה"כ\s+לתשלום\s*[-–]\s*\S+\s*([\d,]+\.?\d*)/, "ILS"],
    [/סה"כ\s+לתשלום[:\s]*([\d,]+\.?\d*)/, "ILS"],
    [/התקבל[:\s]+\S+\s*([\d,]+\.?\d*)/, "ILS"],
    [/(?:לחיוב|סכום)[:\s]*[₪]?\s*([\d,]+\.?\d*)/, "ILS"],
    [/₪\s*([\d,]+\.?\d*)/, "ILS"],
    [/([\d,]+\.?\d*)\s*₪/, "ILS"],
    [/([\d,]+\.?\d*)\s*(?:NIS|nis|שקל|ש"ח|שח)/, "ILS"],
  ];

  // International patterns
  const internationalPatterns: [RegExp, string][] = [
    // Total / Amount Due / Grand Total (English invoices)
    [/(?:grand\s+)?total[:\s]*\$\s*([\d,]+\.?\d*)/i, "USD"],
    [/(?:amount\s+due|balance\s+due|total\s+due)[:\s]*\$\s*([\d,]+\.?\d*)/i, "USD"],
    [/(?:grand\s+)?total[:\s]*(?:USD|usd)\s*([\d,]+\.?\d*)/i, "USD"],
    [/(?:amount\s+due|balance\s+due|total\s+due)[:\s]*(?:USD|usd)\s*([\d,]+\.?\d*)/i, "USD"],
    // EUR
    [/(?:grand\s+)?total[:\s]*(?:€|EUR)\s*([\d,]+\.?\d*)/i, "EUR"],
    [/(?:amount\s+due|balance\s+due|total\s+due)[:\s]*(?:€|EUR)\s*([\d,]+\.?\d*)/i, "EUR"],
    // GBP
    [/(?:grand\s+)?total[:\s]*(?:£|GBP)\s*([\d,]+\.?\d*)/i, "GBP"],
    [/(?:amount\s+due|balance\s+due|total\s+due)[:\s]*(?:£|GBP)\s*([\d,]+\.?\d*)/i, "GBP"],
    // Generic "Total: 123.45" without currency
    [/(?:grand\s+)?total[:\s]*([\d,]+\.?\d*)/i, "USD"],
    [/(?:amount\s+due|balance\s+due|total\s+due)[:\s]*([\d,]+\.?\d*)/i, "USD"],
    // Currency symbol then amount (standalone)
    [/\$\s*([\d,]+\.?\d{2})/, "USD"],
    [/€\s*([\d,]+\.?\d{2})/, "EUR"],
    [/£\s*([\d,]+\.?\d{2})/, "GBP"],
    // Amount then currency code
    [/([\d,]+\.?\d*)\s*(?:USD|usd)/, "USD"],
    [/([\d,]+\.?\d*)\s*(?:EUR|eur)/, "EUR"],
    [/([\d,]+\.?\d*)\s*(?:GBP|gbp)/, "GBP"],
    [/([\d,]+\.?\d*)\s*(?:ILS|ils)/, "ILS"],
    // "Amount: 500" / "Price: 500" / "Charge: 500"
    [/(?:amount|price|charge|cost|fee|payment)[:\s]*\$?\s*([\d,]+\.?\d*)/i, "USD"],
  ];

  // Try Israeli patterns first
  for (const [pattern, currency] of israeliPatterns) {
    const match = text.match(pattern);
    if (match) {
      const value = parseFloat(match[1].replace(/,/g, ""));
      if (value > 0 && value < 10000000) {
        return { amount: value, currency };
      }
    }
  }

  // Then international patterns
  for (const [pattern, currency] of internationalPatterns) {
    const match = text.match(pattern);
    if (match) {
      const value = parseFloat(match[1].replace(/,/g, ""));
      if (value > 0 && value < 10000000) {
        return { amount: value, currency };
      }
    }
  }

  return null;
}

/**
 * Extracts date from invoice text.
 * Supports DD/MM/YYYY (Israeli), MM/DD/YYYY (US), YYYY-MM-DD (ISO), and text months.
 */
export function extractDate(text: string): Date | null {
  // ISO format: 2025-01-15 (unambiguous, try first)
  const isoMatch = text.match(/(\d{4})-(\d{1,2})-(\d{1,2})/);
  if (isoMatch) {
    const year = parseInt(isoMatch[1]);
    const month = parseInt(isoMatch[2]);
    const day = parseInt(isoMatch[3]);
    if (year >= 2000 && year <= 2100 && month >= 1 && month <= 12 && day >= 1 && day <= 31) {
      return new Date(year, month - 1, day);
    }
  }

  // Text month formats: "Jan 15, 2025", "15 January 2025", "January 15, 2025"
  const monthNames: Record<string, number> = {
    jan: 1, january: 1, feb: 2, february: 2, mar: 3, march: 3,
    apr: 4, april: 4, may: 5, jun: 6, june: 6,
    jul: 7, july: 7, aug: 8, august: 8, sep: 9, september: 9,
    oct: 10, october: 10, nov: 11, november: 11, dec: 12, december: 12,
  };
  const monthPattern = Object.keys(monthNames).join("|");

  // "January 15, 2025" or "Jan 15, 2025"
  const textMonthMatch1 = text.match(new RegExp(`(${monthPattern})\\s+(\\d{1,2}),?\\s+(\\d{4})`, "i"));
  if (textMonthMatch1) {
    const month = monthNames[textMonthMatch1[1].toLowerCase()];
    const day = parseInt(textMonthMatch1[2]);
    const year = parseInt(textMonthMatch1[3]);
    if (month && day >= 1 && day <= 31 && year >= 2000) {
      return new Date(year, month - 1, day);
    }
  }

  // "15 January 2025" or "15 Jan 2025"
  const textMonthMatch2 = text.match(new RegExp(`(\\d{1,2})\\s+(${monthPattern}),?\\s+(\\d{4})`, "i"));
  if (textMonthMatch2) {
    const day = parseInt(textMonthMatch2[1]);
    const month = monthNames[textMonthMatch2[2].toLowerCase()];
    const year = parseInt(textMonthMatch2[3]);
    if (month && day >= 1 && day <= 31 && year >= 2000) {
      return new Date(year, month - 1, day);
    }
  }

  // Hebrew month names
  const hebrewMonths: Record<string, number> = {
    "ינואר": 1, "פברואר": 2, "מרץ": 3, "אפריל": 4, "מאי": 5, "יוני": 6,
    "יולי": 7, "אוגוסט": 8, "ספטמבר": 9, "אוקטובר": 10, "נובמבר": 11, "דצמבר": 12,
  };
  for (const [name, month] of Object.entries(hebrewMonths)) {
    const hebrewMatch = text.match(new RegExp(`(\\d{1,2})\\s+(?:ב)?${name}\\s+(\\d{4})`));
    if (hebrewMatch) {
      const day = parseInt(hebrewMatch[1]);
      const year = parseInt(hebrewMatch[2]);
      if (day >= 1 && day <= 31) {
        return new Date(year, month - 1, day);
      }
    }
  }

  // DD/MM/YYYY or DD-MM-YYYY or DD.MM.YYYY
  const numericPatterns = [
    /(\d{1,2})[/\-.](\d{1,2})[/\-.](\d{4})/,
    /(\d{1,2})[/\-.](\d{1,2})[/\-.](\d{2})\b/,
  ];

  for (const pattern of numericPatterns) {
    const match = text.match(pattern);
    if (match) {
      const a = parseInt(match[1]);
      const b = parseInt(match[2]);
      let year = parseInt(match[3]);
      if (year < 100) year += 2000;

      // If first number > 12, it must be DD/MM (Israeli format)
      if (a > 12 && b >= 1 && b <= 12) {
        return new Date(year, b - 1, a);
      }
      // If second number > 12, it must be MM/DD (US format)
      if (b > 12 && a >= 1 && a <= 12) {
        return new Date(year, a - 1, b);
      }
      // Ambiguous - default to DD/MM (Israeli)
      if (a >= 1 && a <= 31 && b >= 1 && b <= 12) {
        return new Date(year, b - 1, a);
      }
    }
  }

  return null;
}

/**
 * Extracts vendor/business name from invoice text.
 * Supports Hebrew and English invoices.
 */
export function extractVendor(text: string): string | null {
  const lines = text
    .split("\n")
    .map((l) => l.trim())
    .filter((l) => l.length > 2 && l.length < 60);

  // Lines to skip - common headers in both Hebrew and English
  const skipPatterns = [
    /^[-=*_~]+$/,                          // separator lines
    /^\d+[/\-.\s\d]*$/,                   // pure numbers/dates
    // Hebrew
    /(?:חשבונית|מס'|תאריך|עוסק|ח\.פ|טלפון|כתובת|מע"מ)/i,
    /(?:במסמך|ממוחשב|מקור|העתק|מקורי|נאמן)/i,
    // English
    /^(?:invoice|receipt|bill|statement|tax\s+invoice|order|confirmation)\b/i,
    /^(?:date|invoice\s+(?:no|number|#)|order\s+(?:no|number|#)|ref|reference)\b/i,
    /^(?:page\s+\d|p\.\s*\d)/i,
    /^(?:tel|phone|fax|email|website|www\.|http)/i,
    /^(?:bill\s+to|ship\s+to|sold\s+to|remit\s+to)\b/i,
    /^--/,
  ];

  for (const line of lines.slice(0, 10)) {
    const shouldSkip = skipPatterns.some((p) => p.test(line));
    if (shouldSkip) continue;

    return line;
  }

  return null;
}

/**
 * Extracts last 4 digits of credit card from invoice text.
 */
export function extractCreditCardLast4(text: string): string | null {
  const patterns = [
    // Hebrew: כרטיס: *1234 or כרטיס: ****1234
    /(?:כרטיס|אשראי)[:\s]*\*{0,4}(\d{4})/i,
    // English: card ending in 1234, card *1234
    /card\s+(?:ending\s+(?:in|with)\s+|#?\*{0,4})(\d{4})/i,
    /(?:visa|mastercard|amex|discover)\s+(?:\*{0,4}|ending\s+(?:in\s+)?)(\d{4})/i,
    // xxxx-xxxx-xxxx-1234
    /\d{4}[-\s]\d{4}[-\s]\d{4}[-\s](\d{4})/,
    // ****1234 or ***1234
    /\*{3,}(\d{4})/,
    // "ending 1234" / "ends in 1234"
    /end(?:ing|s)\s+(?:in\s+)?(\d{4})/i,
  ];

  for (const pattern of patterns) {
    const match = text.match(pattern);
    if (match) {
      return match[1];
    }
  }

  return null;
}

/**
 * Full invoice data extraction from text.
 */
export function extractInvoiceData(text: string): InvoiceData {
  const amountResult = extractAmount(text);
  return {
    amount: amountResult?.amount ?? null,
    currency: amountResult?.currency ?? null,
    date: extractDate(text),
    vendor: extractVendor(text),
    category: detectCategory(text),
    creditCardLast4: extractCreditCardLast4(text),
  };
}
