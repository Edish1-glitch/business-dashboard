"use client";

import { useEffect, useState } from "react";
import { Plug, Trash2, Loader2, ScrollText, ChevronDown, Check, X } from "lucide-react";

interface Connection {
  id: string;
  label: string | null;
  clientId: string;
  createdAt: string;
  lastUsedAt: string | null;
}

interface LogEntry {
  id: string;
  tool: string;
  summary: string;
  ok: boolean;
  result: string | null;
  createdAt: string;
}

export function McpSettings() {
  const [connections, setConnections] = useState<Connection[]>([]);
  const [loading, setLoading] = useState(true);
  const [revoking, setRevoking] = useState<string | null>(null);
  const [logs, setLogs] = useState<LogEntry[]>([]);
  const [logsLoaded, setLogsLoaded] = useState(false);

  useEffect(() => {
    fetch("/api/mcp-connections")
      .then((r) => (r.ok ? r.json() : { connections: [] }))
      .then((d) => setConnections(d.connections ?? []))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  async function disconnect(id: string) {
    setRevoking(id);
    try {
      await fetch(`/api/mcp-connections/${id}`, { method: "DELETE" });
      setConnections((c) => c.filter((x) => x.id !== id));
    } finally {
      setRevoking(null);
    }
  }

  function loadLogs() {
    if (logsLoaded) return;
    setLogsLoaded(true);
    fetch("/api/mcp-log")
      .then((r) => (r.ok ? r.json() : { logs: [] }))
      .then((d) => setLogs(d.logs ?? []))
      .catch(() => {});
  }

  const fmt = (s: string) => new Date(s).toLocaleString("he-IL", { dateStyle: "short", timeStyle: "short" });

  return (
    <div className="rounded-2xl border border-border/40 bg-card/50 p-4 sm:p-5 space-y-4">
      <div className="flex items-center gap-2">
        <Plug className="h-5 w-5 text-primary" />
        <h3 className="text-base font-semibold">חיבורי MCP (עוזר אישי)</h3>
      </div>
      <p className="text-xs text-muted-foreground -mt-2">
        חיבורים פעילים של Claude / עוזרים אישיים שיש להם גישה ל-FinDash. אפשר לנתק כל אחד בכל רגע.
      </p>

      {loading ? (
        <Loader2 className="h-6 w-6 animate-spin text-primary mx-auto" />
      ) : connections.length === 0 ? (
        <p className="text-sm text-muted-foreground text-center py-3">אין חיבורים פעילים.</p>
      ) : (
        <div className="space-y-2">
          {connections.map((c) => (
            <div key={c.id} className="flex items-center justify-between p-3 rounded-xl bg-muted/30 border border-border/30">
              <div className="space-y-0.5">
                <p className="text-sm font-medium">{c.label || "חיבור MCP"}</p>
                <p className="text-[11px] text-muted-foreground">
                  חובר: {fmt(c.createdAt)}
                  {c.lastUsedAt ? ` · פעיל לאחרונה: ${fmt(c.lastUsedAt)}` : ""}
                </p>
              </div>
              <button
                onClick={() => disconnect(c.id)}
                disabled={revoking === c.id}
                className="h-8 w-8 flex items-center justify-center rounded-lg text-red-500 hover:text-red-700 hover:bg-red-50 transition-colors"
                aria-label="נתק"
              >
                {revoking === c.id ? <Loader2 className="h-4 w-4 animate-spin" /> : <Trash2 className="h-4 w-4" />}
              </button>
            </div>
          ))}
        </div>
      )}

      {/* Action log */}
      <details className="pt-1" onToggle={(e) => (e.currentTarget as HTMLDetailsElement).open && loadLogs()}>
        <summary className="text-xs font-medium text-muted-foreground flex items-center gap-1.5 cursor-pointer select-none list-none">
          <ScrollText className="h-3.5 w-3.5" />
          יומן פעולות
          <ChevronDown className="h-3.5 w-3.5" />
        </summary>
        <div className="mt-2 space-y-1 max-h-72 overflow-y-auto pr-1">
          {!logsLoaded ? null : logs.length === 0 ? (
            <p className="text-[11px] text-muted-foreground py-2">אין פעולות עדיין.</p>
          ) : (
            logs.map((l) => (
              <div key={l.id} className="flex items-start gap-2 text-[11px] py-1 border-b border-border/20">
                {l.ok ? (
                  <Check className="h-3 w-3 text-emerald-500 mt-0.5 shrink-0" />
                ) : (
                  <X className="h-3 w-3 text-red-500 mt-0.5 shrink-0" />
                )}
                <div className="min-w-0 flex-1">
                  <span className="font-medium">{l.tool}</span>
                  <span className="text-muted-foreground"> · {fmt(l.createdAt)}</span>
                  {l.result && !l.ok && <span className="text-red-500 block truncate">{l.result}</span>}
                </div>
              </div>
            ))
          )}
        </div>
      </details>
    </div>
  );
}
