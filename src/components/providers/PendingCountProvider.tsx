"use client";

import { createContext, useContext, useState, useEffect, useCallback, ReactNode } from "react";

interface PendingCountContextType {
  pendingCount: number;
  refresh: () => void;
}

const PendingCountContext = createContext<PendingCountContextType | null>(null);

export function usePendingCount() {
  const ctx = useContext(PendingCountContext);
  if (!ctx) throw new Error("usePendingCount must be used within PendingCountProvider");
  return ctx;
}

/**
 * Single source of truth for the pending-invoice badge.
 *
 * Previously both Sidebar and Header fetched /api/pending-count independently,
 * each polling on its own interval — so every page kept 2+ pollers hitting the
 * (cross-region) DB. Centralizing here means one fetch + one 60s poll shared by
 * both, cutting redundant round-trips on the slow free tier.
 */
export function PendingCountProvider({ children }: { children: ReactNode }) {
  const [pendingCount, setPendingCount] = useState(0);

  const refresh = useCallback(() => {
    fetch("/api/pending-count")
      .then((r) => r.json())
      .then((d) => setPendingCount(d.count || 0))
      .catch(() => {});
  }, []);

  useEffect(() => {
    refresh();
    const interval = setInterval(refresh, 60000);
    return () => clearInterval(interval);
  }, [refresh]);

  return (
    <PendingCountContext.Provider value={{ pendingCount, refresh }}>
      {children}
    </PendingCountContext.Provider>
  );
}
