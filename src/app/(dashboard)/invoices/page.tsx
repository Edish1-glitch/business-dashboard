"use client";

import { useState, useEffect, useCallback } from "react";
import {
  FileText,
  Download,
  Tag,
  CreditCard,
  Calendar,
  Building2,
  Search,
  Filter,
  Loader2,
  Undo2,
  Trash2,
  Eye,
  AlertTriangle,
  X,
} from "lucide-react";
import { Button } from "@/components/ui/button";

interface Invoice {
  id: string;
  fileName: string;
  vendor: string | null;
  amount: number | null;
  date: string | null;
  source: string;
  category: { id: string; name: string; color: string | null } | null;
  createdAt: string;
}

const categories = [
  "דלק", "סופר", "מסעדות", "תחבורה", "ביטוח", "תקשורת",
  "חשמל ומים", "שכירות", "ציוד משרדי", "שיווק ופרסום", "מיסים", "אחר",
];

const categoryColors: Record<string, string> = {
  דלק: "bg-orange-100 text-orange-700",
  סופר: "bg-green-100 text-green-700",
  מסעדות: "bg-red-100 text-red-700",
  תחבורה: "bg-blue-100 text-blue-700",
  ביטוח: "bg-violet-100 text-violet-700",
  תקשורת: "bg-cyan-100 text-cyan-700",
  "חשמל ומים": "bg-yellow-100 text-yellow-700",
  שכירות: "bg-pink-100 text-pink-700",
  "ציוד משרדי": "bg-slate-100 text-slate-700",
  "שיווק ופרסום": "bg-rose-100 text-rose-700",
  מיסים: "bg-purple-100 text-purple-700",
  אחר: "bg-gray-100 text-gray-700",
};

interface ConfirmAction {
  type: "unapprove" | "delete";
  invoiceId: string;
  vendorName: string;
}

export default function InvoicesPage() {
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [loading, setLoading] = useState(true);
  const [filterCategory, setFilterCategory] = useState("");
  const [filterCard, setFilterCard] = useState("");
  const [showFilters, setShowFilters] = useState(false);
  const [previewId, setPreviewId] = useState<string | null>(null);
  const [confirmAction, setConfirmAction] = useState<ConfirmAction | null>(null);
  const [actionLoading, setActionLoading] = useState(false);

  const fetchInvoices = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      params.set("status", "approved");
      if (filterCard) params.set("creditCardLast4", filterCard);
      const res = await fetch(`/api/invoices?${params.toString()}`);
      const data = await res.json();
      setInvoices(data.invoices || []);
    } catch {
      setInvoices([]);
    } finally {
      setLoading(false);
    }
  }, [filterCard]);

  useEffect(() => {
    fetchInvoices();
  }, [fetchInvoices]);

  const executeAction = async () => {
    if (!confirmAction) return;
    setActionLoading(true);

    if (confirmAction.type === "unapprove") {
      await fetch(`/api/invoices/${confirmAction.invoiceId}/unapprove`, { method: "POST" });
    } else {
      await fetch(`/api/invoices/${confirmAction.invoiceId}/delete`, { method: "DELETE" });
    }

    setActionLoading(false);
    setConfirmAction(null);
    fetchInvoices();
  };

  const filtered = filterCategory
    ? invoices.filter((inv) => inv.category?.name === filterCategory)
    : invoices;

  const totalAmount = filtered.reduce((sum, inv) => sum + (inv.amount || 0), 0);

  return (
    <div className="space-y-6 max-w-4xl mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-bold">חשבוניות</h2>
          <p className="text-sm text-muted-foreground">
            {filtered.length} חשבוניות | סה&quot;כ ₪{totalAmount.toLocaleString("he-IL")}
          </p>
        </div>
        <Button
          variant="outline"
          size="sm"
          onClick={() => setShowFilters(!showFilters)}
          className="gap-2"
        >
          <Filter className="h-4 w-4" />
          סינון
        </Button>
      </div>

      {/* Filters */}
      {showFilters && (
        <div className="rounded-2xl bg-card border border-border/50 p-4 shadow-sm space-y-3">
          <div className="flex flex-wrap gap-3">
            <div className="flex-1 min-w-[200px]">
              <label className="text-xs font-medium text-muted-foreground mb-1 block">קטגוריה</label>
              <select
                value={filterCategory}
                onChange={(e) => setFilterCategory(e.target.value)}
                className="w-full h-9 rounded-lg border border-input bg-background px-3 text-sm"
              >
                <option value="">הכל</option>
                {categories.map((cat) => (
                  <option key={cat} value={cat}>{cat}</option>
                ))}
              </select>
            </div>
            <div className="flex-1 min-w-[200px]">
              <label className="text-xs font-medium text-muted-foreground mb-1 block">4 ספרות כרטיס</label>
              <div className="relative">
                <Search className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <input
                  type="text"
                  maxLength={4}
                  placeholder="1234"
                  value={filterCard}
                  onChange={(e) => setFilterCard(e.target.value.replace(/\D/g, ""))}
                  className="w-full h-9 rounded-lg border border-input bg-background pr-9 pl-3 text-sm"
                />
              </div>
            </div>
          </div>
          {(filterCategory || filterCard) && (
            <Button variant="ghost" size="sm" onClick={() => { setFilterCategory(""); setFilterCard(""); }}>
              נקה סינון
            </Button>
          )}
        </div>
      )}

      {/* Loading */}
      {loading && (
        <div className="flex items-center justify-center py-12">
          <Loader2 className="h-8 w-8 text-primary animate-spin" />
        </div>
      )}

      {/* Empty state */}
      {!loading && filtered.length === 0 && (
        <div className="flex flex-col items-center justify-center py-16 text-muted-foreground">
          <FileText className="h-12 w-12 mb-4 opacity-30" />
          <p className="text-lg font-medium">אין חשבוניות מאושרות</p>
          <p className="text-sm mt-1">
            העלה חשבוניות ב<a href="/upload" className="text-primary font-medium hover:underline">העלאת חשבוניות</a> ואשר אותן
          </p>
        </div>
      )}

      {/* Invoice list */}
      {!loading && filtered.length > 0 && (
        <div className="grid gap-3">
          {filtered.map((inv) => (
            <div
              key={inv.id}
              className="rounded-2xl bg-card border border-border/50 p-4 shadow-sm hover:shadow-md transition-shadow"
            >
              <div className="flex items-start justify-between gap-4">
                <div className="flex-1 space-y-2">
                  <div className="flex items-center gap-2">
                    <Building2 className="h-4 w-4 text-muted-foreground" />
                    <span className="font-semibold">{inv.vendor || inv.fileName}</span>
                    <span className="text-xs bg-emerald-100 text-emerald-700 px-2 py-0.5 rounded-full font-medium">מאושר</span>
                  </div>

                  <div className="flex flex-wrap items-center gap-3 text-sm">
                    {inv.amount !== null && (
                      <span className="font-bold text-lg">₪{inv.amount.toLocaleString("he-IL")}</span>
                    )}
                    {inv.date && (
                      <span className="flex items-center gap-1 text-muted-foreground">
                        <Calendar className="h-3.5 w-3.5" />
                        {new Date(inv.date).toLocaleDateString("he-IL")}
                      </span>
                    )}
                    {inv.category && (
                      <span className={`flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-medium ${categoryColors[inv.category.name] || categoryColors["אחר"]}`}>
                        <Tag className="h-3 w-3" />
                        {inv.category.name}
                      </span>
                    )}
                  </div>
                </div>

                <div className="flex items-center gap-1">
                  <Button variant="ghost" size="icon" onClick={() => setPreviewId(previewId === inv.id ? null : inv.id)} title="תצוגה מקדימה">
                    <Eye className="h-4 w-4" />
                  </Button>
                  <Button variant="ghost" size="icon" onClick={() => window.open(`/api/invoices/${inv.id}/download`, "_blank")} title="הורדה">
                    <Download className="h-4 w-4" />
                  </Button>
                  <Button variant="ghost" size="icon" onClick={() => setConfirmAction({ type: "unapprove", invoiceId: inv.id, vendorName: inv.vendor || inv.fileName })} title="החזר לעריכה">
                    <Undo2 className="h-4 w-4" />
                  </Button>
                  <Button variant="ghost" size="icon" onClick={() => setConfirmAction({ type: "delete", invoiceId: inv.id, vendorName: inv.vendor || inv.fileName })} title="מחק" className="text-red-500 hover:text-red-700">
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              </div>

              {/* Inline preview */}
              {previewId === inv.id && (
                <div className="mt-3 rounded-xl border border-border overflow-auto bg-white max-h-[500px]">
                  <img
                    src={`/api/invoices/${inv.id}/preview`}
                    alt={`חשבונית - ${inv.vendor || inv.fileName}`}
                    className="w-full"
                    draggable={false}
                  />
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      {/* Confirmation Modal */}
      {confirmAction && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
          <div className="fixed inset-0 bg-black/40" onClick={() => !actionLoading && setConfirmAction(null)} />
          <div className="relative bg-card rounded-2xl shadow-xl p-6 max-w-sm w-full space-y-4">
            <div className="flex items-center gap-3">
              <div className={`flex items-center justify-center w-10 h-10 rounded-xl ${confirmAction.type === "delete" ? "bg-red-100" : "bg-amber-100"}`}>
                <AlertTriangle className={`h-5 w-5 ${confirmAction.type === "delete" ? "text-red-600" : "text-amber-600"}`} />
              </div>
              <div>
                <h3 className="font-semibold">
                  {confirmAction.type === "delete" ? "מחיקת חשבונית" : "החזרה לעריכה"}
                </h3>
                <p className="text-sm text-muted-foreground">{confirmAction.vendorName}</p>
              </div>
            </div>

            <p className="text-sm text-muted-foreground">
              {confirmAction.type === "delete"
                ? "האם אתה בטוח שברצונך למחוק את החשבונית? פעולה זו אינה ניתנת לביטול."
                : "האם אתה בטוח שברצונך להחזיר את החשבונית לעריכה? היא תוסר מהחישובים ותעבור לדף ממתינות לאישור."}
            </p>

            <div className="flex gap-2 justify-end">
              <Button variant="ghost" size="sm" onClick={() => setConfirmAction(null)} disabled={actionLoading}>
                <X className="h-4 w-4 ml-1" /> ביטול
              </Button>
              <Button
                size="sm"
                onClick={executeAction}
                disabled={actionLoading}
                className={confirmAction.type === "delete" ? "bg-red-600 hover:bg-red-700" : "bg-amber-600 hover:bg-amber-700"}
              >
                {actionLoading ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : confirmAction.type === "delete" ? (
                  "מחק"
                ) : (
                  "החזר לעריכה"
                )}
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
