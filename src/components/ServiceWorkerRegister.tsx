"use client";

import { useEffect } from "react";

/**
 * Registers the FinDash service worker (public/sw.js) for Web Push + PWA install.
 * Renders null and does its work in an effect, so the provider/DOM tree shape
 * never changes between renders (avoids the hydration remount pitfall).
 */
export function ServiceWorkerRegister() {
  useEffect(() => {
    if (typeof navigator === "undefined" || !("serviceWorker" in navigator)) return;
    navigator.serviceWorker.register("/sw.js").catch((e) => {
      console.error("SW registration failed:", e);
    });
  }, []);

  return null;
}
