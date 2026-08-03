/** Turn a raw User-Agent string into a short human label like "Chrome · iPhone". */
export function describeUserAgent(ua: string | null): string {
  if (!ua) return "מכשיר לא ידוע";

  let os = "";
  if (/iPhone/i.test(ua)) os = "iPhone";
  else if (/iPad/i.test(ua)) os = "iPad";
  else if (/Android/i.test(ua)) os = "Android";
  else if (/Mac OS X|Macintosh/i.test(ua)) os = "Mac";
  else if (/Windows/i.test(ua)) os = "Windows";
  else if (/Linux/i.test(ua)) os = "Linux";

  let browser = "";
  if (/Edg\//i.test(ua)) browser = "Edge";
  else if (/OPR\//i.test(ua) || /Opera/i.test(ua)) browser = "Opera";
  else if (/CriOS/i.test(ua)) browser = "Chrome";
  else if (/Chrome\//i.test(ua) && !/Chromium/i.test(ua)) browser = "Chrome";
  else if (/Firefox\//i.test(ua) || /FxiOS/i.test(ua)) browser = "Firefox";
  else if (/Safari/i.test(ua) && !/Chrome/i.test(ua)) browser = "Safari";

  const parts = [browser, os].filter(Boolean);
  return parts.length ? parts.join(" · ") : "מכשיר";
}
