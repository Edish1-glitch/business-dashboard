"use client";
import { categoryColors } from "@/lib/category-colors";

import { useState, useEffect, useCallback, useMemo } from "react";
import {
  FileText,
  Download,
  CreditCard,
  Calendar,
  Loader2,
  Undo2,
  Trash2,
  Eye,
  AlertTriangle,
  X,
  FileDown,
  Search,
  Square,
  CheckSquare,
  Mail,
  Send,
  Receipt,
  CheckCircle2,
  Clock,
  ChevronLeft,
  ChevronRight,
  CornerUpLeft,
  Building2,
  Filter,
  ArrowUpDown,
} from "lucide-react";
import { Button } from "@/components/ui/button";

interface Category {
  id: string;
  name: string;
  color: string | null;
}

interface InvoiceSend {
  id?: string;
  sentTo: string;
  subject: string | null;
  fromEmail: string | null;
  createdAt: string;
}

// A send record returned from the send-email API (includes which invoice it belongs to)
interface SentRecord extends InvoiceSend {
  invoiceId: string;
}

interface Invoice {
  id: string;
  fileName: string;
  vendor: string | null;
  amount: number | null;
  currency: string | null;
  date: string | null;
  source: string;
  isBusiness: boolean;
  creditCardLast4: string | null;
  category: Category | null;
  sends: InvoiceSend[];
  createdAt?: string;
}

interface SenderAccount {
  id: string;
  email: string;
  canSend: boolean;
}

type SortKey = "created" | "amount" | "date" | "vendor";
type SentFilter = "all" | "sent" | "unsent";

const CURRENCY_SYMBOL: Record<string, string> = { USD: "$", EUR: "€", GBP: "£", ILS: "₪" };
const fmtDate = (d: string | Date) => new Date(d).toLocaleDateString("he-IL");

// Stale-while-revalidate cache (module scope → persists across client-side
// navigation) so revisiting shows the last data instantly instead of a blank
// reload/spinner; refreshed in the background on each mount.
let approvedCache: { invoices: Invoice[]; accountantEmail: string; senderAccounts: SenderAccount[] } | null = null;

export default function InvoicesPage() {
  const [invoices, setInvoices] = useState<Invoice[]>(approvedCache?.invoices ?? []);
  const [loading, setLoading] = useState(approvedCache === null);

  // filters / sort / search
  const [filterCategory, setFilterCategory] = useState("");
  const [sentFilter, setSentFilter] = useState<SentFilter>("all");
  const [searchQuery, setSearchQuery] = useState("");
  const [sortKey, setSortKey] = useState<SortKey>("created");
  const [sortAsc, setSortAsc] = useState(false);
  const [pageSize, setPageSize] = useState(20);
  const [currentPage, setCurrentPage] = useState(1);

  // range filters (collapsible panel)
  const [showFilters, setShowFilters] = useState(false);
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const [amountMin, setAmountMin] = useState("");
  const [amountMax, setAmountMax] = useState("");
  const [amountCurrency, setAmountCurrency] = useState("");

  // selection
  const [selected, setSelected] = useState<Set<string>>(new Set());

  // per-item ui
  const [previewId, setPreviewId] = useState<string | null>(null);
  const [expandedSendId, setExpandedSendId] = useState<string | null>(null);
  const [confirmAction, setConfirmAction] = useState<{ type: "unapprove" | "delete"; invoiceId: string; vendorName: string } | null>(null);
  const [actionLoading, setActionLoading] = useState(false);

  // send dialog
  const [sendTargetIds, setSendTargetIds] = useState<string[] | null>(null);
  const [accountantEmail, setAccountantEmail] = useState(approvedCache?.accountantEmail ?? "");
  const [senderAccounts, setSenderAccounts] = useState<SenderAccount[]>(approvedCache?.senderAccounts ?? []);

  // Revalidate in the background; only the first-ever load shows a spinner (loading init).
  const fetchData = useCallback(async () => {
    try {
      const [invRes, setRes] = await Promise.all([
        fetch("/api/invoices?status=approved"),
        fetch("/api/settings"),
      ]);
      const invData = await invRes.json();
      const setData = await setRes.json();
      const inv = invData.invoices || [];
      const email = setData.accountantEmail || "";
      const senders = setData.senderAccounts || [];
      setInvoices(inv);
      setAccountantEmail(email);
      setSenderAccounts(senders);
      approvedCache = { invoices: inv, accountantEmail: email, senderAccounts: senders };
    } catch {
      if (approvedCache === null) setInvoices([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchData(); }, [fetchData]);

  // Mirror optimistic (send/unapprove/delete) changes into the cache for the next visit.
  useEffect(() => { approvedCache = { invoices, accountantEmail, senderAccounts }; }, [invoices, accountantEmail, senderAccounts]);

  const categoryList = useMemo(() => {
    const set = new Set<string>();
    for (const inv of invoices) if (inv.category?.name) set.add(inv.category.name);
    return [...set].sort();
  }, [invoices]);

  // filtered + sorted
  const filtered = useMemo(() => {
    let list = invoices;
    if (filterCategory) list = list.filter((inv) => inv.category?.name === filterCategory);
    if (sentFilter === "sent") list = list.filter((inv) => inv.sends.length > 0);
    if (sentFilter === "unsent") list = list.filter((inv) => inv.sends.length === 0);
    // date range (compares the YYYY-MM-DD part; invoices with no date are excluded when a bound is set)
    if (dateFrom) list = list.filter((inv) => inv.date && inv.date.slice(0, 10) >= dateFrom);
    if (dateTo) list = list.filter((inv) => inv.date && inv.date.slice(0, 10) <= dateTo);
    // amount range + optional currency
    if (amountCurrency) list = list.filter((inv) => (inv.currency || "ILS") === amountCurrency);
    if (amountMin !== "") list = list.filter((inv) => inv.amount !== null && inv.amount >= Number(amountMin));
    if (amountMax !== "") list = list.filter((inv) => inv.amount !== null && inv.amount <= Number(amountMax));
    if (searchQuery.trim()) {
      const q = searchQuery.trim().toLowerCase();
      list = list.filter((inv) =>
        (inv.vendor || "").toLowerCase().includes(q) ||
        (inv.fileName || "").toLowerCase().includes(q) ||
        (inv.amount?.toString() || "").includes(q) ||
        (inv.category?.name || "").toLowerCase().includes(q)
      );
    }
    list = [...list].sort((a, b) => {
      let cmp = 0;
      switch (sortKey) {
        case "amount": cmp = (a.amount || 0) - (b.amount || 0); break;
        case "date": cmp = (a.date || "").localeCompare(b.date || ""); break;
        case "vendor": cmp = (a.vendor || "").localeCompare(b.vendor || ""); break;
        case "created": cmp = (a.createdAt || "").localeCompare(b.createdAt || ""); break;
      }
      return sortAsc ? cmp : -cmp;
    });
    return list;
  }, [invoices, filterCategory, sentFilter, searchQuery, sortKey, sortAsc, dateFrom, dateTo, amountMin, amountMax, amountCurrency]);

  const activeFilterCount = [dateFrom, dateTo, amountMin, amountMax, amountCurrency, filterCategory].filter(Boolean).length;
  const clearFilters = () => { setDateFrom(""); setDateTo(""); setAmountMin(""); setAmountMax(""); setAmountCurrency(""); setFilterCategory(""); };

  const totalPages = Math.max(1, Math.ceil(filtered.length / pageSize));
  const safePage = Math.min(currentPage, totalPages);
  const paginated = useMemo(() => {
    const start = (safePage - 1) * pageSize;
    return filtered.slice(start, start + pageSize);
  }, [filtered, safePage, pageSize]);

  useEffect(() => { setCurrentPage(1); }, [searchQuery, filterCategory, sentFilter, sortKey, sortAsc, pageSize, dateFrom, dateTo, amountMin, amountMax, amountCurrency]);

  // stats
  const stats = useMemo(() => {
    const byCurrency: Record<string, number> = {};
    for (const inv of invoices) {
      if (inv.amount === null) continue;
      const cur = inv.currency || "ILS";
      byCurrency[cur] = (byCurrency[cur] || 0) + inv.amount;
    }
    const unsent = invoices.filter((i) => i.sends.length === 0).length;
    return { count: invoices.length, byCurrency, unsent };
  }, [invoices]);

  const canSendAny = senderAccounts.some((a) => a.canSend);

  // selection helpers
  const toggleSelect = (id: string) => setSelected((prev) => { const n = new Set(prev); n.has(id) ? n.delete(id) : n.add(id); return n; });
  const toggleSelectAll = () => {
    const ids = paginated.map((i) => i.id);
    const all = ids.every((id) => selected.has(id));
    setSelected((prev) => { const n = new Set(prev); ids.forEach((id) => all ? n.delete(id) : n.add(id)); return n; });
  };

  // quick preset: last month, not yet sent
  const selectLastMonthUnsent = () => {
    const now = new Date();
    const start = new Date(now.getFullYear(), now.getMonth() - 1, 1);
    const end = new Date(now.getFullYear(), now.getMonth(), 0, 23, 59, 59);
    const ids = invoices
      .filter((inv) => inv.sends.length === 0 && inv.date && new Date(inv.date) >= start && new Date(inv.date) <= end)
      .map((inv) => inv.id);
    setSelected(new Set(ids));
    if (ids.length === 0) alert("אין חשבוניות מהחודש שעבר שלא נשלחו");
  };

  const executeAction = async () => {
    if (!confirmAction) return;
    setActionLoading(true);
    if (confirmAction.type === "unapprove") {
      await fetch(`/api/invoices/${confirmAction.invoiceId}/unapprove`, { method: "POST" });
    } else {
      await fetch(`/api/invoices/${confirmAction.invoiceId}/delete`, { method: "DELETE" });
    }
    setInvoices((prev) => prev.filter((i) => i.id !== confirmAction.invoiceId));
    setActionLoading(false);
    setConfirmAction(null);
  };

  const formatAmount = (amount: number, currency?: string | null) =>
    `${CURRENCY_SYMBOL[currency || "ILS"] || "₪"}${amount.toLocaleString("he-IL")}`;

  const downloadSelected = async () => {
    if (selected.size === 0) return;
    try {
      const res = await fetch("/api/invoices/bulk-download", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ids: [...selected] }),
      });
      if (!res.ok) throw new Error();
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      const disposition = res.headers.get("Content-Disposition") || "";
      const m = disposition.match(/filename\*=UTF-8''(.+?)(?:;|$)/) || disposition.match(/filename="(.+?)"/);
      a.download = decodeURIComponent(m?.[1] || "invoices.zip");
      document.body.appendChild(a); a.click(); document.body.removeChild(a);
      URL.revokeObjectURL(url);
    } catch { alert("שגיאה בהורדת הקבצים"); }
  };

  // when a send completes, patch local state
  const onSent = (newSends: SentRecord[]) => {
    const byId = new Map(newSends.map((s) => [s.invoiceId, s]));
    setInvoices((prev) => prev.map((inv) => {
      const s = byId.get(inv.id);
      return s ? { ...inv, sends: [s, ...inv.sends] } : inv;
    }));
    setSelected(new Set());
  };

  if (loading) return <div className="flex items-center justify-center py-16"><Loader2 className="h-8 w-8 text-primary animate-spin" /></div>;

  if (invoices.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-16 text-muted-foreground max-w-md mx-auto text-center">
        <FileText className="h-12 w-12 mb-4 opacity-30" />
        <p className="text-lg font-medium">אין חשבוניות מאושרות</p>
        <p className="text-sm mt-1">אשר חשבוניות בעמוד <a href="/invoices/pending" className="text-primary font-medium hover:underline">ממתינות לאישור</a></p>
      </div>
    );
  }

  const allSelected = paginated.length > 0 && paginated.every((i) => selected.has(i.id));

  return (
    <div data-tour="invoices-list" className="space-y-3 max-w-5xl mx-auto">
      {/* Header */}
      <div className="flex items-start justify-between gap-2">
        <div>
          <h2 className="text-lg sm:text-xl font-bold">חשבוניות מאושרות</h2>
          <p className="text-xs sm:text-sm text-muted-foreground">
            {invoices.length} מאושרות
            {stats.unsent > 0 && (
              <button
                onClick={() => setSentFilter("unsent")}
                className="mr-2 inline-flex items-center gap-1 text-amber-600 hover:underline"
              >
                <Clock className="h-3 w-3" />
                {stats.unsent} ממתינות לשליחה
              </button>
            )}
          </p>
        </div>
        <Button variant="outline" size="sm" onClick={() => window.open("/api/invoices/export?format=csv", "_blank")} className="gap-2 h-8 text-xs shrink-0">
          <FileDown className="h-4 w-4" /> CSV
        </Button>
      </div>

      {/* Stats strip */}
      <div className="grid grid-cols-3 gap-2">
        <div className="rounded-xl glass p-2.5 sm:p-3 text-center">
          <div className="flex items-center justify-center gap-1.5 text-muted-foreground mb-0.5">
            <Receipt className="h-3.5 w-3.5" /><span className="text-[10px] sm:text-xs">סה&quot;כ</span>
          </div>
          <div className="text-sm sm:text-base font-bold space-y-0.5">
            {Object.entries(stats.byCurrency).map(([cur, total]) => (
              <div key={cur}>{CURRENCY_SYMBOL[cur] || cur}{total.toLocaleString("he-IL", { maximumFractionDigits: 0 })}</div>
            ))}
            {Object.keys(stats.byCurrency).length === 0 && <div>₪0</div>}
          </div>
        </div>
        <div className="rounded-xl glass p-2.5 sm:p-3 text-center">
          <div className="flex items-center justify-center gap-1.5 text-muted-foreground mb-0.5">
            <CheckCircle2 className="h-3.5 w-3.5" /><span className="text-[10px] sm:text-xs">חשבוניות</span>
          </div>
          <p className="text-sm sm:text-lg font-bold">{stats.count}</p>
        </div>
        <div className="rounded-xl glass p-2.5 sm:p-3 text-center">
          <div className="flex items-center justify-center gap-1.5 text-muted-foreground mb-0.5">
            <Send className="h-3.5 w-3.5" /><span className="text-[10px] sm:text-xs">ממתין לשליחה</span>
          </div>
          <p className="text-sm sm:text-lg font-bold">{stats.unsent}</p>
        </div>
      </div>

      {/* Search + Sort */}
      <div className="flex items-center gap-2">
        <div className="relative flex-1">
          <Search className="absolute right-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
          <input
            type="text"
            placeholder="חיפוש לפי ספק, סכום או קטגוריה..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full h-9 rounded-lg border border-input bg-background pr-8 pl-3 text-[16px] sm:text-xs"
          />
        </div>
        {/* Sort dropdown + direction + filter toggle */}
        <div className="flex items-center gap-1 shrink-0">
          <div className="flex items-center gap-1 h-9 rounded-lg bg-muted/50 pr-2">
            <ArrowUpDown className="h-3.5 w-3.5 text-muted-foreground" />
            <select
              value={sortKey}
              onChange={(e) => setSortKey(e.target.value as SortKey)}
              className="h-9 bg-transparent text-[11px] sm:text-xs text-foreground border-none cursor-pointer focus:outline-none"
              title="מיין לפי"
            >
              <option value="created">מיין: חדש</option>
              <option value="date">מיין: תאריך</option>
              <option value="amount">מיין: סכום</option>
              <option value="vendor">מיין: ספק</option>
            </select>
            <button onClick={() => setSortAsc((v) => !v)} className="text-muted-foreground hover:text-foreground text-sm w-5 shrink-0" title={sortAsc ? "עולה" : "יורד"}>
              {sortAsc ? "↑" : "↓"}
            </button>
          </div>
          <button
            onClick={() => setShowFilters((s) => !s)}
            className={`h-9 px-2.5 rounded-lg text-[11px] sm:text-xs flex items-center gap-1 transition-colors shrink-0 ${showFilters || activeFilterCount > 0 ? "bg-primary text-primary-foreground" : "bg-muted/50 text-muted-foreground hover:bg-muted"}`}
          >
            <Filter className="h-3.5 w-3.5" /> סינון{activeFilterCount > 0 ? ` (${activeFilterCount})` : ""}
          </button>
        </div>
      </div>

      {/* Quick filters: sent status + last-month preset */}
      <div className="flex items-center gap-2 flex-wrap">
        <div className="flex gap-1 rounded-lg bg-muted/50 p-0.5">
          {([["all", "הכל"], ["unsent", "לא נשלח"], ["sent", "נשלח"]] as [SentFilter, string][]).map(([key, label]) => (
            <button
              key={key}
              onClick={() => setSentFilter(key)}
              className={`h-7 px-2.5 rounded-md text-[11px] transition-colors ${sentFilter === key ? "bg-card shadow-sm font-medium" : "text-muted-foreground hover:text-foreground"}`}
            >
              {label}
            </button>
          ))}
        </div>
        <button
          onClick={selectLastMonthUnsent}
          className="h-8 px-2.5 rounded-lg text-[11px] bg-muted/50 text-muted-foreground hover:bg-muted transition-colors flex items-center gap-1"
          title="בחר את כל ההוצאות מהחודש שעבר שטרם נשלחו"
        >
          <Calendar className="h-3 w-3" /> חודש שעבר (לא נשלח)
        </button>
      </div>

      {/* Collapsible filter panel: date range, amount range + currency, category */}
      {showFilters && (
        <div className="rounded-xl glass p-3 space-y-3">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {/* Date range */}
            <div>
              <label className="text-[11px] font-medium text-muted-foreground mb-1 flex items-center gap-1"><Calendar className="h-3 w-3" /> טווח תאריכים</label>
              <div className="grid grid-cols-2 gap-1.5">
                <div>
                  <span className="text-[10px] text-muted-foreground mb-0.5 block">מתאריך</span>
                  <input type="date" value={dateFrom} onChange={(e) => setDateFrom(e.target.value)} className="w-full h-9 rounded-lg border border-input bg-background px-2 text-[13px]" />
                </div>
                <div>
                  <span className="text-[10px] text-muted-foreground mb-0.5 block">עד תאריך</span>
                  <input type="date" value={dateTo} onChange={(e) => setDateTo(e.target.value)} className="w-full h-9 rounded-lg border border-input bg-background px-2 text-[13px]" />
                </div>
              </div>
            </div>
            {/* Amount range + currency */}
            <div>
              <label className="text-[11px] font-medium text-muted-foreground mb-1 block">טווח סכומים</label>
              <div className="flex gap-1.5">
                <div className="flex-1 min-w-0">
                  <span className="text-[10px] text-muted-foreground mb-0.5 block">מסכום</span>
                  <input type="number" inputMode="decimal" placeholder="0" value={amountMin} onChange={(e) => setAmountMin(e.target.value)} className="w-full h-9 rounded-lg border border-input bg-background px-2 text-[13px]" />
                </div>
                <div className="flex-1 min-w-0">
                  <span className="text-[10px] text-muted-foreground mb-0.5 block">עד סכום</span>
                  <input type="number" inputMode="decimal" placeholder="ללא הגבלה" value={amountMax} onChange={(e) => setAmountMax(e.target.value)} className="w-full h-9 rounded-lg border border-input bg-background px-2 text-[13px]" />
                </div>
                <div className="w-[56px] shrink-0">
                  <span className="text-[10px] text-muted-foreground mb-0.5 block">מטבע</span>
                  <select value={amountCurrency} onChange={(e) => setAmountCurrency(e.target.value)} className="w-full h-9 rounded-lg border border-input bg-background text-[13px] text-center">
                    <option value="">הכל</option>
                    <option value="ILS">₪</option>
                    <option value="USD">$</option>
                    <option value="EUR">€</option>
                    <option value="GBP">£</option>
                  </select>
                </div>
              </div>
            </div>
            {/* Category */}
            {categoryList.length > 0 && (
              <div>
                <label className="text-[11px] font-medium text-muted-foreground mb-1 block">קטגוריה</label>
                <select value={filterCategory} onChange={(e) => setFilterCategory(e.target.value)} className="w-full h-9 rounded-lg border border-input bg-background px-2 text-[13px]">
                  <option value="">כל הקטגוריות</option>
                  {categoryList.map((cat) => <option key={cat} value={cat}>{cat}</option>)}
                </select>
              </div>
            )}
          </div>
          <div className="flex items-center justify-between">
            <span className="text-[11px] text-muted-foreground">{filtered.length} תוצאות</span>
            {activeFilterCount > 0 && (
              <button onClick={clearFilters} className="text-[11px] text-red-500 hover:text-red-700 flex items-center gap-1">
                <X className="h-3 w-3" /> נקה סינון
              </button>
            )}
          </div>
        </div>
      )}

      {/* Sticky bulk bar */}
      <div className="sticky top-16 z-30 bg-background/90 backdrop-blur-sm py-1.5 -mx-2 px-2 sm:-mx-4 sm:px-4 flex items-center gap-2 flex-wrap">
        <Button variant="outline" size="sm" onClick={toggleSelectAll} className="gap-1.5 h-7 text-[11px]">
          {allSelected ? <CheckSquare className="h-3.5 w-3.5" /> : <Square className="h-3.5 w-3.5" />}
          {allSelected ? "בטל" : "בחר הכל"}
        </Button>
        {selected.size > 0 && (
          <>
            <span className="text-[11px] text-muted-foreground">{selected.size} נבחרו</span>
            <Button size="sm" onClick={() => setSendTargetIds([...selected])} className="gap-1 bg-primary hover:bg-primary/90 h-7 text-[11px]">
              <Send className="h-3 w-3" /> שלח במייל
            </Button>
            <Button variant="outline" size="sm" onClick={downloadSelected} className="gap-1 h-7 text-[11px]">
              <Download className="h-3 w-3" /> הורד
            </Button>
          </>
        )}
        {(searchQuery || filterCategory || sentFilter !== "all") && (
          <span className="text-[11px] text-muted-foreground mr-auto">{filtered.length} תוצאות</span>
        )}
      </div>

      {/* Preview modal */}
      {previewId && (() => {
        const inv = invoices.find((i) => i.id === previewId);
        const isHtml = inv?.fileName.endsWith(".html");
        return (
          <div className="fixed inset-0 z-[100] bg-black/70 flex items-center justify-center p-4" onClick={() => setPreviewId(null)}>
            <div className="bg-white rounded-2xl overflow-hidden max-w-2xl max-h-[85vh] w-full flex flex-col" onClick={(e) => e.stopPropagation()}>
              <div className="flex items-center justify-between p-3 bg-white border-b shrink-0">
                <span className="text-sm font-medium text-gray-700">תצוגה מקדימה</span>
                <button onClick={() => setPreviewId(null)} className="p-1 rounded-lg hover:bg-gray-100"><X className="h-5 w-5 text-gray-500" /></button>
              </div>
              {isHtml ? (
                <iframe src={`/api/invoices/${previewId}/preview`} className="w-full flex-1 min-h-[60vh]" sandbox="allow-same-origin" title="preview" />
              ) : (
                <div className="overflow-auto flex-1"><img src={`/api/invoices/${previewId}/preview`} alt="preview" className="w-full" /></div>
              )}
            </div>
          </div>
        );
      })()}

      {/* Cards */}
      <div className="grid gap-2">
        {paginated.map((inv) => {
          const isSelected = selected.has(inv.id);
          const isSent = inv.sends.length > 0;
          const lastSend = inv.sends[0];
          const isExpanded = expandedSendId === inv.id;
          return (
            <div key={inv.id} className={`rounded-xl glass shadow-sm transition-all overflow-hidden ${isSelected ? "ring-2 ring-primary/30 bg-primary/5" : ""}`}>
              <div className="p-2.5 sm:p-3 flex items-center gap-2 sm:gap-3">
                {/* Checkbox */}
                <button onClick={() => toggleSelect(inv.id)} className="shrink-0 text-muted-foreground hover:text-foreground">
                  {isSelected ? <CheckSquare className="h-[18px] w-[18px] text-primary" /> : <Square className="h-[18px] w-[18px]" />}
                </button>

                {/* Thumbnail */}
                <button onClick={() => setPreviewId(inv.id)} className="shrink-0 w-10 h-10 sm:w-12 sm:h-12 rounded-lg border border-border overflow-hidden bg-white hover:ring-2 hover:ring-primary/30 transition-all flex items-center justify-center">
                  {inv.fileName.endsWith(".html") ? <Mail className="h-5 w-5 text-muted-foreground/40" /> : <img src={`/api/invoices/${inv.id}/preview`} alt="" className="w-full h-full object-cover object-top" loading="lazy" />}
                </button>

                {/* Content */}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between gap-2">
                    <span className="font-semibold text-[13px] sm:text-sm truncate flex items-center gap-1.5">
                      <Building2 className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
                      {inv.vendor || inv.fileName}
                    </span>
                    {inv.amount !== null ? (
                      <span className="font-bold text-sm sm:text-base shrink-0">{formatAmount(inv.amount, inv.currency)}</span>
                    ) : (
                      <span className="text-[11px] text-muted-foreground/50 shrink-0">ללא סכום</span>
                    )}
                  </div>
                  <div className="flex flex-wrap items-center gap-x-2 gap-y-0.5 mt-0.5 text-[11px] text-muted-foreground">
                    {inv.date && <span className="flex items-center gap-0.5"><Calendar className="h-2.5 w-2.5" />{fmtDate(inv.date)}</span>}
                    {inv.category && <span className={`px-1.5 py-0.5 rounded text-[10px] font-medium ${categoryColors[inv.category.name] || categoryColors["אחר"]}`}>{inv.category.name}</span>}
                    {inv.isBusiness === false && <span className="px-1.5 py-0.5 rounded text-[10px] font-medium bg-slate-200 text-slate-700">פרטי</span>}
                    {inv.creditCardLast4 && <span className="flex items-center gap-0.5"><CreditCard className="h-2.5 w-2.5" />****{inv.creditCardLast4}</span>}
                    {isSent && (
                      <button onClick={() => setExpandedSendId(isExpanded ? null : inv.id)} className="flex items-center gap-0.5 text-emerald-600 font-medium hover:underline">
                        <CheckCircle2 className="h-2.5 w-2.5" /> נשלח {inv.sends.length > 1 ? `(${inv.sends.length})` : ""}
                      </button>
                    )}
                  </div>
                </div>

                {/* Send / Resend — primary action, always labelled */}
                <Button
                  size="sm"
                  variant={isSent ? "outline" : "default"}
                  className={`gap-1.5 h-9 text-[13px] px-4 shrink-0 ${isSent ? "" : "bg-primary hover:bg-primary/90 text-white"}`}
                  onClick={() => setSendTargetIds([inv.id])}
                  title={isSent ? "שלח שוב" : "שלח במייל"}
                >
                  {isSent ? <CornerUpLeft className="h-4 w-4" /> : <Send className="h-4 w-4" />}
                  {isSent ? "שלח שוב" : "שלח"}
                </Button>
              </div>

              {/* Send history (expandable) */}
              {isExpanded && isSent && (
                <div className="px-3 pb-2.5 pt-0 pr-[52px] sm:pr-[64px] space-y-1">
                  {inv.sends.map((s, i) => (
                    <div key={s.id || i} className="flex items-center gap-2 text-[11px] text-muted-foreground bg-muted/40 rounded-lg px-2.5 py-1.5">
                      <Send className="h-3 w-3 text-emerald-500 shrink-0" />
                      <span className="font-medium text-foreground">{s.sentTo}</span>
                      <span>·</span>
                      <span>{fmtDate(s.createdAt)}</span>
                      {s.fromEmail && <span className="hidden sm:inline text-muted-foreground/70">· מ-{s.fromEmail}</span>}
                    </div>
                  ))}
                </div>
              )}

              {/* Action bar — mobile keeps only unapprove + delete (larger targets); preview = tap thumbnail */}
              <div className="flex items-center gap-1.5 px-2.5 sm:px-3 pb-2.5 pt-0 pr-[52px] sm:pr-[64px]">
                <button onClick={() => setPreviewId(inv.id)} className="hidden sm:flex items-center gap-1 text-[11px] text-muted-foreground hover:text-foreground px-1.5 py-0.5 rounded hover:bg-muted transition-colors">
                  <Eye className="h-3 w-3" /> תצוגה
                </button>
                <button onClick={() => window.open(`/api/invoices/${inv.id}/download`, "_blank")} className="hidden sm:flex items-center gap-1 text-[11px] text-muted-foreground hover:text-foreground px-1.5 py-0.5 rounded hover:bg-muted transition-colors">
                  <Download className="h-3 w-3" /> הורדה
                </button>
                <button onClick={() => setConfirmAction({ type: "unapprove", invoiceId: inv.id, vendorName: inv.vendor || inv.fileName })} className="flex items-center gap-1.5 text-[13px] text-muted-foreground hover:text-foreground px-3 py-1.5 rounded-lg hover:bg-muted transition-colors">
                  <Undo2 className="h-3.5 w-3.5" /> החזר לעריכה
                </button>
                <div className="flex-1" />
                <button onClick={() => setConfirmAction({ type: "delete", invoiceId: inv.id, vendorName: inv.vendor || inv.fileName })} className="flex items-center gap-1.5 text-[13px] text-red-400 hover:text-red-600 px-3 py-1.5 rounded-lg hover:bg-red-50 transition-colors">
                  <Trash2 className="h-3.5 w-3.5" /> מחק
                </button>
              </div>
            </div>
          );
        })}
      </div>

      {/* Pagination */}
      {filtered.length > 0 && (
        <div className="flex items-center justify-between gap-2 pt-2 pb-4 flex-wrap">
          <div className="flex items-center gap-2">
            <select value={pageSize} onChange={(e) => setPageSize(Number(e.target.value))} className="h-8 px-2 rounded-lg text-[11px] bg-muted/50 text-muted-foreground border-none cursor-pointer">
              {[5, 10, 20, 50, 100].map((n) => <option key={n} value={n}>{n} בעמוד</option>)}
            </select>
            <span className="text-[11px] text-muted-foreground">{(safePage - 1) * pageSize + 1}-{Math.min(safePage * pageSize, filtered.length)} מתוך {filtered.length}</span>
          </div>
          <div className="flex items-center gap-1">
            <button onClick={() => setCurrentPage((p) => Math.max(1, p - 1))} disabled={safePage <= 1} className="h-8 w-8 rounded-lg flex items-center justify-center text-muted-foreground hover:bg-muted disabled:opacity-30 disabled:cursor-not-allowed transition-colors"><ChevronRight className="h-4 w-4" /></button>
            {Array.from({ length: totalPages }, (_, i) => i + 1)
              .filter((p) => p === 1 || p === totalPages || Math.abs(p - safePage) <= 1)
              .reduce<(number | "...")[]>((acc, p, i, arr) => { if (i > 0 && p - arr[i - 1] > 1) acc.push("..."); acc.push(p); return acc; }, [])
              .map((p, i) => p === "..." ? <span key={`d${i}`} className="text-[11px] text-muted-foreground px-1">...</span> : (
                <button key={p} onClick={() => setCurrentPage(p)} className={`h-8 min-w-[32px] px-1.5 rounded-lg text-[12px] font-medium transition-colors ${p === safePage ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:bg-muted"}`}>{p}</button>
              ))}
            <button onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))} disabled={safePage >= totalPages} className="h-8 w-8 rounded-lg flex items-center justify-center text-muted-foreground hover:bg-muted disabled:opacity-30 disabled:cursor-not-allowed transition-colors"><ChevronLeft className="h-4 w-4" /></button>
          </div>
        </div>
      )}

      {/* Send dialog */}
      {sendTargetIds && (
        <SendDialog
          invoices={invoices.filter((i) => sendTargetIds.includes(i.id))}
          accountantEmail={accountantEmail}
          senderAccounts={senderAccounts}
          canSendAny={canSendAny}
          onClose={() => setSendTargetIds(null)}
          onSent={(sends, savedAccountant) => {
            onSent(sends);
            if (savedAccountant) setAccountantEmail(savedAccountant);
            setSendTargetIds(null);
          }}
        />
      )}

      {/* Confirm modal */}
      {confirmAction && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
          <div className="fixed inset-0 bg-black/40" onClick={() => !actionLoading && setConfirmAction(null)} />
          <div className="relative bg-card rounded-2xl shadow-xl p-6 max-w-sm w-full space-y-4">
            <div className="flex items-center gap-3">
              <div className={`flex items-center justify-center w-10 h-10 rounded-xl ${confirmAction.type === "delete" ? "bg-red-100" : "bg-amber-100"}`}>
                <AlertTriangle className={`h-5 w-5 ${confirmAction.type === "delete" ? "text-red-600" : "text-amber-600"}`} />
              </div>
              <div>
                <h3 className="font-semibold">{confirmAction.type === "delete" ? "מחיקת חשבונית" : "החזרה לעריכה"}</h3>
                <p className="text-sm text-muted-foreground">{confirmAction.vendorName}</p>
              </div>
            </div>
            <p className="text-sm text-muted-foreground">
              {confirmAction.type === "delete"
                ? "האם אתה בטוח שברצונך למחוק את החשבונית? פעולה זו אינה ניתנת לביטול."
                : "האם אתה בטוח שברצונך להחזיר את החשבונית לעריכה? היא תוסר מהחישובים ותעבור לדף ממתינות לאישור."}
            </p>
            <div className="flex gap-2 justify-end">
              <Button variant="ghost" size="sm" onClick={() => setConfirmAction(null)} disabled={actionLoading}><X className="h-4 w-4 ml-1" /> ביטול</Button>
              <Button size="sm" onClick={executeAction} disabled={actionLoading} className={confirmAction.type === "delete" ? "bg-red-600 hover:bg-red-700" : "bg-amber-600 hover:bg-amber-700"}>
                {actionLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : confirmAction.type === "delete" ? "מחק" : "החזר לעריכה"}
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

/* ===================== Send Dialog ===================== */
function SendDialog({
  invoices,
  accountantEmail,
  senderAccounts,
  canSendAny,
  onClose,
  onSent,
}: {
  invoices: Invoice[];
  accountantEmail: string;
  senderAccounts: SenderAccount[];
  canSendAny: boolean;
  onClose: () => void;
  onSent: (sends: SentRecord[], savedAccountant?: string) => void;
}) {
  const sendableAccounts = senderAccounts.filter((a) => a.canSend);
  const [to, setTo] = useState(accountantEmail);
  const [fromAccountId, setFromAccountId] = useState(sendableAccounts[0]?.id || "");
  const [saveAsDefault, setSaveAsDefault] = useState(false);
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const alreadySent = invoices.filter((i) => i.sends.length > 0);

  // date range for defaults
  const dates = invoices.map((i) => i.date).filter(Boolean).map((d) => new Date(d as string)).sort((a, b) => a.getTime() - b.getTime());
  const rangeText = dates.length
    ? dates[0].getTime() === dates[dates.length - 1].getTime()
      ? `מתאריך ${fmtDate(dates[0])}`
      : `מ-${fmtDate(dates[0])} עד ${fmtDate(dates[dates.length - 1])}`
    : "";

  const total = invoices.reduce((acc, i) => {
    const cur = i.currency || "ILS";
    acc[cur] = (acc[cur] || 0) + (i.amount || 0);
    return acc;
  }, {} as Record<string, number>);

  const [subject, setSubject] = useState(`הוצאות ${rangeText}`.trim());
  const [body, setBody] = useState(
    `שלום,\n\nמצורפות ${invoices.length} חשבוניות/הוצאות${rangeText ? " " + rangeText : ""}.\n\nתודה.\n`
  );

  const handleSend = async () => {
    setError(null);
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(to.trim())) { setError("כתובת מייל לא תקינה"); return; }
    setSending(true);
    try {
      const res = await fetch("/api/invoices/send-email", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ invoiceIds: invoices.map((i) => i.id), to: to.trim(), subject, body, fromAccountId }),
      });
      const data = await res.json();
      if (!res.ok) { setError(data.message || data.error || "שגיאה בשליחה"); setSending(false); return; }

      // Save accountant email if requested
      let savedAccountant: string | undefined;
      if (saveAsDefault && to.trim() !== accountantEmail) {
        await fetch("/api/settings", { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ accountantEmail: to.trim() }) });
        savedAccountant = to.trim();
      }
      onSent(data.sends || [], savedAccountant);
    } catch {
      setError("שגיאה בשליחה. נסה שוב.");
      setSending(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[110] flex items-center justify-center p-4">
      <div className="fixed inset-0 bg-black/50" onClick={() => !sending && onClose()} />
      <div className="relative bg-card rounded-2xl shadow-xl w-full max-w-md max-h-[90vh] overflow-auto">
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-border sticky top-0 bg-card z-10">
          <div className="flex items-center gap-2">
            <div className="flex items-center justify-center w-8 h-8 rounded-lg bg-primary/10"><Send className="h-4 w-4 text-primary" /></div>
            <h3 className="font-semibold">שליחת חשבוניות במייל</h3>
          </div>
          <button onClick={() => !sending && onClose()} className="p-1 rounded-lg hover:bg-muted"><X className="h-5 w-5 text-muted-foreground" /></button>
        </div>

        <div className="p-4 space-y-3">
          {/* No send permission */}
          {!canSendAny ? (
            <div className="rounded-xl bg-amber-50 border border-amber-200 p-4 text-center space-y-2">
              <AlertTriangle className="h-6 w-6 text-amber-500 mx-auto" />
              <p className="text-sm text-amber-800">כדי לשלוח מיילים צריך לחבר מחדש את חשבון ה-Gmail עם הרשאת שליחה.</p>
              <a href="/api/email-accounts/connect"><Button size="sm" className="gap-2"><Mail className="h-4 w-4" /> חבר Gmail מחדש</Button></a>
            </div>
          ) : (
            <>
              {/* Summary */}
              <div className="rounded-xl bg-muted/40 p-3 flex items-center justify-between text-sm">
                <span className="font-medium">{invoices.length} חשבוניות</span>
                <span className="text-muted-foreground">
                  {Object.entries(total).map(([cur, t]) => `${CURRENCY_SYMBOL[cur] || cur}${t.toLocaleString("he-IL", { maximumFractionDigits: 2 })}`).join(" · ")}
                </span>
              </div>

              {/* Duplicate warning */}
              {alreadySent.length > 0 && (
                <div className="rounded-xl bg-amber-50 border border-amber-200 p-2.5 flex items-start gap-2 text-[12px] text-amber-800">
                  <AlertTriangle className="h-4 w-4 shrink-0 mt-0.5" />
                  <span>{alreadySent.length} מהחשבוניות כבר נשלחו בעבר. שליחה חוזרת תיצור עותק נוסף.</span>
                </div>
              )}

              {/* Recipient */}
              <div>
                <label className="text-[11px] font-medium text-muted-foreground mb-0.5 block">אל (מייל רו&quot;ח)</label>
                <input type="email" dir="ltr" value={to} onChange={(e) => setTo(e.target.value)} placeholder="accountant@example.com" className="w-full h-9 rounded-lg border border-input bg-background px-2.5 text-[16px] sm:text-sm text-left" />
              </div>

              {/* Sender (only if multiple) */}
              {sendableAccounts.length > 1 && (
                <div>
                  <label className="text-[11px] font-medium text-muted-foreground mb-0.5 block">מאת</label>
                  <select value={fromAccountId} onChange={(e) => setFromAccountId(e.target.value)} className="w-full h-9 rounded-lg border border-input bg-background px-2.5 text-[16px] sm:text-sm">
                    {sendableAccounts.map((a) => <option key={a.id} value={a.id}>{a.email}</option>)}
                  </select>
                </div>
              )}

              {/* Subject */}
              <div>
                <label className="text-[11px] font-medium text-muted-foreground mb-0.5 block">נושא</label>
                <input type="text" value={subject} onChange={(e) => setSubject(e.target.value)} className="w-full h-9 rounded-lg border border-input bg-background px-2.5 text-[16px] sm:text-sm" />
              </div>

              {/* Body */}
              <div>
                <label className="text-[11px] font-medium text-muted-foreground mb-0.5 block">תוכן</label>
                <textarea value={body} onChange={(e) => setBody(e.target.value)} rows={4} className="w-full rounded-lg border border-input bg-background px-2.5 py-2 text-[16px] sm:text-sm resize-none" />
              </div>

              {/* Save as default */}
              {to.trim() && to.trim() !== accountantEmail && (
                <label className="flex items-center gap-2 text-[12px] text-muted-foreground cursor-pointer">
                  <input type="checkbox" checked={saveAsDefault} onChange={(e) => setSaveAsDefault(e.target.checked)} className="rounded" />
                  שמור כמייל רו&quot;ח קבוע
                </label>
              )}

              {error && <div className="rounded-lg bg-red-50 border border-red-200 p-2.5 text-[12px] text-red-700">{error}</div>}
            </>
          )}
        </div>

        {/* Footer */}
        {canSendAny && (
          <div className="flex items-center gap-2 justify-end p-4 border-t border-border sticky bottom-0 bg-card">
            <Button variant="ghost" size="sm" onClick={onClose} disabled={sending}>ביטול</Button>
            <Button size="sm" onClick={handleSend} disabled={sending} className="gap-2 bg-primary hover:bg-primary/90">
              {sending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
              {sending ? "שולח..." : `שלח (${invoices.length})`}
            </Button>
          </div>
        )}
      </div>
    </div>
  );
}
