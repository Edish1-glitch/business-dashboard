"use client";

import { useEffect, useState } from "react";
import { Bell, BellOff, Loader2, Check, AlertTriangle, Share } from "lucide-react";
import { Button } from "@/components/ui/button";

type Status = "loading" | "unsupported" | "denied" | "subscribed" | "unsubscribed";

// Convert the base64url VAPID public key to the Uint8Array pushManager expects.
// Backed by an explicit ArrayBuffer so the type is Uint8Array<ArrayBuffer>
// (BufferSource), which applicationServerKey requires.
function urlBase64ToUint8Array(base64: string): Uint8Array<ArrayBuffer> {
  const padding = "=".repeat((4 - (base64.length % 4)) % 4);
  const b64 = (base64 + padding).replace(/-/g, "+").replace(/_/g, "/");
  const raw = atob(b64);
  const buffer = new ArrayBuffer(raw.length);
  const out = new Uint8Array(buffer);
  for (let i = 0; i < raw.length; i++) out[i] = raw.charCodeAt(i);
  return out;
}

export function NotificationsSettings() {
  const [status, setStatus] = useState<Status>("loading");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const vapidKey = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;

  // iOS only delivers Web Push to a PWA installed to the home screen.
  const isIOS = typeof navigator !== "undefined" && /iPad|iPhone|iPod/.test(navigator.userAgent);
  const isStandalone =
    typeof window !== "undefined" &&
    (window.matchMedia("(display-mode: standalone)").matches ||
      (window.navigator as unknown as { standalone?: boolean }).standalone === true);
  const iosNeedsInstall = isIOS && !isStandalone;

  useEffect(() => {
    (async () => {
      if (
        typeof window === "undefined" ||
        !("serviceWorker" in navigator) ||
        !("PushManager" in window) ||
        !("Notification" in window)
      ) {
        setStatus("unsupported");
        return;
      }
      if (Notification.permission === "denied") {
        setStatus("denied");
        return;
      }
      try {
        const reg = await navigator.serviceWorker.ready;
        const sub = await reg.pushManager.getSubscription();
        setStatus(sub ? "subscribed" : "unsubscribed");
      } catch {
        setStatus("unsubscribed");
      }
    })();
  }, []);

  const enable = async () => {
    setError(null);
    if (!vapidKey) { setError("מפתח התראות לא מוגדר בשרת"); return; }
    setBusy(true);
    try {
      const permission = await Notification.requestPermission();
      if (permission !== "granted") {
        setStatus(permission === "denied" ? "denied" : "unsubscribed");
        setBusy(false);
        return;
      }
      const reg = await navigator.serviceWorker.ready;
      const sub = await reg.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: urlBase64ToUint8Array(vapidKey),
      });
      const res = await fetch("/api/push/subscribe", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(sub.toJSON()),
      });
      if (!res.ok) throw new Error("save failed");
      setStatus("subscribed");
    } catch (e) {
      console.error(e);
      setError("לא הצלחנו להפעיל התראות. נסה שוב.");
    } finally {
      setBusy(false);
    }
  };

  const disable = async () => {
    setError(null);
    setBusy(true);
    try {
      const reg = await navigator.serviceWorker.ready;
      const sub = await reg.pushManager.getSubscription();
      if (sub) {
        await fetch("/api/push/unsubscribe", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ endpoint: sub.endpoint }),
        });
        await sub.unsubscribe();
      }
      setStatus("unsubscribed");
    } catch {
      setError("שגיאה בכיבוי ההתראות");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="rounded-2xl bg-card border border-border/50 p-6 shadow-sm">
      <div className="flex items-center gap-3 mb-2">
        <Bell className="h-5 w-5 text-primary" />
        <h3 className="text-base font-semibold">התראות</h3>
      </div>
      <p className="text-sm text-muted-foreground mb-4">
        קבל התראה למכשיר ברגע שנכנסת חשבונית חדשה — לאישור, עריכה או סימון כפרטי.
      </p>

      {status === "loading" && <Loader2 className="h-5 w-5 animate-spin text-primary" />}

      {status === "unsupported" && (
        <div className="rounded-xl bg-muted/40 border border-border/40 p-3 text-sm text-muted-foreground flex items-start gap-2">
          <AlertTriangle className="h-4 w-4 shrink-0 mt-0.5" />
          הדפדפן הזה לא תומך בהתראות דחיפה.
        </div>
      )}

      {iosNeedsInstall && status !== "unsupported" && (
        <div className="rounded-xl bg-amber-50 border border-amber-200 p-3 text-[13px] text-amber-800 flex items-start gap-2 mb-3">
          <Share className="h-4 w-4 shrink-0 mt-0.5" />
          <span>
            כדי לקבל התראות באייפון, הוסף קודם את FinDash למסך הבית: לחץ על <b>שיתוף</b> ואז
            <b> הוסף למסך הבית</b>, ופתח את האפליקציה משם.
          </span>
        </div>
      )}

      {status === "denied" && (
        <div className="rounded-xl bg-red-50 border border-red-200 p-3 text-sm text-red-700 flex items-start gap-2">
          <BellOff className="h-4 w-4 shrink-0 mt-0.5" />
          ההתראות חסומות. אפשר אותן בהגדרות הדפדפן/המכשיר ונסה שוב.
        </div>
      )}

      {status === "subscribed" && (
        <div className="flex items-center justify-between gap-3 flex-wrap">
          <span className="text-sm text-emerald-600 flex items-center gap-1.5">
            <Check className="h-4 w-4" /> התראות מופעלות במכשיר הזה
          </span>
          <Button variant="outline" size="sm" onClick={disable} disabled={busy} className="gap-2">
            {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <BellOff className="h-4 w-4" />}
            כבה התראות
          </Button>
        </div>
      )}

      {status === "unsubscribed" && (
        <Button size="sm" onClick={enable} disabled={busy || !!iosNeedsInstall} className="gap-2">
          {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Bell className="h-4 w-4" />}
          הפעל התראות במכשיר הזה
        </Button>
      )}

      {error && <p className="text-[12px] text-red-600 mt-2">{error}</p>}
    </div>
  );
}
