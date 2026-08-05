"use client";

import { useEffect } from "react";

/**
 * iOS standalone PWA reports `100vh` / `fixed inset-0` / `bottom:0` TALLER (or
 * mis-aligned) versus the actually-visible area, leaving a gap at the bottom of
 * full-height overlays (filter sheet, preview). The reliable height is
 * `window.innerHeight`. We publish it as `--app-height` and use that for
 * bottom-anchored overlays so they reach the real bottom edge.
 *
 * Renders null + only touches a CSS var in an effect → keeps the provider tree
 * shape stable (no hydration remount).
 */
export function AppHeightVar() {
  useEffect(() => {
    const set = () => {
      document.documentElement.style.setProperty("--app-height", `${window.innerHeight}px`);
    };
    set();
    window.addEventListener("resize", set);
    window.addEventListener("orientationchange", set);
    window.visualViewport?.addEventListener("resize", set);
    return () => {
      window.removeEventListener("resize", set);
      window.removeEventListener("orientationchange", set);
      window.visualViewport?.removeEventListener("resize", set);
    };
  }, []);
  return null;
}
