"use client";

import { useState } from "react";
import { useSyncContext } from "@/components/providers/SyncProvider";
import { RefreshCw, X, ChevronUp, ChevronDown, Mail, CheckCircle2 } from "lucide-react";

export function SyncFloatingWidget() {
  const { syncState, dismissResult } = useSyncContext();
  const [minimized, setMinimized] = useState(false);

  // Don't render if nothing happening
  if (!syncState.isSyncing && !syncState.result) return null;

  return (
    <div className="fixed bottom-4 left-4 z-50 max-w-sm w-80 animate-in slide-in-from-bottom-4">
      <div className="rounded-2xl bg-card border border-border shadow-2xl overflow-hidden">
        {/* Header */}
        <div
          className="flex items-center justify-between px-4 py-2.5 bg-primary/10 cursor-pointer"
          onClick={() => setMinimized(!minimized)}
        >
          <div className="flex items-center gap-2">
            {syncState.isSyncing ? (
              <RefreshCw className="h-4 w-4 text-primary animate-spin" />
            ) : (
              <CheckCircle2 className="h-4 w-4 text-emerald-500" />
            )}
            <span className="text-sm font-medium">
              {syncState.isSyncing ? "סנכרון אימייל" : "סנכרון הושלם"}
            </span>
          </div>
          <div className="flex items-center gap-1">
            {minimized ? (
              <ChevronUp className="h-4 w-4 text-muted-foreground" />
            ) : (
              <ChevronDown className="h-4 w-4 text-muted-foreground" />
            )}
            {!syncState.isSyncing && (
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
            {syncState.isSyncing && (
              <>
                <p className="text-xs text-muted-foreground leading-relaxed">
                  {syncState.progress}
                </p>
                <div className="space-y-1">
                  <div className="flex items-center justify-between">
                    {syncState.percent > 0 && (
                      <span className="text-xs font-medium">{Math.round(syncState.percent)}%</span>
                    )}
                  </div>
                  <div className="w-full h-1.5 bg-muted rounded-full overflow-hidden">
                    <div
                      className="h-full bg-primary rounded-full transition-all duration-300"
                      style={{ width: `${Math.max(syncState.percent, 2)}%` }}
                    />
                  </div>
                </div>
              </>
            )}

            {syncState.result && (
              <div className="text-xs leading-relaxed whitespace-pre-line">
                <div className="flex items-start gap-2">
                  <Mail className="h-3.5 w-3.5 text-primary shrink-0 mt-0.5" />
                  <span>{syncState.result}</span>
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
