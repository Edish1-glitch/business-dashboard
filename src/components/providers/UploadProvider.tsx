"use client";

import { createContext, useContext, useState, useCallback, ReactNode } from "react";

export interface InvoiceResult {
  id: string;
  page: number;
  fileName: string;
  sourceFile: string;
  vendor: string | null;
  amount: number | null;
  date: string | null;
  category: string | null;
  creditCardLast4: string | null;
}

interface UploadState {
  isUploading: boolean;
  progress: string;
  percent: number;
  result: string | null;              // summary/error message
  invoices: InvoiceResult[] | null;   // non-null only on a successful run
}

interface UploadContextType {
  uploadState: UploadState;
  startUpload: (files: File[]) => void;
  dismissResult: () => void;
}

const UploadContext = createContext<UploadContextType | null>(null);

export function useUpload() {
  const ctx = useContext(UploadContext);
  if (!ctx) throw new Error("useUpload must be used within UploadProvider");
  return ctx;
}

/**
 * Global upload state so processing survives page navigation.
 *
 * The upload used to live in the /upload page's local state, so leaving the
 * page unmounted it — the fetch kept running server-side (invoices still saved)
 * but the progress/result were lost. Hosting the upload here (in the root
 * layout) keeps it alive across pages and lets a floating widget show progress
 * from anywhere, exactly like the Gmail sync.
 */
export function UploadProvider({ children }: { children: ReactNode }) {
  const [uploadState, setUploadState] = useState<UploadState>({
    isUploading: false,
    progress: "",
    percent: 0,
    result: null,
    invoices: null,
  });

  const dismissResult = useCallback(() => {
    setUploadState((prev) => ({ ...prev, result: null, invoices: null }));
  }, []);

  const startUpload = useCallback(async (files: File[]) => {
    if (files.length === 0) return;
    setUploadState({ isUploading: true, progress: `מעבד ${files.length} קבצים...`, percent: 0, result: null, invoices: null });

    try {
      const formData = new FormData();
      files.forEach((file) => formData.append("files", file));

      const response = await fetch("/api/upload-invoices", { method: "POST", body: formData });

      if (!response.ok) {
        const data = await response.json().catch(() => ({}));
        setUploadState({ isUploading: false, progress: "", percent: 0, result: data.error || "שגיאה בעיבוד הקבצים", invoices: null });
        return;
      }

      const reader = response.body?.getReader();
      const decoder = new TextDecoder();
      let finalData: { invoices?: InvoiceResult[] } | null = null;

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
                setUploadState((prev) => ({
                  ...prev,
                  progress: msg.message,
                  percent: msg.total > 0 ? (msg.current / msg.total) * 100 : 0,
                }));
              } else if (msg.type === "done") {
                finalData = msg;
              }
            } catch { /* ignore parse errors */ }
          }
        }
      }

      const invoices = finalData?.invoices || [];
      setUploadState({
        isUploading: false,
        progress: "",
        percent: 0,
        result: `${invoices.length} חשבוניות עובדו בהצלחה`,
        invoices,
      });
    } catch {
      setUploadState({ isUploading: false, progress: "", percent: 0, result: "שגיאה בהעלאת הקבצים", invoices: null });
    }
  }, []);

  return (
    <UploadContext.Provider value={{ uploadState, startUpload, dismissResult }}>
      {children}
    </UploadContext.Provider>
  );
}
