"use client";

import { createContext, useContext, useState, useCallback, ReactNode } from "react";

export interface InvoiceResult {
  id: string | null;
  page: number;
  fileName: string;
  sourceFile: string;
  vendor: string | null;
  amount: number | null;
  date: string | null;
  category: string | null;
  creditCardLast4: string | null;
  duplicate?: boolean;
  message?: string | null;
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

    // Upload ONE file per request instead of all files in a single request.
    // A scanned multi-page bundle can be 90+ OCR pages (~minutes); one giant
    // request exceeded the platform/proxy timeout and the stream was cut,
    // showing "0 processed". Per-file requests each stay short (one file's
    // pages), so any size batch completes; the floating widget shows overall
    // "file X of N" progress and results aggregate across requests.
    const allInvoices: InvoiceResult[] = [];
    let hadNetworkError = false;

    for (let fi = 0; fi < files.length; fi++) {
      const file = files[fi];
      const fileLabel = `קובץ ${fi + 1} מתוך ${files.length}`;
      setUploadState((prev) => ({ ...prev, progress: `${fileLabel}: ${file.name}`, percent: (fi / files.length) * 100 }));

      try {
        const formData = new FormData();
        formData.append("files", file);
        const response = await fetch("/api/upload-invoices", { method: "POST", body: formData });

        if (!response.ok) {
          const data = await response.json().catch(() => ({}));
          // Push a per-file error row so the run continues to the next file.
          allInvoices.push({
            id: null, page: 0, fileName: file.name, sourceFile: file.name,
            vendor: null, amount: null, date: null, category: null, creditCardLast4: null,
            duplicate: false, message: data.error || "שגיאה בעיבוד הקובץ",
          });
          continue;
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
                  // Overall percent = whole files done + fraction of current file.
                  const frac = msg.total > 0 ? msg.current / msg.total : 0;
                  setUploadState((prev) => ({
                    ...prev,
                    progress: `${fileLabel}: ${msg.message}`,
                    percent: ((fi + frac) / files.length) * 100,
                  }));
                } else if (msg.type === "done" && Array.isArray(msg.invoices)) {
                  allInvoices.push(...msg.invoices);
                }
              } catch { /* ignore parse errors */ }
            }
          }
        }
      } catch {
        hadNetworkError = true;
        allInvoices.push({
          id: null, page: 0, fileName: file.name, sourceFile: file.name,
          vendor: null, amount: null, date: null, category: null, creditCardLast4: null,
          duplicate: false, message: "שגיאת רשת בהעלאת הקובץ",
        });
      }
    }

    // Accurate breakdown across ALL files: saved vs duplicates vs failures.
    const saved = allInvoices.filter((r) => r.id && !r.duplicate).length;
    const duplicates = allInvoices.filter((r) => r.duplicate).length;
    const failed = allInvoices.filter((r) => !r.id && !r.duplicate).length;
    let result: string;
    if (hadNetworkError && saved === 0 && duplicates === 0) {
      result = "שגיאה בהעלאת הקבצים";
    } else {
      const parts = [`${saved} נשמרו`];
      if (duplicates > 0) parts.push(`${duplicates} כפילויות`);
      if (failed > 0) parts.push(`${failed} נכשלו`);
      result = parts.join(" · ");
    }
    setUploadState({
      isUploading: false,
      progress: "",
      percent: 0,
      result,
      invoices: allInvoices,
    });
  }, []);

  return (
    <UploadContext.Provider value={{ uploadState, startUpload, dismissResult }}>
      {children}
    </UploadContext.Provider>
  );
}
