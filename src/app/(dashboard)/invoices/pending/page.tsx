"use client";
import { categoryColors } from "@/lib/category-colors";

import { useState, useEffect, useCallback, useMemo } from "react";
import {
  CheckCircle2,
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
  Search,
  ArrowUpDown,
  Clock,
  Receipt,
  Mail,
  TrendingDown,
  ChevronLeft,
  ChevronRight,
  Filter,
  Briefcase,
  Lock,
} from "lucide-react";
import { Button } from "@/components/ui/button";

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
  const [previewId, setPreviewId] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [sortKey, setSortKey] = useState<SortKey>("created");
  const [sortAsc, setSortAsc] = useState(false);
  const [emailFilter, setEmailFilter] = useState<string>("");
  const [pageSize, setPageSize] = useState(20);
  const [currentPage, setCurrentPage] = useState(1);
  const [focusHandled, setFocusHandled] = useState(false);
  const [openId, setOpenId] = useState<string | null>(null); // expanded card showing אשר/ערוך/פרטי

  // range filters (collapsible panel)
  const [showFilters, setShowFilters] = useState(false);
  const [filterCategory, setFilterCategory] = useState("");
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const [amountMin, setAmountMin] = useState("");
  const [amountMax, setAmountMax] = useState("");
  const [amountCurrency, setAmountCurrency] = useState("");

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
  const clearFilters = () => { setFilterCategory(""); setDateFrom(""); setDateTo(""); setAmountMin(""); setAmountMax(""); setAmountCurrency(""); };

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
      <div>
        <h2 className="text-lg sm:text-xl font-bold">ממתינות לאישור</h2>
        <p className="text-xs sm:text-sm text-muted-foreground">{invoices.length} חשבוניות ממתינות</p>
      </div>

      {/* 1. Statistics strip */}
      <div className="grid grid-cols-3 gap-2">
        <div className="rounded-xl glass p-2.5 sm:p-3 text-center">
          <div className="flex items-center justify-center gap-1.5 text-muted-foreground mb-0.5">
            <Receipt className="h-3.5 w-3.5" />
            <span className="text-[10px] sm:text-xs">סה&quot;כ ממתין</span>
          </div>
          <div className="text-sm sm:text-base font-bold space-y-0.5">
            {Object.entries(stats.byCurrency).map(([cur, total]) => (
              <div key={cur}>{currencySymbol(cur)}{total.toLocaleString("he-IL", { maximumFractionDigits: 0 })}</div>
            ))}
            {Object.keys(stats.byCurrency).length === 0 && <div>₪0</div>}
          </div>
        </div>
        <div className="rounded-xl glass p-2.5 sm:p-3 text-center">
          <div className="flex items-center justify-center gap-1.5 text-muted-foreground mb-0.5">
            <Clock className="h-3.5 w-3.5" />
            <span className="text-[10px] sm:text-xs">חשבוניות</span>
          </div>
          <p className="text-sm sm:text-lg font-bold">{stats.count}</p>
        </div>
        <div className="rounded-xl glass p-2.5 sm:p-3 text-center">
          <div className="flex items-center justify-center gap-1.5 text-muted-foreground mb-0.5">
            <TrendingDown className="h-3.5 w-3.5" />
            <span className="text-[10px] sm:text-xs">ממוצע</span>
          </div>
          <p className="text-sm sm:text-lg font-bold">₪{stats.avg.toLocaleString("he-IL", { maximumFractionDigits: 0 })}</p>
        </div>
      </div>

      {/* 2. Search + Sort */}
      <div className="flex items-center gap-2">
        <div className="relative flex-1">
          <Search className="absolute right-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
          <input
            type="text"
            placeholder="חיפוש לפי ספק, קובץ או קטגוריה..."
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

      {/* Collapsible filter panel: account, category, date range, amount range + currency */}
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
            {categories.length > 0 && (
              <div>
                <label className="text-[11px] font-medium text-muted-foreground mb-1 block">קטגוריה</label>
                <select value={filterCategory} onChange={(e) => setFilterCategory(e.target.value)} className="w-full h-9 rounded-lg border border-input bg-background px-2 text-[13px]">
                  <option value="">כל הקטגוריות</option>
                  {categories.map((cat) => <option key={cat.id} value={cat.name}>{cat.name}</option>)}
                </select>
              </div>
            )}
            {/* Email account */}
            {emailAccounts.length > 0 && (
              <div>
                <label className="text-[11px] font-medium text-muted-foreground mb-1 flex items-center gap-1"><Mail className="h-3 w-3" /> חשבון אימייל</label>
                <select value={emailFilter} onChange={(e) => setEmailFilter(e.target.value)} className="w-full h-9 rounded-lg border border-input bg-background px-2 text-[13px]">
                  <option value="">כל החשבונות</option>
                  {emailAccounts.map((email) => <option key={email} value={email}>{email}</option>)}
                </select>
              </div>
            )}
          </div>
          <div className="flex items-center justify-between">
            <span className="text-[11px] text-muted-foreground">{filteredInvoices.length} תוצאות</span>
            {(activeFilterCount > 0 || emailFilter) && (
              <button onClick={() => { clearFilters(); setEmailFilter(""); }} className="text-[11px] text-red-500 hover:text-red-700 flex items-center gap-1">
                <X className="h-3 w-3" /> נקה סינון
              </button>
            )}
          </div>
        </div>
      )}

      {/* 3. Sticky bulk action bar */}
      <div className="sticky top-16 z-30 bg-background/90 backdrop-blur-sm py-1.5 -mx-2 px-2 sm:-mx-4 sm:px-4 flex items-center gap-2 flex-wrap">
        <Button variant="outline" size="sm" onClick={toggleSelectAll} className="gap-1.5 h-7 text-[11px]">
          {allSelected ? <CheckSquare className="h-3.5 w-3.5" /> : <Square className="h-3.5 w-3.5" />}
          {allSelected ? "בטל" : "בחר הכל"}
        </Button>
        {selected.size > 0 && (
          <>
            <span className="text-[11px] text-muted-foreground">{selected.size} נבחרו</span>
            <Button size="sm" onClick={bulkApprove} disabled={bulkAction} className="gap-1 bg-emerald-600 hover:bg-emerald-700 h-7 text-[11px]">
              {bulkAction ? <Loader2 className="h-3 w-3 animate-spin" /> : <CheckCheck className="h-3 w-3" />}
              אשר
            </Button>
            <Button variant="outline" size="sm" onClick={bulkDelete} disabled={bulkAction} className="gap-1 text-red-600 border-red-200 hover:bg-red-50 h-7 text-[11px]">
              {bulkAction ? <Loader2 className="h-3 w-3 animate-spin" /> : <Trash2 className="h-3 w-3" />}
              מחק
            </Button>
            <Button variant="outline" size="sm" disabled={bulkAction} onClick={async () => {
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
            }} className="gap-1 h-7 text-[11px]">
              {bulkAction ? <Loader2 className="h-3 w-3 animate-spin" /> : <Download className="h-3 w-3" />}
              הורד הכל
            </Button>
          </>
        )}
        {searchQuery && (
          <span className="text-[11px] text-muted-foreground mr-auto">{filteredInvoices.length} תוצאות</span>
        )}
      </div>

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
          const waitTime = getWaitingTime(inv.createdAt);

          return (
            <div
              key={inv.id}
              id={`inv-${inv.id}`}
              className={`glass rounded-2xl overflow-hidden transition-all ${openId === inv.id ? "ring-2 ring-violet-400/40" : ""}`}
            >
              {isEditing ? (
                /* ===== EDIT MODE ===== */
                <div className="flex flex-col md:flex-row-reverse">
                  <div className="md:w-1/2 bg-white border-b md:border-b-0 md:border-r border-border overflow-auto max-h-[500px]">
                    {inv.fileName.endsWith(".html") ? (
                      <iframe src={`/api/invoices/${inv.id}/preview`} className="w-full h-[400px]" sandbox="allow-same-origin" title="preview" />
                    ) : (
                      <img src={`/api/invoices/${inv.id}/preview`} alt="preview" className="w-full" draggable={false} />
                    )}
                  </div>
                  <div className="md:w-1/2 p-3 sm:p-4 space-y-3">
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                      <div>
                        <label className="text-[11px] font-medium text-muted-foreground mb-0.5 block">ספק</label>
                        <input type="text" value={editData.vendor || ""} onChange={(e) => setEditData({ ...editData, vendor: e.target.value })} className="w-full h-9 rounded-lg border border-input bg-background px-2.5 text-[16px] sm:text-sm" />
                      </div>
                      <div className="sm:col-span-2">
                        <label className="text-[11px] font-medium text-muted-foreground mb-0.5 block">סכום</label>
                        <div className="flex gap-1.5">
                          <input type="number" step="0.01" value={editData.amount || ""} onChange={(e) => setEditData({ ...editData, amount: parseFloat(e.target.value) || null })} className="flex-1 min-w-0 h-9 rounded-lg border border-input bg-background px-2.5 text-[16px] sm:text-sm" />
                          <select
                            value={editData.currency || "ILS"}
                            onChange={(e) => setEditData({ ...editData, currency: e.target.value })}
                            className="h-9 w-[60px] shrink-0 rounded-lg border border-input bg-background text-[16px] sm:text-sm text-center font-medium"
                          >
                            <option value="ILS">₪</option>
                            <option value="USD">$</option>
                            <option value="EUR">€</option>
                            <option value="GBP">£</option>
                          </select>
                        </div>
                      </div>
                      <div>
                        <label className="text-[11px] font-medium text-muted-foreground mb-0.5 block">תאריך</label>
                        <input type="date" value={typeof editData.date === "string" ? editData.date : ""} onChange={(e) => setEditData({ ...editData, date: e.target.value })} className="w-full h-9 rounded-lg border border-input bg-background px-2.5 text-[16px] sm:text-sm" />
                      </div>
                      <div>
                        <label className="text-[11px] font-medium text-muted-foreground mb-0.5 block">4 ספרות כרטיס</label>
                        <input type="text" maxLength={4} value={editData.creditCardLast4 || ""} onChange={(e) => setEditData({ ...editData, creditCardLast4: e.target.value.replace(/\D/g, "") })} className="w-full h-9 rounded-lg border border-input bg-background px-2.5 text-[16px] sm:text-sm" placeholder="1234" />
                      </div>
                      <div className="sm:col-span-2">
                        <label className="text-[11px] font-medium text-muted-foreground mb-0.5 block">קטגוריה</label>
                        <div className="flex gap-1.5">
                          <select value={editData.category?.id || ""} onChange={(e) => { const cat = categories.find((c) => c.id === e.target.value); setEditData({ ...editData, category: cat || null }); }} className="flex-1 h-9 rounded-lg border border-input bg-background px-2.5 text-[16px] sm:text-sm">
                            <option value="">ללא קטגוריה</option>
                            {categories.map((cat) => <option key={cat.id} value={cat.id}>{cat.name}</option>)}
                          </select>
                          <Button variant="outline" size="sm" onClick={() => setShowNewCategory(!showNewCategory)} className="h-8 w-8 p-0 shrink-0"><Plus className="h-3.5 w-3.5" /></Button>
                        </div>
                        {showNewCategory && (
                          <div className="flex gap-1.5 mt-1.5">
                            <input type="text" value={newCategoryName} onChange={(e) => setNewCategoryName(e.target.value)} placeholder="שם קטגוריה חדשה" className="flex-1 h-9 rounded-lg border border-input bg-background px-2.5 text-[16px] sm:text-sm" />
                            <Button size="sm" className="h-8" onClick={addCategory} disabled={addingCategory}>{addingCategory ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : "הוסף"}</Button>
                          </div>
                        )}
                      </div>
                      {/* Business / Private classification */}
                      <div className="sm:col-span-2">
                        <label className="text-[11px] font-medium text-muted-foreground mb-0.5 block">סיווג</label>
                        <div className="grid grid-cols-2 gap-1.5">
                          <button
                            type="button"
                            onClick={() => setEditData({ ...editData, isBusiness: true })}
                            className={`h-9 rounded-lg border text-[13px] font-medium flex items-center justify-center gap-1.5 transition-colors ${(editData.isBusiness ?? true) ? "bg-emerald-600 text-white border-emerald-600" : "bg-background text-muted-foreground border-input hover:bg-muted"}`}
                          >
                            <Briefcase className="h-3.5 w-3.5" /> עסקי
                          </button>
                          <button
                            type="button"
                            onClick={() => setEditData({ ...editData, isBusiness: false })}
                            className={`h-9 rounded-lg border text-[13px] font-medium flex items-center justify-center gap-1.5 transition-colors ${!(editData.isBusiness ?? true) ? "bg-slate-600 text-white border-slate-600" : "bg-background text-muted-foreground border-input hover:bg-muted"}`}
                          >
                            <Lock className="h-3.5 w-3.5" /> פרטי
                          </button>
                        </div>
                        {!(editData.isBusiness ?? true) && (
                          <p className="text-[10px] text-muted-foreground mt-1">הוצאה פרטית — לא מתקזזת ולא נשלחת לרו&quot;ח</p>
                        )}
                      </div>
                    </div>
                    <div className="flex items-center gap-2 pt-1 border-t border-border/50">
                      <Button size="sm" className="gap-1 h-8 text-xs bg-emerald-600 hover:bg-emerald-700 text-white" onClick={() => approveFromEdit(inv.id)} disabled={approving === inv.id}>
                        {approving === inv.id ? <Loader2 className="h-3 w-3 animate-spin" /> : <CheckCircle2 className="h-3 w-3" />} אשר
                      </Button>
                      <Button variant="outline" size="sm" className="gap-1 h-8 text-xs" onClick={() => saveEdit(inv.id)}>שמור</Button>
                      <Button variant="ghost" size="sm" className="h-8 text-xs" onClick={() => setEditingId(null)}><X className="h-3 w-3 ml-0.5" /> ביטול</Button>
                      <div className="flex-1" />
                      <Button variant="ghost" size="sm" className="h-8 text-xs text-red-500 hover:text-red-700 hover:bg-red-50 gap-1" onClick={() => deleteOne(inv.id)} disabled={deleting === inv.id}>
                        {deleting === inv.id ? <Loader2 className="h-3 w-3 animate-spin" /> : <Trash2 className="h-3 w-3" />} מחק
                      </Button>
                    </div>
                  </div>
                </div>
              ) : openId === inv.id ? (
                /* ===== FOCUSED (mockup) — thumbnail + content + אשר/ערוך/פרטי ===== */
                <div className="p-3">
                  <div className="flex items-center gap-3">
                    <button onClick={() => setPreviewId(inv.id)} className="shrink-0 w-12 h-12 rounded-xl border border-border/40 overflow-hidden bg-white flex items-center justify-center">
                      {inv.fileName.endsWith(".html") ? <Mail className="h-5 w-5 text-muted-foreground/40" /> : <img src={`/api/invoices/${inv.id}/preview`} alt="" className="w-full h-full object-cover object-top" loading="lazy" />}
                    </button>
                    <button onClick={() => setOpenId(null)} className="flex-1 min-w-0 text-start">
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
                  <button onClick={() => setPreviewId(inv.id)} className="shrink-0 w-11 h-11 rounded-xl border border-border/40 overflow-hidden bg-white flex items-center justify-center">
                    {inv.fileName.endsWith(".html") ? <Mail className="h-5 w-5 text-muted-foreground/40" /> : <img src={`/api/invoices/${inv.id}/preview`} alt="" className="w-full h-full object-cover object-top" loading="lazy" />}
                  </button>
                  <button onClick={() => setOpenId(inv.id)} className="flex-1 min-w-0 text-start">
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
                  <button onClick={() => approveOne(inv.id)} disabled={approving === inv.id} aria-label="אשר" className="shrink-0 w-9 h-9 rounded-xl text-white flex items-center justify-center" style={{ background: "linear-gradient(135deg,#10b981,#059669)" }}>
                    {approving === inv.id ? <Loader2 className="h-4 w-4 animate-spin" /> : <CheckCircle2 className="h-[18px] w-[18px]" strokeWidth={2.6} />}
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
