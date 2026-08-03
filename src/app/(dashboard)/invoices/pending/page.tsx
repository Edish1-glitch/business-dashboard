"use client";
import { categoryColors } from "@/lib/category-colors";

import { useState, useEffect, useCallback, useMemo, useRef } from "react";
import {
  CheckCircle2,
  Check,
  Download,
  Calendar,
  Loader2,
  CheckCheck,
  Pencil,
  X,
  Plus,
  Trash2,
  Square,
  CheckSquare,
  Circle,
  Search,
  ArrowUpDown,
  Mail,
  ChevronLeft,
  ChevronRight,
  SlidersHorizontal,
  Briefcase,
  Lock,
} from "lucide-react";

interface Category {
  id: string;
  name: string;
  color: string | null;
}

interface Invoice {
  id: string;
  fileName: string;
  vendor: string | null;
  amount: number | null;
  currency: string | null;
  date: string | null;
  status: string;
  isBusiness: boolean;
  creditCardLast4: string | null;
  category: Category | null;
  emailAccount: { email: string } | null;
  createdAt?: string;
}

type SortKey = "date" | "amount" | "vendor" | "created";

// Stale-while-revalidate cache (module scope → persists across client-side
// navigation). Revisiting the page shows the last data instantly instead of a
// blank reload/spinner; it's refreshed in the background on each mount.
let pendingCache: { invoices: Invoice[]; categories: Category[] } | null = null;

export default function PendingInvoicesPage() {
  const [invoices, setInvoices] = useState<Invoice[]>(pendingCache?.invoices ?? []);
  const [categories, setCategories] = useState<Category[]>(pendingCache?.categories ?? []);
  const [loading, setLoading] = useState(pendingCache === null);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editData, setEditData] = useState<Partial<Invoice>>({});
  const [newCategoryName, setNewCategoryName] = useState("");
  const [showNewCategory, setShowNewCategory] = useState(false);
  const [addingCategory, setAddingCategory] = useState(false);
  const [approving, setApproving] = useState<string | null>(null);
  const [deleting, setDeleting] = useState<string | null>(null);
  const [bulkAction, setBulkAction] = useState(false);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [selectionMode, setSelectionMode] = useState(false); // hidden until the user starts marking
  const [previewId, setPreviewId] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [sortKey, setSortKey] = useState<SortKey>("created");
  const [sortAsc, setSortAsc] = useState(false);
  const [emailFilter, setEmailFilter] = useState<string>("");
  const [pageSize, setPageSize] = useState(20);
  const [currentPage, setCurrentPage] = useState(1);
  const [focusHandled, setFocusHandled] = useState(false);
  const [openId, setOpenId] = useState<string | null>(null); // expanded card showing אשר/ערוך/פרטי

  // advanced filters (bottom sheet)
  const [showFilters, setShowFilters] = useState(false);
  const [filterCategory, setFilterCategory] = useState("");
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const [amountMin, setAmountMin] = useState("");
  const [amountMax, setAmountMax] = useState("");
  const [amountCurrency, setAmountCurrency] = useState("");
  const [timeChip, setTimeChip] = useState<"all" | "month" | "lastMonth" | "3months">("all"); // active quick time chip

  // Long-press to enter multi-select (the bulk bar stays hidden until then).
  const longPressTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const longPressFired = useRef(false); // guards the click that follows a long-press
  const startLongPress = (id: string) => {
    if (selectionMode) return;
    longPressFired.current = false;
    longPressTimer.current = setTimeout(() => { longPressFired.current = true; setSelectionMode(true); setSelected(new Set([id])); }, 450);
  };
  const cancelLongPress = () => { if (longPressTimer.current) { clearTimeout(longPressTimer.current); longPressTimer.current = null; } };
  const exitSelection = () => { setSelectionMode(false); setSelected(new Set()); };

  // Revalidate in the background; only the first-ever load shows a spinner (loading init).
  const fetchData = useCallback(async () => {
    try {
      const [invRes, catRes] = await Promise.all([
        fetch("/api/invoices?status=pending"),
        fetch("/api/categories"),
      ]);
      const invData = await invRes.json();
      const catData = await catRes.json();
      const inv = invData.invoices || [];
      const cat = catData.categories || [];
      setInvoices(inv);
      setCategories(cat);
      pendingCache = { invoices: inv, categories: cat };
    } catch { if (pendingCache === null) setInvoices([]); }
    finally { setLoading(false); }
  }, []);

  useEffect(() => { fetchData(); }, [fetchData]);

  // Mirror optimistic (approve/delete/edit) changes into the cache for the next visit.
  useEffect(() => { pendingCache = { invoices, categories }; }, [invoices, categories]);

  // Deep-link from a push notification: /invoices/pending?focus=<id> opens that
  // invoice's edit view (approve / edit / mark-private) and scrolls to it.
  useEffect(() => {
    if (focusHandled || loading || invoices.length === 0) return;
    const focus = new URLSearchParams(window.location.search).get("focus");
    setFocusHandled(true);
    if (!focus) return;
    const inv = invoices.find((i) => i.id === focus);
    if (inv) {
      setSearchQuery("");
      setCurrentPage(1);
      setOpenId(inv.id);
      setTimeout(() => document.getElementById(`inv-${inv.id}`)?.scrollIntoView({ behavior: "smooth", block: "center" }), 150);
    }
    const url = new URL(window.location.href);
    url.searchParams.delete("focus");
    window.history.replaceState({}, "", url.toString());
  }, [invoices, loading, focusHandled]);

  const emailAccounts = useMemo(() => {
    const set = new Set<string>();
    for (const inv of invoices) {
      if (inv.emailAccount?.email) set.add(inv.emailAccount.email);
    }
    return [...set].sort();
  }, [invoices]);

  // Filtered + sorted invoices
  const filteredInvoices = useMemo(() => {
    let list = invoices;
    if (emailFilter) {
      list = list.filter((inv) => inv.emailAccount?.email === emailFilter);
    }
    if (filterCategory) list = list.filter((inv) => inv.category?.name === filterCategory);
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
  }, [invoices, emailFilter, filterCategory, searchQuery, sortKey, sortAsc, dateFrom, dateTo, amountMin, amountMax, amountCurrency]);

  const activeFilterCount = [filterCategory, dateFrom, dateTo, amountMin, amountMax, amountCurrency].filter(Boolean).length;
  const clearFilters = () => { setFilterCategory(""); setDateFrom(""); setDateTo(""); setAmountMin(""); setAmountMax(""); setAmountCurrency(""); setTimeChip("all"); };

  // Quick time chips — set the date range from a preset (highlights the chip).
  const applyTimeChip = (chip: "all" | "month" | "lastMonth" | "3months") => {
    setTimeChip(chip);
    const pad = (n: number) => String(n).padStart(2, "0");
    const ymd = (d: Date) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
    const now = new Date();
    if (chip === "all") { setDateFrom(""); setDateTo(""); return; }
    if (chip === "month") { setDateFrom(ymd(new Date(now.getFullYear(), now.getMonth(), 1))); setDateTo(ymd(now)); return; }
    if (chip === "lastMonth") { setDateFrom(ymd(new Date(now.getFullYear(), now.getMonth() - 1, 1))); setDateTo(ymd(new Date(now.getFullYear(), now.getMonth(), 0))); return; }
    if (chip === "3months") { setDateFrom(ymd(new Date(now.getFullYear(), now.getMonth() - 2, 1))); setDateTo(ymd(now)); return; }
  };

  // Category chips — the categories that actually appear in the pending list, most-common first.
  const presentCategories = useMemo(() => {
    const counts: Record<string, number> = {};
    for (const inv of invoices) if (inv.category?.name) counts[inv.category.name] = (counts[inv.category.name] || 0) + 1;
    return Object.entries(counts).sort((a, b) => b[1] - a[1]).map(([name]) => name).slice(0, 6);
  }, [invoices]);
  const toggleCategoryChip = (name: string) => setFilterCategory((c) => (c === name ? "" : name));

  const totalPages = Math.max(1, Math.ceil(filteredInvoices.length / pageSize));
  const safePage = Math.min(currentPage, totalPages);
  const paginatedInvoices = useMemo(() => {
    const start = (safePage - 1) * pageSize;
    return filteredInvoices.slice(start, start + pageSize);
  }, [filteredInvoices, safePage, pageSize]);

  useEffect(() => { setCurrentPage(1); }, [searchQuery, emailFilter, sortKey, sortAsc, pageSize, filterCategory, dateFrom, dateTo, amountMin, amountMax, amountCurrency]);

  // Stats - grouped by currency
  const stats = useMemo(() => {
    const withAmount = invoices.filter((i) => i.amount !== null);
    const byCurrency: Record<string, number> = {};
    for (const inv of withAmount) {
      const cur = inv.currency || "ILS";
      byCurrency[cur] = (byCurrency[cur] || 0) + (inv.amount || 0);
    }
    const avg = withAmount.length > 0 ? withAmount.reduce((s, i) => s + (i.amount || 0), 0) / withAmount.length : 0;
    return { count: invoices.length, byCurrency, avg, withAmount: withAmount.length };
  }, [invoices]);

  const currencySymbol = (cur: string) => ({ USD: "$", EUR: "€", GBP: "£", ILS: "₪" }[cur] || cur);

  const toggleSelect = (id: string) => {
    setSelected((prev) => { const next = new Set(prev); if (next.has(id)) next.delete(id); else next.add(id); return next; });
  };
  const toggleSelectAll = () => {
    const pageIds = paginatedInvoices.map((i) => i.id);
    const allPageSelected = pageIds.every((id) => selected.has(id));
    if (allPageSelected) {
      setSelected((prev) => { const next = new Set(prev); pageIds.forEach((id) => next.delete(id)); return next; });
    } else {
      setSelected((prev) => { const next = new Set(prev); pageIds.forEach((id) => next.add(id)); return next; });
    }
  };
  const startEdit = (inv: Invoice) => {
    setEditingId(inv.id);
    setEditData({ vendor: inv.vendor, amount: inv.amount, currency: inv.currency, date: inv.date ? inv.date.split("T")[0] : "", creditCardLast4: inv.creditCardLast4, category: inv.category, isBusiness: inv.isBusiness });
  };
  const saveEdit = async (id: string) => {
    const isBusiness = editData.isBusiness ?? true;
    await fetch(`/api/invoices/${id}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ vendor: editData.vendor, amount: editData.amount, currency: editData.currency, date: editData.date || null, categoryId: editData.category?.id || null, creditCardLast4: editData.creditCardLast4 || null, isBusiness }) });
    setEditingId(null);
    setInvoices((prev) => prev.map((inv) => inv.id === id ? { ...inv, vendor: editData.vendor ?? inv.vendor, amount: editData.amount ?? inv.amount, currency: editData.currency ?? inv.currency, date: editData.date ?? inv.date, creditCardLast4: editData.creditCardLast4 ?? inv.creditCardLast4, category: editData.category ?? inv.category, isBusiness } : inv));
  };
  const approveOne = async (id: string) => { setApproving(id); await fetch(`/api/invoices/${id}/approve`, { method: "POST" }); setApproving(null); setInvoices((prev) => prev.filter((i) => i.id !== id)); setSelected((prev) => { const next = new Set(prev); next.delete(id); return next; }); };
  // "פרטי" — mark the invoice private (not deductible / not sent to accountant) then approve it as a private expense.
  const markPrivate = async (id: string) => {
    setApproving(id);
    await fetch(`/api/invoices/${id}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ isBusiness: false }) });
    await fetch(`/api/invoices/${id}/approve`, { method: "POST" });
    setApproving(null); setOpenId(null);
    setInvoices((prev) => prev.filter((i) => i.id !== id));
  };
  // Save current edits (incl. עסקי/פרטי) then approve — the "אשר" action from the edit view / notification.
  const approveFromEdit = async (id: string) => {
    setApproving(id);
    const isBusiness = editData.isBusiness ?? true;
    await fetch(`/api/invoices/${id}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ vendor: editData.vendor, amount: editData.amount, currency: editData.currency, date: editData.date || null, categoryId: editData.category?.id || null, creditCardLast4: editData.creditCardLast4 || null, isBusiness }) });
    await fetch(`/api/invoices/${id}/approve`, { method: "POST" });
    setApproving(null);
    setEditingId(null);
    setInvoices((prev) => prev.filter((i) => i.id !== id));
    setSelected((prev) => { const next = new Set(prev); next.delete(id); return next; });
  };
  const deleteOne = async (id: string) => { setDeleting(id); await fetch(`/api/invoices/${id}`, { method: "DELETE" }); setDeleting(null); setEditingId(null); setInvoices((prev) => prev.filter((i) => i.id !== id)); setSelected((prev) => { const next = new Set(prev); next.delete(id); return next; }); };
  const bulkApprove = async () => { if (selected.size === 0) return; setBulkAction(true); await fetch("/api/invoices/bulk", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action: "approve", ids: [...selected] }) }); setBulkAction(false); setInvoices((prev) => prev.filter((i) => !selected.has(i.id))); setSelected(new Set()); };
  const bulkDelete = async () => { if (selected.size === 0) return; setBulkAction(true); await fetch("/api/invoices/bulk", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action: "delete", ids: [...selected] }) }); setBulkAction(false); setInvoices((prev) => prev.filter((i) => !selected.has(i.id))); setSelected(new Set()); };
  const addCategory = async () => {
    if (!newCategoryName.trim() || addingCategory) return;
    setAddingCategory(true);
    try {
      const res = await fetch("/api/categories", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ name: newCategoryName.trim() }) });
      const data = await res.json();
      if (data.category) { setCategories((prev) => [...prev, data.category]); setEditData((prev) => ({ ...prev, category: data.category })); setNewCategoryName(""); setShowNewCategory(false); }
    } finally { setAddingCategory(false); }
  };

  // Waiting time helper
  const getWaitingTime = (createdAt?: string) => {
    if (!createdAt) return null;
    const diff = Date.now() - new Date(createdAt).getTime();
    const days = Math.floor(diff / (1000 * 60 * 60 * 24));
    if (days === 0) return "היום";
    if (days === 1) return "אתמול";
    if (days < 7) return `${days} ימים`;
    if (days < 30) return `${Math.floor(days / 7)} שבועות`;
    return `${Math.floor(days / 30)} חודשים`;
  };

  const formatAmount = (amount: number, currency?: string | null) => {
    const sym = { USD: "$", EUR: "€", GBP: "£", ILS: "₪" }[currency || "ILS"] || "₪";
    return `${sym}${amount.toLocaleString("he-IL")}`;
  };

  if (loading) return <div className="flex items-center justify-center py-16"><Loader2 className="h-8 w-8 text-primary animate-spin" /></div>;

  if (invoices.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-16 text-muted-foreground max-w-md mx-auto text-center">
        <CheckCircle2 className="h-12 w-12 mb-4 text-emerald-400" />
        <p className="text-lg font-medium">אין כרגע חשבוניות לאישור</p>
        <p className="text-sm mt-2">ניתן להעלות חשבונית חדשה בעמוד <a href="/upload" className="text-primary font-medium hover:underline">העלאת חשבוניות</a></p>
      </div>
    );
  }

  const allSelected = paginatedInvoices.length > 0 && paginatedInvoices.every((i) => selected.has(i.id));

  return (
    <div data-tour="pending-list" className="space-y-3 max-w-5xl mx-auto">
      {/* Header */}
      <div className="flex items-end justify-between gap-2">
        <div>
          <h2 className="text-lg sm:text-xl font-bold">ממתינות לאישור</h2>
          <p className="text-xs sm:text-sm text-muted-foreground">{invoices.length} חשבוניות ממתינות</p>
        </div>
        {!selectionMode && paginatedInvoices.length > 0 && (
          <button onClick={() => setSelectionMode(true)} className="shrink-0 h-8 px-3 rounded-lg glass text-[12px] font-medium text-primary flex items-center gap-1.5">
            <CheckSquare className="h-4 w-4" /> בחר
          </button>
        )}
      </div>

      {/* Stats — clean tiles (label on top, prominent value) */}
      <div className="grid grid-cols-3 gap-2">
        <div className="glass rounded-2xl p-3 text-center flex flex-col justify-center">
          <div className="text-[10.5px] text-muted-foreground mb-1">סה&quot;כ ממתין</div>
          <div className="font-black tnum leading-tight text-[15px] sm:text-lg space-y-0.5">
            {Object.entries(stats.byCurrency).map(([cur, total]) => (
              <div key={cur}>{currencySymbol(cur)}{total.toLocaleString("he-IL", { maximumFractionDigits: 2 })}</div>
            ))}
            {Object.keys(stats.byCurrency).length === 0 && <div>₪0</div>}
          </div>
        </div>
        <div className="glass rounded-2xl p-3 text-center flex flex-col justify-center">
          <div className="text-[10.5px] text-muted-foreground mb-1">חשבוניות</div>
          <div className="text-[22px] sm:text-2xl font-black tnum leading-none text-amber-500">{stats.count}</div>
        </div>
        <div className="glass rounded-2xl p-3 text-center flex flex-col justify-center">
          <div className="text-[10.5px] text-muted-foreground mb-1">ממוצע</div>
          <div className="text-[18px] sm:text-xl font-black tnum leading-none">₪{stats.avg.toLocaleString("he-IL", { maximumFractionDigits: 2 })}</div>
        </div>
      </div>

      {/* Toolbar — clean: search + one filter/sort button (sort & filters live in the sheet) */}
      <div className="flex items-center gap-2">
        <div className="relative flex-1">
          <Search className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground pointer-events-none" />
          <input
            type="text"
            placeholder="חיפוש לפי ספק או קטגוריה..."
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

      {/* Quick filter chips — time presets + common categories */}
      <div className="flex items-center gap-1.5 overflow-x-auto pb-1 -mx-2 px-2 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
        {(["all", "month", "lastMonth", "3months"] as const).map((key) => {
          const label = { all: "הכל", month: "החודש", lastMonth: "החודש שעבר", "3months": "3 חודשים" }[key];
          const active = key === "all" ? (!dateFrom && !dateTo) : timeChip === key;
          return (
            <button
              key={key}
              onClick={() => applyTimeChip(key)}
              className={`shrink-0 h-8 px-3.5 rounded-full text-[12px] font-medium transition-colors ${active ? "bg-primary text-primary-foreground shadow-sm shadow-primary/25" : "glass text-muted-foreground"}`}
            >
              {label}
            </button>
          );
        })}
        {presentCategories.length > 0 && <span className="shrink-0 w-px h-5 bg-border/60 mx-0.5" />}
        {presentCategories.map((name) => (
          <button
            key={name}
            onClick={() => toggleCategoryChip(name)}
            className={`shrink-0 h-8 px-3.5 rounded-full text-[12px] font-medium transition-colors ${filterCategory === name ? "bg-primary text-primary-foreground shadow-sm shadow-primary/25" : "glass text-muted-foreground"}`}
          >
            {name}
          </button>
        ))}
      </div>

      {/* Active-filter summary */}
      {(searchQuery || activeFilterCount > 0 || emailFilter) && (
        <div className="flex items-center justify-between px-1">
          <span className="text-[12px] text-muted-foreground">{filteredInvoices.length} תוצאות</span>
          <button onClick={() => { clearFilters(); setEmailFilter(""); setSearchQuery(""); }} className="text-[12px] text-red-500 hover:text-red-600 flex items-center gap-1">
            <X className="h-3.5 w-3.5" /> נקה
          </button>
        </div>
      )}

      {/* Advanced filter — bottom sheet (mobile) / centered card (desktop) */}
      {showFilters && (
        <div className="fixed inset-0 z-[90] flex items-end sm:items-center justify-center" onClick={() => setShowFilters(false)}>
          <div className="absolute inset-0 bg-black/40 backdrop-blur-[2px]" />
          <div
            className="relative w-full sm:max-w-md glass rounded-t-3xl sm:rounded-3xl p-4 max-h-[85vh] overflow-y-auto"
            style={{ paddingBottom: "calc(1.25rem + env(safe-area-inset-bottom))" }}
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-base font-bold flex items-center gap-2"><SlidersHorizontal className="h-4 w-4" /> סינון מתקדם</h3>
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
                  <input type="date" value={dateFrom} onChange={(e) => { setDateFrom(e.target.value); setTimeChip("all"); }} className="w-full h-11 rounded-xl border border-input bg-background px-3 text-[14px]" />
                  <input type="date" value={dateTo} onChange={(e) => { setDateTo(e.target.value); setTimeChip("all"); }} className="w-full h-11 rounded-xl border border-input bg-background px-3 text-[14px]" />
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
              {categories.length > 0 && (
                <div>
                  <label className="text-[12px] font-semibold mb-1.5 block">קטגוריה</label>
                  <select value={filterCategory} onChange={(e) => setFilterCategory(e.target.value)} className="w-full h-11 rounded-xl border border-input bg-background px-3 text-[14px]">
                    <option value="">כל הקטגוריות</option>
                    {categories.map((cat) => <option key={cat.id} value={cat.name}>{cat.name}</option>)}
                  </select>
                </div>
              )}
              {/* Email account */}
              {emailAccounts.length > 0 && (
                <div>
                  <label className="text-[12px] font-semibold mb-1.5 flex items-center gap-1.5"><Mail className="h-3.5 w-3.5" /> חשבון אימייל</label>
                  <select value={emailFilter} onChange={(e) => setEmailFilter(e.target.value)} className="w-full h-11 rounded-xl border border-input bg-background px-3 text-[14px]">
                    <option value="">כל החשבונות</option>
                    {emailAccounts.map((email) => <option key={email} value={email}>{email}</option>)}
                  </select>
                </div>
              )}
            </div>
            <div className="flex gap-2 mt-5">
              <button onClick={() => { clearFilters(); setEmailFilter(""); }} className="flex-1 h-11 rounded-xl glass text-[14px] font-medium text-muted-foreground">נקה הכל</button>
              <button onClick={() => setShowFilters(false)} className="flex-[2] h-11 rounded-xl bg-primary text-primary-foreground text-[14px] font-semibold">הצג {filteredInvoices.length} תוצאות</button>
            </div>
          </div>
        </div>
      )}

      {/* Selection bar — hidden until a long-press starts multi-select */}
      {selectionMode && (
        <div className="sticky top-16 z-30 glass rounded-2xl px-2.5 py-2 flex items-center gap-2 shadow-lg">
          <button onClick={exitSelection} className="w-8 h-8 rounded-full flex items-center justify-center hover:bg-muted shrink-0" aria-label="בטל בחירה"><X className="h-4 w-4" /></button>
          <button onClick={toggleSelectAll} className="w-8 h-8 rounded-lg flex items-center justify-center hover:bg-muted shrink-0" title={allSelected ? "בטל הכל" : "בחר הכל"} aria-label={allSelected ? "בטל הכל" : "בחר הכל"}>
            {allSelected ? <CheckSquare className="h-[18px] w-[18px] text-primary" /> : <Square className="h-[18px] w-[18px]" />}
          </button>
          <span className="text-[12px] text-muted-foreground shrink-0 whitespace-nowrap">{selected.size} נבחרו</span>
          <div className="flex-1" />
          <button onClick={bulkApprove} disabled={bulkAction || selected.size === 0} className="h-8 px-3 rounded-lg bg-emerald-600 text-white text-[12px] font-semibold flex items-center gap-1 disabled:opacity-40 shrink-0">
            {bulkAction ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <CheckCheck className="h-3.5 w-3.5" />} אשר
          </button>
          <button onClick={bulkDelete} disabled={bulkAction || selected.size === 0} className="h-8 w-8 rounded-lg glass text-red-500 flex items-center justify-center disabled:opacity-40 shrink-0" aria-label="מחק">
            {bulkAction ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Trash2 className="h-3.5 w-3.5" />}
          </button>
          <button
            disabled={bulkAction || selected.size === 0}
            aria-label="הורד"
            onClick={async () => {
              setBulkAction(true);
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
                const utf8Match = disposition.match(/filename\*=UTF-8''(.+?)(?:;|$)/);
                const asciiMatch = disposition.match(/filename="(.+?)"/);
                const rawName = utf8Match?.[1] || asciiMatch?.[1] || "invoices.zip";
                a.download = decodeURIComponent(rawName);
                document.body.appendChild(a);
                a.click();
                document.body.removeChild(a);
                URL.revokeObjectURL(url);
              } catch {
                alert("שגיאה בהורדת הקבצים");
              } finally {
                setBulkAction(false);
              }
            }}
            className="h-8 w-8 rounded-lg glass text-muted-foreground flex items-center justify-center disabled:opacity-40 shrink-0"
          >
            {bulkAction ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Download className="h-3.5 w-3.5" />}
          </button>
        </div>
      )}

      {/* Preview modal */}
      {previewId && (() => {
        const previewInv = invoices.find((i) => i.id === previewId);
        const isHtml = previewInv?.fileName.endsWith(".html");
        return (
          <div className="fixed inset-0 z-[100] bg-black/70 flex items-center justify-center p-4" onClick={() => setPreviewId(null)}>
            <div className="bg-white rounded-2xl overflow-hidden max-w-2xl max-h-[85vh] w-full flex flex-col" onClick={(e) => e.stopPropagation()}>
              <div className="flex items-center justify-between p-3 bg-white border-b shrink-0">
                <span className="text-sm font-medium text-gray-700">תצוגה מקדימה</span>
                <button onClick={() => setPreviewId(null)} className="p-1 rounded-lg hover:bg-gray-100"><X className="h-5 w-5 text-gray-500" /></button>
              </div>
              {isHtml ? (
                <iframe
                  src={`/api/invoices/${previewId}/preview`}
                  className="w-full flex-1 min-h-[60vh]"
                  sandbox="allow-same-origin"
                  title="preview"
                />
              ) : (
                <div className="overflow-auto flex-1">
                  <img src={`/api/invoices/${previewId}/preview`} alt="preview" className="w-full" />
                </div>
              )}
            </div>
          </div>
        );
      })()}

      {/* Invoice cards */}
      <div className="grid gap-2">
        {paginatedInvoices.map((inv) => {
          const isEditing = editingId === inv.id;
          const isSelected = selected.has(inv.id);
          const waitTime = getWaitingTime(inv.createdAt);

          return (
            <div
              key={inv.id}
              id={`inv-${inv.id}`}
              onTouchStart={() => { if (!isEditing) startLongPress(inv.id); }}
              onTouchEnd={cancelLongPress}
              onTouchMove={cancelLongPress}
              onContextMenu={(e) => { if (!selectionMode && !isEditing) e.preventDefault(); }}
              className={`glass rounded-2xl overflow-hidden transition-all ${openId === inv.id && !selectionMode ? "ring-2 ring-violet-400/40" : ""} ${selectionMode && isSelected ? "ring-2 ring-emerald-500/70" : ""}`}
            >
              {selectionMode ? (
                /* ===== SELECTABLE ROW (multi-select) ===== */
                <div className="p-3 flex items-center gap-3 cursor-pointer select-none" onClick={() => toggleSelect(inv.id)}>
                  <div className="shrink-0">
                    {isSelected ? <CheckCircle2 className="h-6 w-6 text-emerald-500" /> : <Circle className="h-6 w-6 text-muted-foreground/40" />}
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
                      {inv.date && <span>{new Date(inv.date).toLocaleDateString("he-IL")}</span>}
                      {inv.isBusiness === false && <span className="px-1.5 py-0.5 rounded bg-slate-200 text-slate-700 flex items-center gap-0.5"><Lock className="h-2.5 w-2.5" /> פרטי</span>}
                    </div>
                  </div>
                </div>
              ) : isEditing ? (
                /* ===== EDIT (spacious inline card) ===== */
                <div className="flex flex-col md:flex-row-reverse">
                  <div className="relative md:w-2/5 bg-white border-b md:border-b-0 md:border-r border-border/60 h-44 md:h-auto md:max-h-[560px] overflow-hidden md:overflow-auto flex items-start justify-center shrink-0">
                    {inv.fileName.endsWith(".html") ? (
                      <iframe src={`/api/invoices/${inv.id}/preview`} className="w-full h-44 md:h-[560px] pointer-events-none" sandbox="allow-same-origin" title="preview" />
                    ) : (
                      <img src={`/api/invoices/${inv.id}/preview`} alt="preview" className="w-full h-full md:h-auto object-cover object-top" draggable={false} />
                    )}
                    {/* Tap to open the full preview */}
                    <button type="button" onClick={() => setPreviewId(inv.id)} className="absolute inset-0 flex items-end justify-center pb-1.5" aria-label="הצג מלא">
                      <span className="px-2.5 py-1 rounded-full bg-black/55 text-white text-[10px] font-medium backdrop-blur-sm">הקש להגדלה</span>
                    </button>
                  </div>
                  <div className="md:w-3/5 p-4 sm:p-5 space-y-4">
                    <div className="space-y-3.5">
                      <div>
                        <label className="text-[12px] font-semibold mb-1.5 block">ספק</label>
                        <input type="text" value={editData.vendor || ""} onChange={(e) => setEditData({ ...editData, vendor: e.target.value })} className="w-full h-11 rounded-xl border border-input bg-background px-3.5 text-[15px]" />
                      </div>
                      <div>
                        <label className="text-[12px] font-semibold mb-1.5 block">סכום</label>
                        <div className="flex gap-2">
                          <input type="number" step="0.01" value={editData.amount ?? ""} onChange={(e) => setEditData({ ...editData, amount: e.target.value === "" ? null : parseFloat(e.target.value) })} className="flex-1 min-w-0 h-11 rounded-xl border border-input bg-background px-3.5 text-[17px] font-bold tnum" />
                          <select
                            value={editData.currency || "ILS"}
                            onChange={(e) => setEditData({ ...editData, currency: e.target.value })}
                            className="h-11 w-[64px] shrink-0 rounded-xl border border-input bg-background text-[16px] text-center font-bold"
                          >
                            <option value="ILS">₪</option>
                            <option value="USD">$</option>
                            <option value="EUR">€</option>
                            <option value="GBP">£</option>
                          </select>
                        </div>
                      </div>
                      <div className="grid grid-cols-2 gap-2.5">
                        <div>
                          <label className="text-[12px] font-semibold mb-1.5 block">תאריך</label>
                          <input type="date" value={typeof editData.date === "string" ? editData.date : ""} onChange={(e) => setEditData({ ...editData, date: e.target.value })} className="w-full h-11 rounded-xl border border-input bg-background px-3 text-[14px]" />
                        </div>
                        <div>
                          <label className="text-[12px] font-semibold mb-1.5 block">4 ספרות כרטיס</label>
                          <input type="text" inputMode="numeric" maxLength={4} value={editData.creditCardLast4 || ""} onChange={(e) => setEditData({ ...editData, creditCardLast4: e.target.value.replace(/\D/g, "") })} className="w-full h-11 rounded-xl border border-input bg-background px-3.5 text-[15px]" placeholder="1234" />
                        </div>
                      </div>
                      <div>
                        <label className="text-[12px] font-semibold mb-1.5 block">קטגוריה</label>
                        <div className="flex gap-2">
                          <select value={editData.category?.id || ""} onChange={(e) => { const cat = categories.find((c) => c.id === e.target.value); setEditData({ ...editData, category: cat || null }); }} className="flex-1 h-11 rounded-xl border border-input bg-background px-3 text-[15px]">
                            <option value="">ללא קטגוריה</option>
                            {categories.map((cat) => <option key={cat.id} value={cat.id}>{cat.name}</option>)}
                          </select>
                          <button type="button" onClick={() => setShowNewCategory(!showNewCategory)} className="h-11 w-11 shrink-0 rounded-xl glass flex items-center justify-center"><Plus className="h-4 w-4" /></button>
                        </div>
                        {showNewCategory && (
                          <div className="flex gap-2 mt-2">
                            <input type="text" value={newCategoryName} onChange={(e) => setNewCategoryName(e.target.value)} placeholder="שם קטגוריה חדשה" className="flex-1 h-11 rounded-xl border border-input bg-background px-3.5 text-[15px]" />
                            <button onClick={addCategory} disabled={addingCategory} className="h-11 px-4 rounded-xl bg-primary text-primary-foreground text-[14px] font-medium shrink-0">{addingCategory ? <Loader2 className="h-4 w-4 animate-spin" /> : "הוסף"}</button>
                          </div>
                        )}
                      </div>
                      {/* Business / Private classification */}
                      <div>
                        <label className="text-[12px] font-semibold mb-1.5 block">סיווג</label>
                        <div className="grid grid-cols-2 gap-2">
                          <button
                            type="button"
                            onClick={() => setEditData({ ...editData, isBusiness: true })}
                            className={`h-11 rounded-xl border text-[14px] font-semibold flex items-center justify-center gap-2 transition-colors ${(editData.isBusiness ?? true) ? "bg-emerald-600 text-white border-emerald-600" : "bg-background text-muted-foreground border-input"}`}
                          >
                            <Briefcase className="h-4 w-4" /> עסקי
                          </button>
                          <button
                            type="button"
                            onClick={() => setEditData({ ...editData, isBusiness: false })}
                            className={`h-11 rounded-xl border text-[14px] font-semibold flex items-center justify-center gap-2 transition-colors ${!(editData.isBusiness ?? true) ? "bg-slate-600 text-white border-slate-600" : "bg-background text-muted-foreground border-input"}`}
                          >
                            <Lock className="h-4 w-4" /> פרטי
                          </button>
                        </div>
                        {!(editData.isBusiness ?? true) && (
                          <p className="text-[11px] text-muted-foreground mt-1.5">הוצאה פרטית — לא מתקזזת ולא נשלחת לרו&quot;ח</p>
                        )}
                      </div>
                    </div>
                    {/* Actions */}
                    <div className="space-y-2 pt-1">
                      <button onClick={() => approveFromEdit(inv.id)} disabled={approving === inv.id} className="w-full h-12 rounded-xl text-white text-[15px] font-bold flex items-center justify-center gap-2 disabled:opacity-60" style={{ background: "linear-gradient(135deg,#10b981,#059669)" }}>
                        {approving === inv.id ? <Loader2 className="h-5 w-5 animate-spin" /> : <CheckCircle2 className="h-5 w-5" />} אשר ושמור
                      </button>
                      <div className="flex items-center gap-2">
                        <button onClick={() => saveEdit(inv.id)} className="flex-1 h-10 rounded-xl glass text-[14px] font-medium">שמור בלבד</button>
                        <button onClick={() => setEditingId(null)} className="flex-1 h-10 rounded-xl glass text-[14px] font-medium text-muted-foreground">ביטול</button>
                        <button onClick={() => deleteOne(inv.id)} disabled={deleting === inv.id} className="h-10 w-10 shrink-0 rounded-xl glass text-red-500 flex items-center justify-center" aria-label="מחק">
                          {deleting === inv.id ? <Loader2 className="h-4 w-4 animate-spin" /> : <Trash2 className="h-4 w-4" />}
                        </button>
                      </div>
                    </div>
                  </div>
                </div>
              ) : openId === inv.id ? (
                /* ===== FOCUSED (mockup) — thumbnail + content + אשר/ערוך/פרטי ===== */
                <div className="p-3">
                  <div className="flex items-center gap-3">
                    <button onClick={() => { if (longPressFired.current) return; setPreviewId(inv.id); }} className="shrink-0 w-12 h-12 rounded-xl border border-border/40 overflow-hidden bg-white flex items-center justify-center">
                      {inv.fileName.endsWith(".html") ? <Mail className="h-5 w-5 text-muted-foreground/40" /> : <img src={`/api/invoices/${inv.id}/preview`} alt="" className="w-full h-full object-cover object-top" loading="lazy" />}
                    </button>
                    <button onClick={() => { if (longPressFired.current) return; setOpenId(null); }} className="flex-1 min-w-0 text-start">
                      <div className="flex items-center justify-between gap-2">
                        <span className="font-bold text-[14px] truncate">{inv.vendor || inv.fileName}</span>
                        {inv.amount !== null ? <span className="font-black text-[16px] tnum shrink-0">{formatAmount(inv.amount, inv.currency)}</span> : <span className="text-[11px] text-muted-foreground/50 shrink-0">ללא סכום</span>}
                      </div>
                      <div className="flex flex-wrap items-center gap-1.5 mt-1 text-[10.5px] text-muted-foreground">
                        {inv.category && <span className={`px-2 py-0.5 rounded-full font-medium ${categoryColors[inv.category.name] || categoryColors["אחר"]}`}>{inv.category.name}</span>}
                        {inv.date && <span>{new Date(inv.date).toLocaleDateString("he-IL")}</span>}
                        {inv.creditCardLast4 && <span>· ****{inv.creditCardLast4}</span>}
                        {waitTime && <span className="text-amber-500">{waitTime}</span>}
                      </div>
                    </button>
                  </div>
                  <div className="grid grid-cols-3 gap-2 mt-3">
                    <button onClick={() => approveOne(inv.id)} disabled={approving === inv.id} className="h-9 rounded-xl text-white text-[13px] font-semibold flex items-center justify-center gap-1.5" style={{ background: "linear-gradient(135deg,#10b981,#059669)" }}>
                      {approving === inv.id ? <Loader2 className="h-4 w-4 animate-spin" /> : <CheckCircle2 className="h-4 w-4" />} אשר
                    </button>
                    <button onClick={() => startEdit(inv)} className="h-9 rounded-xl glass text-[13px] font-semibold flex items-center justify-center gap-1.5"><Pencil className="h-3.5 w-3.5" /> ערוך</button>
                    <button onClick={() => markPrivate(inv.id)} disabled={approving === inv.id} className="h-9 rounded-xl bg-muted/70 text-muted-foreground text-[13px] font-semibold flex items-center justify-center gap-1.5"><Lock className="h-3.5 w-3.5" /> פרטי</button>
                  </div>
                </div>
              ) : (
                /* ===== COMPACT (mockup) — thumbnail + content + green approve circle ===== */
                <div className="p-3 flex items-center gap-3">
                  <button onClick={() => { if (longPressFired.current) return; setPreviewId(inv.id); }} className="shrink-0 w-11 h-11 rounded-xl border border-border/40 overflow-hidden bg-white flex items-center justify-center">
                    {inv.fileName.endsWith(".html") ? <Mail className="h-5 w-5 text-muted-foreground/40" /> : <img src={`/api/invoices/${inv.id}/preview`} alt="" className="w-full h-full object-cover object-top" loading="lazy" />}
                  </button>
                  <button onClick={() => { if (longPressFired.current) return; setOpenId(inv.id); }} className="flex-1 min-w-0 text-start">
                    <div className="flex items-center justify-between gap-2">
                      <span className="font-bold text-[14px] truncate">{inv.vendor || inv.fileName}</span>
                      {inv.amount !== null ? <span className="font-black text-[15px] tnum shrink-0">{formatAmount(inv.amount, inv.currency)}</span> : <span className="text-[11px] text-muted-foreground/50 shrink-0">ללא סכום</span>}
                    </div>
                    <div className="flex flex-wrap items-center gap-1.5 mt-1 text-[10.5px] text-muted-foreground">
                      {inv.category && <span className={`px-2 py-0.5 rounded-full font-medium ${categoryColors[inv.category.name] || categoryColors["אחר"]}`}>{inv.category.name}</span>}
                      {inv.date && <span>{new Date(inv.date).toLocaleDateString("he-IL")}</span>}
                      {inv.isBusiness === false && <span className="px-1.5 py-0.5 rounded bg-slate-200 text-slate-700 flex items-center gap-0.5"><Lock className="h-2.5 w-2.5" /> פרטי</span>}
                      {waitTime && <span className="text-amber-500">{waitTime}</span>}
                    </div>
                  </button>
                  <button onClick={() => { if (longPressFired.current) return; approveOne(inv.id); }} disabled={approving === inv.id} aria-label="אשר" className="shrink-0 w-10 h-10 rounded-2xl text-white flex items-center justify-center shadow-md shadow-emerald-500/25 active:scale-95 transition-transform" style={{ background: "linear-gradient(135deg,#34d399,#059669)" }}>
                    {approving === inv.id ? <Loader2 className="h-4 w-4 animate-spin" /> : <Check className="h-5 w-5" strokeWidth={3} />}
                  </button>
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* Pagination */}
      {filteredInvoices.length > 0 && (
        <div className="flex items-center justify-between gap-2 pt-2 pb-4 flex-wrap">
          <div className="flex items-center gap-2">
            <select
              value={pageSize}
              onChange={(e) => setPageSize(Number(e.target.value))}
              className="h-8 px-2 rounded-lg text-[11px] bg-muted/50 text-muted-foreground border-none cursor-pointer"
            >
              {[5, 10, 20, 50, 100].map((n) => (
                <option key={n} value={n}>{n} בעמוד</option>
              ))}
            </select>
            <span className="text-[11px] text-muted-foreground">
              {(safePage - 1) * pageSize + 1}-{Math.min(safePage * pageSize, filteredInvoices.length)} מתוך {filteredInvoices.length}
            </span>
          </div>
          <div className="flex items-center gap-1">
            <button
              onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
              disabled={safePage <= 1}
              className="h-8 w-8 rounded-lg flex items-center justify-center text-muted-foreground hover:bg-muted disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
            >
              <ChevronRight className="h-4 w-4" />
            </button>
            {Array.from({ length: totalPages }, (_, i) => i + 1)
              .filter((p) => p === 1 || p === totalPages || Math.abs(p - safePage) <= 1)
              .reduce<(number | "...")[]>((acc, p, i, arr) => {
                if (i > 0 && p - (arr[i - 1]) > 1) acc.push("...");
                acc.push(p);
                return acc;
              }, [])
              .map((p, i) =>
                p === "..." ? (
                  <span key={`dot-${i}`} className="text-[11px] text-muted-foreground px-1">...</span>
                ) : (
                  <button
                    key={p}
                    onClick={() => setCurrentPage(p)}
                    className={`h-8 min-w-[32px] px-1.5 rounded-lg text-[12px] font-medium transition-colors ${
                      p === safePage
                        ? "bg-primary text-primary-foreground"
                        : "text-muted-foreground hover:bg-muted"
                    }`}
                  >
                    {p}
                  </button>
                )
              )}
            <button
              onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
              disabled={safePage >= totalPages}
              className="h-8 w-8 rounded-lg flex items-center justify-center text-muted-foreground hover:bg-muted disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
            >
              <ChevronLeft className="h-4 w-4" />
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
