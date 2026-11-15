"use client";

import { useEffect, useState } from "react";
import { AlertTriangle } from "lucide-react";

interface SenderAccount {
  id: string;
  email: string;
  needsReconnect: boolean;
}

/**
 * Site-wide red banner shown on every dashboard page when a connected Gmail
 * mailbox's token has expired (invalid_grant). Without this, a silently-dead
 * connection stops ingesting invoices and the only hint lived on the Settings
 * page — which is how a month and a half of invoices went missing. Reuses the
 * lightweight /api/settings endpoint (no googleapis on this path).
 */
export function MailboxHealthBanner() {
  const [expired, setExpired] = useState<string[]>([]);

  useEffect(() => {
    let cancelled = false;
    fetch("/api/settings")
      .then((r) => (r.ok ? r.json() : null))
      .then((data) => {
        if (cancelled || !data?.senderAccounts) return;
        const bad = (data.senderAccounts as SenderAccount[])
          .filter((a) => a.needsReconnect)
          .map((a) => a.email);
        setExpired(bad);
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, []);

  if (expired.length === 0) return null;

  return (
    <a
      href="/api/email-accounts/connect"
      className="mb-4 flex items-start gap-2 rounded-xl border border-red-500/40 bg-red-500/10 p-3 text-sm text-red-700 dark:text-red-300 hover:bg-red-500/15 transition-colors"
    >
      <AlertTriangle className="h-5 w-5 shrink-0 mt-0.5" />
      <span>
        <span className="font-semibold">החיבור ל-Gmail פג</span>
        {" — "}
        {expired.length === 1
          ? `החשבון ${expired[0]} התנתק וחשבוניות לא נקלטות ממנו.`
          : `${expired.length} חשבונות התנתקו וחשבוניות לא נקלטות מהם (${expired.join(", ")}).`}
        {" "}
        <span className="font-medium underline">לחץ כאן לחיבור מחדש</span>
      </span>
    </a>
  );
}
