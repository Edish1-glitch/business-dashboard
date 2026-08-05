"use client";

import { useState, useEffect, useCallback } from "react";
import { Loader2, Trash2, RotateCcw, Mail, Info } from "lucide-react";
import { categoryColors } from "@/lib/category-colors";

interface DeletedInvoice {
  id: string;
  fileName: string;
  vendor: string | null;
  amount: number | null;
  currency: string | null;
  date: string | null;
  category: { name: string } | null;
  deletedAt: string | null;
}

const CUR: Record<string, string> = { USD: "$", EUR: "€", GBP: "£", ILS: "₪" };
const RETENTION_DAYS = 14;

export default function DeletedInvoicesPage() {
  const [invoices, setInvoices] = useState<DeletedInvoice[]>([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState<string | null>(null);
  const [confirmPurge, setConfirmPurge] = useState<string | null>(null);

  const fetchData = useCallback(async () => {
    try {
      const res = await fetch("/api/invoices?deleted=true");
      const data = await res.json();
      setInvoices(data.invoices || []);
    } catch { setInvoices([]); }
    finally { setLoading(false); }
  }, []);

  useEffect(() => { fetchData(); }, [fetchData]);

  const restore = async (id: string) => {
    setBusy(id);
    await fetch(`/api/invoices/${id}/restore`, { method: "POST" });
    setBusy(null);
    setInvoices((prev) => prev.filter((i) => i.id !== id));
  };

  const purge = async (id: string) => {
    setBusy(id);
    await fetch(`/api/invoices/${id}?permanent=true`, { method: "DELETE" });
    setBusy(null);
    setConfirmPurge(null);
    setInvoices((prev) => prev.filter((i) => i.id !== id));
  };

  const daysLeft = (deletedAt: string | null) => {
    if (!deletedAt) return RETENTION_DAYS;
    const gone = new Date(deletedAt).getTime() + RETENTION_DAYS * 24 * 60 * 60 * 1000;
    return Math.max(0, Math.ceil((gone - Date.now()) / (24 * 60 * 60 * 1000)));
  };

  const fmtAmount = (amount: number, currency?: string | null) =>
    `${CUR[currency || "ILS"] || "₪"}${amount.toLocaleString("he-IL", { maximumFractionDigits: 2 })}`;

  if (loading) return <div className="flex justify-center py-16"><Loader2 className="h-8 w-8 text-primary animate-spin" /></div>;

  return (
    <div className="space-y-3 max-w-5xl mx-auto">
      <div className="text-center">
        <h2 className="text-lg sm:text-xl font-bold">נמחקו לאחרונה</h2>
        <p className="text-xs sm:text-sm text-muted-foreground">{invoices.length} חשבוניות · נמחקות לצמיתות אוטומטית אחרי {RETENTION_DAYS} יום</p>
      </div>

      {invoices.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-16 text-muted-foreground text-center">
          <Trash2 className="h-12 w-12 mb-4 opacity-30" />
          <p className="text-base font-medium">אין חשבוניות שנמחקו</p>
          <p className="text-sm mt-1">חשבוניות שתמחק יופיעו כאן, ואפשר יהיה לשחזר אותן.</p>
        </div>
      ) : (
        <>
          <div className="glass rounded-2xl p-3 flex items-start gap-2 text-[12px] text-muted-foreground">
            <Info className="h-4 w-4 shrink-0 mt-0.5 text-primary" />
            <span>שחזור מחזיר את החשבונית לרשימות. מחיקה לצמיתות אינה הפיכה.</span>
          </div>

          <div className="grid gap-2">
            {invoices.map((inv) => (
              <div key={inv.id} className="glass rounded-2xl p-3 flex items-center gap-3">
                <div className="shrink-0 w-11 h-11 rounded-xl border border-border/40 overflow-hidden bg-white flex items-center justify-center opacity-70">
                  {inv.fileName.endsWith(".html") ? <Mail className="h-5 w-5 text-muted-foreground/40" /> : <img src={`/api/invoices/${inv.id}/preview`} alt="" className="w-full h-full object-cover object-top" loading="lazy" />}
                </div>
                <div className="flex-1 min-w-0">
                  <span className="font-bold text-[14px] truncate block">{inv.vendor || inv.fileName}</span>
                  <div className="flex flex-wrap items-center gap-1.5 mt-1 text-[10.5px] text-muted-foreground">
                    {inv.category && <span className={`px-2 py-0.5 rounded-full font-medium ${categoryColors[inv.category.name] || categoryColors["אחר"]}`}>{inv.category.name}</span>}
                    <span className="text-amber-500">יימחק בעוד {daysLeft(inv.deletedAt)} ימים</span>
                  </div>
                </div>
                {inv.amount !== null && <span className="font-black text-[15px] tnum shrink-0">{fmtAmount(inv.amount, inv.currency)}</span>}
                <button
                  onClick={() => restore(inv.id)}
                  disabled={busy === inv.id}
                  aria-label="שחזר"
                  title="שחזר"
                  className="shrink-0 w-9 h-9 rounded-xl bg-emerald-600 text-white flex items-center justify-center disabled:opacity-50 active:scale-95 transition-transform"
                >
                  {busy === inv.id ? <Loader2 className="h-4 w-4 animate-spin" /> : <RotateCcw className="h-[18px] w-[18px]" />}
                </button>
                <button
                  onClick={() => setConfirmPurge(inv.id)}
                  disabled={busy === inv.id}
                  aria-label="מחק לצמיתות"
                  title="מחק לצמיתות"
                  className="shrink-0 w-9 h-9 rounded-xl glass text-red-500 flex items-center justify-center disabled:opacity-50"
                >
                  <Trash2 className="h-[18px] w-[18px]" />
                </button>
              </div>
            ))}
          </div>
        </>
      )}

      {/* Permanent-delete confirmation */}
      {confirmPurge && (
        <div className="fixed inset-0 z-[110] flex items-center justify-center p-4" onClick={() => setConfirmPurge(null)}>
          <div className="absolute inset-0 bg-black/50 backdrop-blur-[2px] touch-none" />
          <div className="relative glass rounded-3xl p-5 w-full max-w-xs text-center" onClick={(e) => e.stopPropagation()}>
            <div className="w-12 h-12 rounded-2xl bg-red-500/15 text-red-500 flex items-center justify-center mx-auto mb-3"><Trash2 className="h-6 w-6" /></div>
            <h3 className="font-bold text-[15px] mb-1">למחוק לצמיתות?</h3>
            <p className="text-[12.5px] text-muted-foreground mb-4">הפעולה אינה הפיכה — החשבונית והקובץ יימחקו.</p>
            <div className="flex gap-2">
              <button onClick={() => setConfirmPurge(null)} className="flex-1 h-10 rounded-xl glass text-[14px] font-medium">ביטול</button>
              <button onClick={() => purge(confirmPurge)} className="flex-1 h-10 rounded-xl bg-red-600 text-white text-[14px] font-semibold">מחק לצמיתות</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
