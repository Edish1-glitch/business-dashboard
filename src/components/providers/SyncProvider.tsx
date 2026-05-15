"use client";

import { createContext, useContext, useState, useCallback, ReactNode } from "react";

interface SyncState {
  isSyncing: boolean;
  progress: string;
  percent: number;
  result: string | null;
}

interface SyncContextType {
  syncState: SyncState;
  startSync: (params: { afterDate: string; toDate?: string; accountId?: string }) => void;
  dismissResult: () => void;
}

const SyncContext = createContext<SyncContextType | null>(null);

export function useSyncContext() {
  const ctx = useContext(SyncContext);
  if (!ctx) throw new Error("useSyncContext must be used within SyncProvider");
  return ctx;
}

export function SyncProvider({ children }: { children: ReactNode }) {
  const [syncState, setSyncState] = useState<SyncState>({
    isSyncing: false,
    progress: "",
    percent: 0,
    result: null,
  });

  const dismissResult = useCallback(() => {
    setSyncState((prev) => ({ ...prev, result: null }));
  }, []);

  const startSync = useCallback(
    async (params: { afterDate: string; toDate?: string; accountId?: string }) => {
      setSyncState({ isSyncing: true, progress: "מתחיל סנכרון...", percent: 0, result: null });

      try {
        const body: Record<string, string> = { afterDate: params.afterDate };
        if (params.toDate) body.toDate = params.toDate;
        if (params.accountId) body.accountId = params.accountId;

        const response = await fetch("/api/email-sync", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(body),
        });

        if (!response.ok) {
          const data = await response.json();
          setSyncState({
            isSyncing: false,
            progress: "",
            percent: 0,
            result: data.error || "שגיאה בסנכרון",
          });
          return;
        }

        const reader = response.body?.getReader();
        const decoder = new TextDecoder();

        if (reader) {
          let buffer = "";
          while (true) {
            const { done, value } = await reader.read();
            if (done) break;
            buffer += decoder.decode(value, { stream: true });

            const lines = buffer.split("\n");
            buffer = lines.pop() || "";

            for (const line of lines) {
              if (!line.trim()) continue;
              try {
                const msg = JSON.parse(line);
                if (msg.type === "progress") {
                  setSyncState((prev) => ({
                    ...prev,
                    progress: msg.message,
                    percent: msg.total > 0 ? (msg.current / msg.total) * 100 : 0,
                  }));
                } else if (msg.type === "done") {
                  setSyncState({
                    isSyncing: false,
                    progress: "",
                    percent: 0,
                    result: msg.message,
                  });
                }
              } catch {
                /* ignore parse errors */
              }
            }
          }
        }
      } catch {
        setSyncState({
          isSyncing: false,
          progress: "",
          percent: 0,
          result: "שגיאה בסנכרון",
        });
      }
    },
    []
  );

  return (
    <SyncContext.Provider value={{ syncState, startSync, dismissResult }}>
      {children}
    </SyncContext.Provider>
  );
}
