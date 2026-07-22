"use client";

import { useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useUpload } from "@/components/providers/UploadProvider";
import { Upload, X, ChevronUp, ChevronDown, CheckCircle2 } from "lucide-react";

export function UploadFloatingWidget() {
  const { uploadState, dismissResult } = useUpload();
  const [minimized, setMinimized] = useState(false);
  const pathname = usePathname();

  // Nothing to show
  if (!uploadState.isUploading && !uploadState.result) return null;

  // The upload page shows its own inline progress
  if (pathname === "/upload") return null;

  const done = !uploadState.isUploading;

  return (
    // sits above the sync widget so the two never overlap
    <div className="fixed bottom-24 left-4 z-50 max-w-sm w-80 animate-in slide-in-from-bottom-4">
      <div className="rounded-2xl bg-card border border-border shadow-2xl overflow-hidden">
        {/* Header */}
        <div
          className="flex items-center justify-between px-4 py-2.5 bg-primary/10 cursor-pointer"
          onClick={() => setMinimized(!minimized)}
        >
          <div className="flex items-center gap-2">
            {done ? (
              <CheckCircle2 className="h-4 w-4 text-emerald-500" />
            ) : (
              <Upload className="h-4 w-4 text-primary animate-pulse" />
            )}
            <span className="text-sm font-medium">
              {done ? "העלאה הושלמה" : "מעלה חשבוניות"}
            </span>
          </div>
          <div className="flex items-center gap-1">
            {minimized ? (
              <ChevronUp className="h-4 w-4 text-muted-foreground" />
            ) : (
              <ChevronDown className="h-4 w-4 text-muted-foreground" />
            )}
            {done && (
              <button
                onClick={(e) => { e.stopPropagation(); dismissResult(); }}
                className="p-0.5 rounded hover:bg-muted"
              >
                <X className="h-3.5 w-3.5 text-muted-foreground" />
              </button>
            )}
          </div>
        </div>

        {/* Body - collapsible */}
        {!minimized && (
          <div className="px-4 py-3 space-y-2">
            {!done && (
              <>
                <p className="text-xs text-muted-foreground leading-relaxed">{uploadState.progress}</p>
                <div className="space-y-1">
                  {uploadState.percent > 0 && (
                    <span className="text-xs font-medium">{Math.round(uploadState.percent)}%</span>
                  )}
                  <div className="w-full h-1.5 bg-muted rounded-full overflow-hidden">
                    <div
                      className="h-full bg-primary rounded-full transition-all duration-300"
                      style={{ width: `${Math.max(uploadState.percent, 2)}%` }}
                    />
                  </div>
                </div>
              </>
            )}

            {done && uploadState.result && (
              <div className="space-y-1.5">
                <p className="text-xs leading-relaxed">{uploadState.result}</p>
                {uploadState.invoices && uploadState.invoices.length > 0 && (
                  <Link
                    href="/invoices/pending"
                    onClick={() => dismissResult()}
                    className="text-xs font-medium text-primary hover:underline"
                  >
                    עבור לממתינות לאישור ←
                  </Link>
                )}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
