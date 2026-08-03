"use client";

import { useEffect, useState } from "react";
import { Monitor, Smartphone, Loader2, LogOut, ShieldCheck } from "lucide-react";
import { Button } from "@/components/ui/button";

interface Device {
  id: string;
  label: string;
  ip: string | null;
  lastSeenAt: string;
  createdAt: string;
  current: boolean;
}

function timeAgo(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  const m = Math.floor(diff / 60000);
  if (m < 1) return "עכשיו";
  if (m < 60) return `לפני ${m} דק׳`;
  const h = Math.floor(m / 60);
  if (h < 24) return `לפני ${h} שעות`;
  const d = Math.floor(h / 24);
  return d === 1 ? "אתמול" : `לפני ${d} ימים`;
}

export function DevicesSettings() {
  const [devices, setDevices] = useState<Device[]>([]);
  const [loading, setLoading] = useState(true);
  const [removing, setRemoving] = useState<string | null>(null);

  const load = async () => {
    try {
      const res = await fetch("/api/devices");
      const data = await res.json();
      setDevices(data.devices || []);
    } catch { /* ignore */ }
    finally { setLoading(false); }
  };

  useEffect(() => { load(); }, []);

  const disconnect = async (d: Device) => {
    if (d.current && !confirm("זה המכשיר הנוכחי — ניתוק יתנתק אותך מהחשבון כאן. להמשיך?")) return;
    setRemoving(d.id);
    await fetch(`/api/devices/${d.id}`, { method: "DELETE" }).catch(() => {});
    setRemoving(null);
    if (d.current) {
      // We just revoked our own session — reload to get bounced to login.
      window.location.href = "/login";
      return;
    }
    setDevices((prev) => prev.filter((x) => x.id !== d.id));
  };

  const isMobile = (label: string) => /iPhone|iPad|Android/i.test(label);

  return (
    <div className="rounded-2xl bg-card border border-border/50 p-6 shadow-sm">
      <div className="flex items-center gap-3 mb-2">
        <ShieldCheck className="h-5 w-5 text-primary" />
        <h3 className="text-base font-semibold">מכשירים מחוברים</h3>
      </div>
      <p className="text-sm text-muted-foreground mb-4">
        המכשירים שמחוברים כרגע לחשבון שלך. אפשר לנתק כל מכשיר שאינך מזהה.
      </p>

      {loading ? (
        <Loader2 className="h-5 w-5 animate-spin text-primary" />
      ) : devices.length === 0 ? (
        <p className="text-sm text-muted-foreground text-center py-3">אין מכשירים מחוברים.</p>
      ) : (
        <div className="space-y-2">
          {devices.map((d) => (
            <div key={d.id} className="flex items-center justify-between gap-3 p-3 rounded-xl bg-muted/30 border border-border/30">
              <div className="flex items-center gap-3 min-w-0">
                <div className="shrink-0 w-9 h-9 rounded-lg bg-primary/10 flex items-center justify-center">
                  {isMobile(d.label) ? <Smartphone className="h-4 w-4 text-primary" /> : <Monitor className="h-4 w-4 text-primary" />}
                </div>
                <div className="min-w-0">
                  <p className="text-sm font-medium flex items-center gap-2">
                    {d.label}
                    {d.current && (
                      <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-emerald-100 text-emerald-700 font-medium">המכשיר הנוכחי</span>
                    )}
                  </p>
                  <p className="text-[11px] text-muted-foreground">
                    פעיל {timeAgo(d.lastSeenAt)}{d.ip ? ` · ${d.ip}` : ""}
                  </p>
                </div>
              </div>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => disconnect(d)}
                disabled={removing === d.id}
                className="shrink-0 gap-1 text-red-500 hover:text-red-700 hover:bg-red-50 h-8 text-xs"
              >
                {removing === d.id ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <LogOut className="h-3.5 w-3.5" />}
                נתק
              </Button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
