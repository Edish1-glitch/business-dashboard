"use client";
import { categoryColors } from "@/lib/category-colors";

import { useState, useEffect, useCallback, useMemo, useRef } from "react";
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
  CheckCircle2,
  Circle,
  Clock,
  ChevronLeft,
  ChevronRight,
  CornerUpLeft,
  Building2,
  ArrowUpDown,
  SlidersHorizontal,
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

  // selection (hidden until the user starts marking)
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [selectionMode, setSelectionMode] = useState(false);

  // per-item ui
  const [previewId, setPreviewId] = useState<string | null>(null);
  const [openId, setOpenId] = useState<string | null>(null); // expanded card (actions + send history)
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

  // Long-press to enter multi-select (the bulk bar stays hidden until then).
  const longPressTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const longPressFired = useRef(false);
  const startLongPress = (id: string) => {
    if (selectionMode) return;
    longPressFired.current = false;
    longPressTimer.current = setTimeout(() => { longPressFired.current = true; setSelectionMode(true); setSelected(new Set([id])); }, 450);
  };
  const cancelLongPress = () => { if (longPressTimer.current) { clearTimeout(longPressTimer.current); longPressTimer.current = null; } };
  const exitSelection = () => { setSelectionMode(false); setSelected(new Set()); };

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
    else setSelectionMode(true);
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
        <div className="flex items-center gap-2 shrink-0">
          {!selectionMode && paginated.length > 0 && (
            <button onClick={() => setSelectionMode(true)} className="h-8 px-3 rounded-lg glass text-[12px] font-medium text-primary flex items-center gap-1.5">
              <CheckSquare className="h-4 w-4" /> בחר
            </button>
          )}
          <Button variant="outline" size="sm" onClick={() => window.open("/api/invoices/export?format=csv", "_blank")} className="gap-2 h-8 text-xs">
            <FileDown className="h-4 w-4" /> CSV
          </Button>
        </div>
      </div>

      {/* Stats — clean tiles (label on top, prominent value) */}
      <div className="grid grid-cols-3 gap-2">
        <div className="glass rounded-2xl p-3 text-center flex flex-col justify-center">
          <div className="text-[10.5px] text-muted-foreground mb-1">סה&quot;כ</div>
          <div className="font-black tnum leading-tight text-[15px] sm:text-lg space-y-0.5">
            {Object.entries(stats.byCurrency).map(([cur, total]) => (
              <div key={cur}>{CURRENCY_SYMBOL[cur] || cur}{total.toLocaleString("he-IL", { maximumFractionDigits: 2 })}</div>
            ))}
            {Object.keys(stats.byCurrency).length === 0 && <div>₪0</div>}
          </div>
        </div>
        <div className="glass rounded-2xl p-3 text-center flex flex-col justify-center">
          <div className="text-[10.5px] text-muted-foreground mb-1">חשבוניות</div>
          <div className="text-[22px] sm:text-2xl font-black tnum leading-none">{stats.count}</div>
        </div>
        <div className="glass rounded-2xl p-3 text-center flex flex-col justify-center">
          <div className="text-[10.5px] text-muted-foreground mb-1">ממתין לשליחה</div>
          <div className="text-[22px] sm:text-2xl font-black tnum leading-none text-amber-500">{stats.unsent}</div>
        </div>
      </div>

      {/* Toolbar — clean: search + one filter/sort button */}
      <div className="flex items-center gap-2">
        <div className="relative flex-1">
          <Search className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground pointer-events-none" />
          <input
            type="text"
            placeholder="חיפוש לפי ספק, סכום או קטגוריה..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full h-10 rounded-xl glass border-none pr-9 pl-3 text-[16px] sm:text-sm placeholder:text-muted-foreground/70 focus:outline-none focus:ring-2 focus:ring-violet-400/40"
          />
        </div>
        <button
          onClick={() => setShowFilters(true)}
          className={`relative h-10 px-3.5 rounded-xl flex items-center gap-1.5 shrink-0 text-[13px] font-medium transition-colors ${activeFilterCount > 0 ? "bg-primary text-primary-foreground" : "glass text-muted-foreground"}`}
          title="מיון וסינון"
          aria-label="מיון וסינון"
        >
          <SlidersHorizontal className="h-4 w-4" /> סינון
          {activeFilterCount > 0 && <span className="absolute -top-1 -left-1 min-w-[16px] h-4 px-1 rounded-full bg-amber-500 text-white text-[9px] font-bold flex items-center justify-center">{activeFilterCount}</span>}
        </button>
      </div>

      {/* Status quick chips + common categories */}
      <div className="flex items-center gap-1.5 overflow-x-auto pb-1 -mx-2 px-2 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
        {([["all", "הכל"], ["unsent", "לא נשלח"], ["sent", "נשלח"]] as [SentFilter, string][]).map(([key, label]) => (
          <button
            key={key}
            onClick={() => setSentFilter(key)}
            className={`shrink-0 h-8 px-3.5 rounded-full text-[12px] font-medium transition-colors ${sentFilter === key ? "bg-primary text-primary-foreground shadow-sm shadow-primary/25" : "glass text-muted-foreground"}`}
          >
            {label}
          </button>
        ))}
        {categoryList.length > 0 && <span className="shrink-0 w-px h-5 bg-border/60 mx-0.5" />}
        {categoryList.slice(0, 6).map((name) => (
          <button
            key={name}
            onClick={() => setFilterCategory((c) => (c === name ? "" : name))}
            className={`shrink-0 h-8 px-3.5 rounded-full text-[12px] font-medium transition-colors ${filterCategory === name ? "bg-primary text-primary-foreground shadow-sm shadow-primary/25" : "glass text-muted-foreground"}`}
          >
            {name}
          </button>
        ))}
      </div>

      {/* Active-filter summary */}
      {(searchQuery || activeFilterCount > 0 || sentFilter !== "all") && (
        <div className="flex items-center justify-between px-1">
          <span className="text-[12px] text-muted-foreground">{filtered.length} תוצאות</span>
          <button onClick={() => { clearFilters(); setSentFilter("all"); setSearchQuery(""); }} className="text-[12px] text-red-500 hover:text-red-600 flex items-center gap-1">
            <X className="h-3.5 w-3.5" /> נקה
          </button>
        </div>
      )}

      {/* Advanced filter — bottom sheet (mobile) / centered card (desktop) */}
      {showFilters && (
        <div className="fixed inset-0 z-[90] flex items-end sm:items-center justify-center" onClick={() => setShowFilters(false)}>
          <div className="absolute inset-0 bg-black/40 backdrop-blur-[2px]" />
          <div
            className="relative w-full sm:max-w-md glass rounded-t-3xl sm:rounded-3xl p-4 max-h-[85vh] overflow-y-auto overscroll-contain"
            style={{ paddingBottom: "max(1rem, env(safe-area-inset-bottom))" }}
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-base font-bold flex items-center gap-2"><SlidersHorizontal className="h-4 w-4" /> מיון וסינון</h3>
              <button onClick={() => setShowFilters(false)} className="w-8 h-8 rounded-full flex items-center justify-center hover:bg-muted"><X className="h-4 w-4" /></button>
            </div>
            <div className="space-y-4">
              {/* Sort */}
              <div>
                <label className="text-[12px] font-semibold mb-1.5 flex items-center gap-1.5"><ArrowUpDown className="h-3.5 w-3.5" /> מיון</label>
                <div className="flex gap-1.5 flex-wrap">
                  {([["created", "חדש"], ["date", "תאריך"], ["amount", "סכום"], ["vendor", "ספק"]] as [SortKey, string][]).map(([k, l]) => (
                    <button key={k} onClick={() => setSortKey(k)} className={`h-9 px-3.5 rounded-xl text-[13px] font-medium transition-colors ${sortKey === k ? "bg-primary text-primary-foreground" : "glass text-muted-foreground"}`}>{l}</button>
                  ))}
                  <button onClick={() => setSortAsc((v) => !v)} className="h-9 px-3.5 rounded-xl glass text-[13px] font-medium text-muted-foreground flex items-center gap-1">{sortAsc ? "עולה ↑" : "יורד ↓"}</button>
                </div>
              </div>
              {/* Date range */}
              <div>
                <label className="text-[12px] font-semibold mb-1.5 flex items-center gap-1.5"><Calendar className="h-3.5 w-3.5" /> טווח תאריכים</label>
                <div className="grid grid-cols-2 gap-2">
                  <input type="date" value={dateFrom} onChange={(e) => setDateFrom(e.target.value)} className="w-full min-w-0 h-11 rounded-xl border border-input bg-background px-3 text-[14px] appearance-none" />
                  <input type="date" value={dateTo} onChange={(e) => setDateTo(e.target.value)} className="w-full min-w-0 h-11 rounded-xl border border-input bg-background px-3 text-[14px] appearance-none" />
                </div>
              </div>
              {/* Amount range + currency */}
              <div>
                <label className="text-[12px] font-semibold mb-1.5 block">טווח סכומים</label>
                <div className="flex gap-2">
                  <input type="number" inputMode="decimal" placeholder="מסכום" value={amountMin} onChange={(e) => setAmountMin(e.target.value)} className="flex-1 min-w-0 h-11 rounded-xl border border-input bg-background px-3 text-[14px]" />
                  <input type="number" inputMode="decimal" placeholder="עד סכום" value={amountMax} onChange={(e) => setAmountMax(e.target.value)} className="flex-1 min-w-0 h-11 rounded-xl border border-input bg-background px-3 text-[14px]" />
                  <select value={amountCurrency} onChange={(e) => setAmountCurrency(e.target.value)} className="w-16 shrink-0 h-11 rounded-xl border border-input bg-background text-[14px] text-center">
                    <option value="">הכל</option>
                    <option value="ILS">₪</option>
                    <option value="USD">$</option>
                    <option value="EUR">€</option>
                    <option value="GBP">£</option>
                  </select>
                </div>
              </div>
              {/* Category */}
              {categoryList.length > 0 && (
                <div>
                  <label className="text-[12px] font-semibold mb-1.5 block">קטגוריה</label>
                  <select value={filterCategory} onChange={(e) => setFilterCategory(e.target.value)} className="w-full h-11 rounded-xl border border-input bg-background px-3 text-[14px]">
                    <option value="">כל הקטגוריות</option>
                    {categoryList.map((cat) => <option key={cat} value={cat}>{cat}</option>)}
                  </select>
                </div>
              )}
              {/* Bulk-select preset */}
              <button onClick={() => { selectLastMonthUnsent(); setShowFilters(false); }} className="w-full h-11 rounded-xl glass text-[13px] font-medium flex items-center justify-center gap-1.5 text-muted-foreground">
                <Calendar className="h-3.5 w-3.5" /> בחר הכל מהחודש שעבר שטרם נשלח
              </button>
            </div>
            <div className="flex gap-2 mt-5">
              <button onClick={() => { clearFilters(); setSentFilter("all"); }} className="flex-1 h-11 rounded-xl glass text-[14px] font-medium text-muted-foreground">נקה הכל</button>
              <button onClick={() => setShowFilters(false)} className="flex-[2] h-11 rounded-xl bg-primary text-primary-foreground text-[14px] font-semibold">הצג {filtered.length} תוצאות</button>
            </div>
          </div>
        </div>
      )}

      {/* Selection bar — hidden until the user starts marking */}
      {selectionMode && (
        <div className="sticky top-16 z-30 glass rounded-2xl px-2.5 py-2 flex items-center gap-2 shadow-lg">
          <button onClick={exitSelection} className="w-8 h-8 rounded-full flex items-center justify-center hover:bg-muted shrink-0" aria-label="בטל בחירה"><X className="h-4 w-4" /></button>
          <button onClick={toggleSelectAll} className="w-8 h-8 rounded-lg flex items-center justify-center hover:bg-muted shrink-0" title={allSelected ? "בטל הכל" : "בחר הכל"} aria-label={allSelected ? "בטל הכל" : "בחר הכל"}>
            {allSelected ? <CheckSquare className="h-[18px] w-[18px] text-primary" /> : <Square className="h-[18px] w-[18px]" />}
          </button>
          <span className="text-[12px] text-muted-foreground shrink-0 whitespace-nowrap">{selected.size} נבחרו</span>
          <div className="flex-1" />
          <button onClick={() => selected.size > 0 && setSendTargetIds([...selected])} disabled={selected.size === 0} className="h-8 px-3 rounded-lg text-white text-[12px] font-semibold flex items-center gap-1 disabled:opacity-40 shrink-0" style={{ background: "linear-gradient(135deg,#8b5cf6,#7c3aed)" }}>
            <Send className="h-3.5 w-3.5" /> שלח
          </button>
          <button onClick={downloadSelected} disabled={selected.size === 0} className="h-8 w-8 rounded-lg glass text-muted-foreground flex items-center justify-center disabled:opacity-40 shrink-0" aria-label="הורד">
            <Download className="h-3.5 w-3.5" />
          </button>
        </div>
      )}

      {/* Preview modal */}
      {previewId && (() => {
        const inv = invoices.find((i) => i.id === previewId);
        const isHtml = inv?.fileName.endsWith(".html");
        return (
          <div className="fixed inset-0 z-[100] bg-black flex flex-col" onClick={() => setPreviewId(null)}>
            <div
              className="shrink-0 flex items-center justify-between px-4 pb-2 text-white/90"
              style={{ paddingTop: "calc(0.5rem + env(safe-area-inset-top))" }}
            >
              <span className="text-sm font-medium">תצוגה מקדימה</span>
              <button onClick={() => setPreviewId(null)} className="p-1.5 rounded-lg hover:bg-white/10"><X className="h-5 w-5" /></button>
            </div>
            <div className="flex-1 overflow-auto overscroll-contain" onClick={(e) => e.stopPropagation()}>
              {isHtml ? (
                <iframe src={`/api/invoices/${previewId}/preview`} className="w-full h-full min-h-full bg-white" sandbox="allow-same-origin" title="preview" />
              ) : (
                <img src={`/api/invoices/${previewId}/preview`} alt="preview" className="w-full bg-white" />
              )}
            </div>
          </div>
        );
      })()}

      {/* Cards */}
      <div className="grid gap-2">
        {paginated.map((inv) => {
          const isSent = inv.sends.length > 0;
          const open = openId === inv.id;
          const isSelected = selected.has(inv.id);
          return (
            <div
              key={inv.id}
              onTouchStart={() => startLongPress(inv.id)}
              onTouchEnd={cancelLongPress}
              onTouchMove={cancelLongPress}
              onContextMenu={(e) => { if (!selectionMode) e.preventDefault(); }}
              className={`glass rounded-2xl overflow-hidden transition-all ${open && !selectionMode ? "ring-2 ring-violet-400/40" : ""} ${selectionMode && isSelected ? "ring-2 ring-violet-500/70" : ""}`}
            >
              {selectionMode ? (
                /* ===== SELECTABLE ROW ===== */
                <div className="p-3 flex items-center gap-3 cursor-pointer select-none" onClick={() => toggleSelect(inv.id)}>
                  <div className="shrink-0">
                    {isSelected ? <CheckCircle2 className="h-6 w-6 text-violet-500" /> : <Circle className="h-6 w-6 text-muted-foreground/40" />}
                  </div>
                  <div className="shrink-0 w-11 h-11 rounded-xl border border-border/40 overflow-hidden bg-white flex items-center justify-center">
                    {inv.fileName.endsWith(".html") ? <Mail className="h-5 w-5 text-muted-foreground/40" /> : <img src={`/api/invoices/${inv.id}/preview`} alt="" className="w-full h-full object-cover object-top" loading="lazy" />}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between gap-2">
                      <span className="font-bold text-[14px] truncate">{inv.vendor || inv.fileName}</span>
                      {inv.amount !== null ? <span className="font-black text-[15px] tnum shrink-0">{formatAmount(inv.amount, inv.currency)}</span> : <span className="text-[11px] text-muted-foreground/50 shrink-0">ללא סכום</span>}
                    </div>
                    <div className="flex flex-wrap items-center gap-1.5 mt-1 text-[10.5px] text-muted-foreground">
                      {inv.category && <span className={`px-2 py-0.5 rounded-full font-medium ${categoryColors[inv.category.name] || categoryColors["אחר"]}`}>{inv.category.name}</span>}
                      {inv.date && <span>{fmtDate(inv.date)}</span>}
                      {isSent ? <span className="text-emerald-600 font-medium">נשלח</span> : <span className="text-amber-500 font-medium">ממתין לשליחה</span>}
                    </div>
                  </div>
                </div>
              ) : (
              <div className="p-3 flex items-center gap-3">
                {/* Thumbnail (tap = preview) */}
                <button onClick={() => { if (longPressFired.current) return; setPreviewId(inv.id); }} className="shrink-0 w-11 h-11 rounded-xl border border-border/40 overflow-hidden bg-white flex items-center justify-center">
                  {inv.fileName.endsWith(".html") ? <Mail className="h-5 w-5 text-muted-foreground/40" /> : <img src={`/api/invoices/${inv.id}/preview`} alt="" className="w-full h-full object-cover object-top" loading="lazy" />}
                </button>

                {/* Content (tap = expand actions) */}
                <button onClick={() => { if (longPressFired.current) return; setOpenId(open ? null : inv.id); }} className="flex-1 min-w-0 text-start flex items-center gap-2">
                  <div className="flex-1 min-w-0">
                    <span className="font-bold text-[14px] truncate block">{inv.vendor || inv.fileName}</span>
                    <div className="flex flex-wrap items-center gap-1.5 mt-1 text-[10.5px] text-muted-foreground">
                      {inv.category && <span className={`px-2 py-0.5 rounded-full font-medium ${categoryColors[inv.category.name] || categoryColors["אחר"]}`}>{inv.category.name}</span>}
                      {inv.date && <span>{fmtDate(inv.date)}</span>}
                      {inv.isBusiness === false && <span className="px-1.5 py-0.5 rounded bg-slate-200 text-slate-700">פרטי</span>}
                      {isSent ? (
                        <span className="text-emerald-600 font-medium flex items-center gap-0.5"><CheckCircle2 className="h-2.5 w-2.5" /> נשלח{inv.sends.length > 1 ? ` (${inv.sends.length})` : ""}</span>
                      ) : (
                        <span className="text-amber-500 font-medium">ממתין לשליחה</span>
                      )}
                    </div>
                  </div>
                  {inv.amount !== null ? <span className="font-black text-[15px] tnum shrink-0">{formatAmount(inv.amount, inv.currency)}</span> : <span className="text-[11px] text-muted-foreground/50 shrink-0">ללא סכום</span>}
                </button>

                {/* Send / Resend — violet paper-plane (brand colour) */}
                <button
                  onClick={() => { if (longPressFired.current) return; setSendTargetIds([inv.id]); }}
                  title={isSent ? "שלח שוב לרו״ח" : "שלח לרו״ח"}
                  aria-label={isSent ? "שלח שוב" : "שלח"}
                  className={`shrink-0 w-10 h-10 rounded-2xl flex items-center justify-center transition-transform active:scale-95 ${isSent ? "glass text-violet-600 dark:text-violet-400" : "text-white shadow-md shadow-violet-500/25"}`}
                  style={isSent ? undefined : { background: "linear-gradient(135deg,#8b5cf6,#7c3aed)" }}
                >
                  {isSent ? <CornerUpLeft className="h-[18px] w-[18px]" /> : <Send className="h-[18px] w-[18px]" strokeWidth={2.4} />}
                </button>
              </div>
              )}

              {/* expanded — send history + secondary actions */}
              {open && !selectionMode && (
                <div className="px-3 pb-3 pt-0 space-y-2">
                  {isSent && (
                    <div className="space-y-1">
                      {inv.sends.map((s, i) => (
                        <div key={s.id || i} className="flex items-center gap-2 text-[11px] text-muted-foreground bg-muted/40 rounded-lg px-2.5 py-1.5">
                          <Send className="h-3 w-3 text-emerald-500 shrink-0" />
                          <span className="font-medium text-foreground">{s.sentTo}</span>
                          <span>·</span>
                          <span>{fmtDate(s.createdAt)}</span>
                        </div>
                      ))}
                    </div>
                  )}
                  <div className="flex items-center gap-1.5">
                    <button onClick={() => window.open(`/api/invoices/${inv.id}/download`, "_blank")} className="flex items-center gap-1.5 text-[13px] text-muted-foreground hover:text-foreground px-3 py-1.5 rounded-lg hover:bg-muted transition-colors">
                      <Download className="h-3.5 w-3.5" /> הורדה
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
              )}
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
