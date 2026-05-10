/**
 * Extracts structured invoice data from OCR/extracted text.
 */
export interface InvoiceData {
  amount: number | null;
  date: Date | null;
  vendor: string | null;
  category: string | null;
  creditCardLast4: string | null;
}

// Category detection keywords (Hebrew)
const categoryKeywords: Record<string, string[]> = {
  דלק: ["דלק", "תדלוק", "סונול", "פז", "דור אלון", "yellow", "ילוו", "ten", "טן", "אלון", "בנזין"],
  סופר: ["סופר", "רמי לוי", "שופרסל", "מגא", "יוחננוף", "חצי חינם", "ויקטורי", "אושר עד", "טיב טעם"],
  מסעדות: ["מסעדה", "קפה", "פיצה", "המבורגר", "סושי", "מסעדת", "בית קפה", "ארוחה"],
  תחבורה: ["חניה", "חנייה", "רכבת", "אוטובוס", "מונית", "גט", "אגד", "דן", "רכב"],
  ביטוח: ["ביטוח", "פוליסה", "הראל", "מגדל", "כלל", "הפניקס", "מנורה"],
  תקשורת: ["סלקום", "פלאפון", "הוט", "פרטנר", "012", "013", "בזק", "yes", "אינטרנט", "סלולר"],
  "חשמל ומים": ["חשמל", "חברת חשמל", "מים", "מקורות", "עירייה", "ארנונה"],
  שכירות: ["שכירות", "שכ\"ד", "דמי שכירות"],
  "ציוד משרדי": ["משרדי", "ציוד", "מחשב", "מדפסת", "נייר", "דיו"],
  "שיווק ופרסום": ["פרסום", "שיווק", "גוגל", "פייסבוק", "מודעה", "קמפיין"],
  מיסים: ["מע\"מ", "מס הכנסה", "ביטוח לאומי", "מס", "ניכוי"],
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
 * Extracts amount (₪) from invoice text.
 * Looks for patterns like: ₪123.45, 123.45 ₪, סה"כ 123.45, total: 123.45
 */
export function extractAmount(text: string): number | null {
  // Try common Hebrew invoice patterns
  const patterns = [
    // סה"כ לתשלום: 123.45
    /(?:סה["\u05F4]כ|סהכ|סה"כ|total|לתשלום|לחיוב|סכום)[:\s]*[₪]?\s*([\d,]+\.?\d*)/i,
    // ₪123.45 or 123.45₪
    /₪\s*([\d,]+\.?\d*)/,
    /([\d,]+\.?\d*)\s*₪/,
    // Last resort: any number that looks like money (with decimal)
    /\b([\d,]+\.\d{2})\b/,
  ];

  for (const pattern of patterns) {
    const match = text.match(pattern);
    if (match) {
      const value = parseFloat(match[1].replace(/,/g, ""));
      if (value > 0 && value < 1000000) {
        return value;
      }
    }
  }

  return null;
}

/**
 * Extracts date from invoice text.
 */
export function extractDate(text: string): Date | null {
  const patterns = [
    // DD/MM/YYYY or DD-MM-YYYY
    /(\d{1,2})[/\-.](\d{1,2})[/\-.](\d{4})/,
    // DD/MM/YY
    /(\d{1,2})[/\-.](\d{1,2})[/\-.](\d{2})\b/,
  ];

  for (const pattern of patterns) {
    const match = text.match(pattern);
    if (match) {
      const day = parseInt(match[1]);
      const month = parseInt(match[2]);
      let year = parseInt(match[3]);

      if (year < 100) year += 2000;

      if (day >= 1 && day <= 31 && month >= 1 && month <= 12) {
        return new Date(year, month - 1, day);
      }
    }
  }

  return null;
}

/**
 * Extracts vendor/business name from invoice text.
 * Looks at the first few lines which usually contain the business name.
 */
export function extractVendor(text: string): string | null {
  const lines = text
    .split("\n")
    .map((l) => l.trim())
    .filter((l) => l.length > 2 && l.length < 60);

  // Usually the business name is in the first 3 non-empty lines
  for (const line of lines.slice(0, 5)) {
    // Skip lines that are mostly numbers or dates
    if (/^\d+[/\-.\s\d]*$/.test(line)) continue;
    // Skip lines with common non-name content
    if (/(?:חשבונית|מס'|תאריך|עוסק|ח\.פ|טלפון|כתובת|מע"מ)/i.test(line)) continue;

    return line;
  }

  return null;
}

/**
 * Extracts last 4 digits of credit card from invoice text.
 */
export function extractCreditCardLast4(text: string): string | null {
  const patterns = [
    // כרטיס: *1234 or כרטיס: ****1234
    /(?:כרטיס|אשראי|card)[:\s]*\*{0,4}(\d{4})/i,
    // xxxx-xxxx-xxxx-1234
    /\d{4}[-\s]\d{4}[-\s]\d{4}[-\s](\d{4})/,
    // ****1234 or ***1234
    /\*{3,}(\d{4})/,
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
  return {
    amount: extractAmount(text),
    date: extractDate(text),
    vendor: extractVendor(text),
    category: detectCategory(text),
    creditCardLast4: extractCreditCardLast4(text),
  };
}
