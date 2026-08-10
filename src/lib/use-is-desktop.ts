"use client";
import { useEffect, useState } from "react";

/**
 * True on desktop-width viewports (Tailwind `lg` = 1024px+). Starts false so
 * SSR/first paint matches mobile, then syncs after mount. Used only to branch
 * click *behaviour* (open the side-by-side editor directly on desktop) — layout
 * differences are done in CSS so they never flash.
 */
export function useIsDesktop(query = "(min-width: 1024px)"): boolean {
  const [isDesktop, setIsDesktop] = useState(false);
  useEffect(() => {
    const mql = window.matchMedia(query);
    const update = () => setIsDesktop(mql.matches);
    update();
    mql.addEventListener("change", update);
    return () => mql.removeEventListener("change", update);
  }, [query]);
  return isDesktop;
}
