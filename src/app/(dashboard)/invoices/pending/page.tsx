"use client";
import { categoryColors } from "@/lib/category-colors";

import { useState, useEffect, useCallback, useMemo } from "react";
import {
  CheckCircle2,
  Download,
  CreditCard,
  Calendar,
  Loader2,
  CheckCheck,
  Pencil,
  X,
  Plus,
  Trash2,
  Square,
  CheckSquare,
  Eye,
  Search,
  ArrowUpDown,
  Clock,
  Receipt,
  TrendingDown,
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
  date: string | null;
  status: string;
  creditCardLast4: string | null;
  category: Category | null;
  createdAt?: string;
}

type SortKey = "date" | "amount" | "vendor" | "created";

export default function PendingInvoicesPage() {
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [loading, setLoading] = useState(true);
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

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const [invRes, catRes] = await Promise.all([
        fetch("/api/invoices?status=pending"),
        fetch("/api/categories"),
      ]);
      const invData = await invRes.json();
      const catData = await catRes.json();
      setInvoices(invData.invoices || []);
      setCategories(catData.categories || []);
    } catch { setInvoices([]); }
    finally { setLoading(false); setSelected(new Set()); }
  }, []);

  useEffect(() => { fetchData(); }, [fetchData]);

  // Filtered + sorted invoices
  const filteredInvoices = useMemo(() => {
    let list = invoices;
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
  }, [invoices, searchQuery, sortKey, sortAsc]);

  // Stats
  const stats = useMemo(() => {
    const withAmount = invoices.filter((i) => i.amount !== null);
    const totalAmount = withAmount.reduce((sum, i) => sum + (i.amount || 0), 0);
    const avg = withAmount.length > 0 ? totalAmount / withAmount.length : 0;
    return { count: invoices.length, totalAmount, avg, withAmount: withAmount.length, noAmount: invoices.length - withAmount.length };
  }, [invoices]);

  const toggleSelect = (id: string) => {
    setSelected((prev) => { const next = new Set(prev); if (next.has(id)) next.delete(id); else next.add(id); return next; });
  };
  const toggleSelectAll = () => {
    setSelected(selected.size === filteredInvoices.length ? new Set() : new Set(filteredInvoices.map((i) => i.id)));
  };
  const startEdit = (inv: Invoice) => {
    setEditingId(inv.id);
    setEditData({ vendor: inv.vendor, amount: inv.amount, date: inv.date ? inv.date.split("T")[0] : "", creditCardLast4: inv.creditCardLast4, category: inv.category });
  };
  const saveEdit = async (id: string) => {
    await fetch(`/api/invoices/${id}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ vendor: editData.vendor, amount: editData.amount, date: editData.date || null, categoryId: editData.category?.id || null, creditCardLast4: editData.creditCardLast4 || null }) });
    setEditingId(null); fetchData();
  };
  const approveOne = async (id: string) => { setApproving(id); await fetch(`/api/invoices/${id}/approve`, { method: "POST" }); setApproving(null); fetchData(); };
  const deleteOne = async (id: string) => { setDeleting(id); await fetch(`/api/invoices/${id}`, { method: "DELETE" }); setDeleting(null); setEditingId(null); fetchData(); };
  const bulkApprove = async () => { if (selected.size === 0) return; setBulkAction(true); await fetch("/api/invoices/bulk", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action: "approve", ids: [...selected] }) }); setBulkAction(false); fetchData(); };
  const bulkDelete = async () => { if (selected.size === 0) return; setBulkAction(true); await fetch("/api/invoices/bulk", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action: "delete", ids: [...selected] }) }); setBulkAction(false); fetchData(); };
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

  const getCatBorder = (name: string) => {
    const colors: Record<string, string> = {
      דלק: "border-l-orange-500", סופר: "border-l-green-500", מסעדות: "border-l-red-500",
      תחבורה: "border-l-blue-500", ביטוח: "border-l-violet-500", תקשורת: "border-l-cyan-500",
      "חשמל ומים": "border-l-yellow-500", שכירות: "border-l-pink-500", "ציוד משרדי": "border-l-slate-500",
      "שיווק ופרסום": "border-l-rose-500", מיסים: "border-l-purple-500", תוכנה: "border-l-sky-500",
    };
    return colors[name] || "border-l-gray-400";
  };

  const handleSort = (key: SortKey) => {
    if (sortKey === key) setSortAsc(!sortAsc);
    else { setSortKey(key); setSortAsc(false); }
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

  const allSelected = selected.size === filteredInvoices.length && filteredInvoices.length > 0;

  return (
    <div data-tour="pending-list" className="space-y-3 max-w-5xl mx-auto">
      {/* Header */}
      <div>
        <h2 className="text-lg sm:text-xl font-bold">ממתינות לאישור</h2>
        <p className="text-xs sm:text-sm text-muted-foreground">{invoices.length} חשבוניות ממתינות</p>
      </div>

      {/* 1. Statistics strip */}
      <div className="grid grid-cols-3 gap-2">
        <div className="rounded-xl bg-card border border-border/60 p-2.5 sm:p-3 text-center">
          <div className="flex items-center justify-center gap-1.5 text-muted-foreground mb-0.5">
            <Receipt className="h-3.5 w-3.5" />
            <span className="text-[10px] sm:text-xs">סה&quot;כ ממתין</span>
          </div>
          <p className="text-sm sm:text-lg font-bold">₪{stats.totalAmount.toLocaleString("he-IL", { maximumFractionDigits: 0 })}</p>
        </div>
        <div className="rounded-xl bg-card border border-border/60 p-2.5 sm:p-3 text-center">
          <div className="flex items-center justify-center gap-1.5 text-muted-foreground mb-0.5">
            <Clock className="h-3.5 w-3.5" />
            <span className="text-[10px] sm:text-xs">חשבוניות</span>
          </div>
          <p className="text-sm sm:text-lg font-bold">{stats.count}</p>
        </div>
        <div className="rounded-xl bg-card border border-border/60 p-2.5 sm:p-3 text-center">
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
            className="w-full h-8 rounded-lg border border-input bg-background pr-8 pl-3 text-xs"
          />
        </div>
        <div className="flex gap-1">
          {([
            ["created", "חדש"],
            ["amount", "סכום"],
            ["date", "תאריך"],
            ["vendor", "ספק"],
          ] as [SortKey, string][]).map(([key, label]) => (
            <button
              key={key}
              onClick={() => handleSort(key)}
              className={`h-8 px-2 rounded-lg text-[11px] transition-colors ${
                sortKey === key
                  ? "bg-primary text-primary-foreground"
                  : "bg-muted/50 text-muted-foreground hover:bg-muted"
              }`}
            >
              {label}
              {sortKey === key && <span className="mr-0.5">{sortAsc ? "↑" : "↓"}</span>}
            </button>
          ))}
        </div>
      </div>

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
          </>
        )}
        {searchQuery && (
          <span className="text-[11px] text-muted-foreground mr-auto">{filteredInvoices.length} תוצאות</span>
        )}
      </div>

      {/* Preview modal */}
      {previewId && (
        <div className="fixed inset-0 z-[100] bg-black/70 flex items-center justify-center p-4" onClick={() => setPreviewId(null)}>
          <div className="bg-white rounded-2xl overflow-auto max-w-2xl max-h-[85vh] w-full" onClick={(e) => e.stopPropagation()}>
            <div className="sticky top-0 z-10 flex items-center justify-between p-3 bg-white border-b">
              <span className="text-sm font-medium text-gray-700">תצוגה מקדימה</span>
              <button onClick={() => setPreviewId(null)} className="p-1 rounded-lg hover:bg-gray-100"><X className="h-5 w-5 text-gray-500" /></button>
            </div>
            <img src={`/api/invoices/${previewId}/preview`} alt="preview" className="w-full" />
          </div>
        </div>
      )}

      {/* Invoice cards */}
      <div className="grid gap-2">
        {filteredInvoices.map((inv) => {
          const isEditing = editingId === inv.id;
          const isSelected = selected.has(inv.id);
          const catBorder = inv.category ? getCatBorder(inv.category.name) : "border-l-amber-400";
          const waitTime = getWaitingTime(inv.createdAt);

          return (
            <div
              key={inv.id}
              className={`rounded-xl bg-card border border-border/60 shadow-sm transition-all overflow-hidden ${isSelected ? "ring-2 ring-primary/30 bg-primary/5" : ""}`}
            >
              {isEditing ? (
                /* ===== EDIT MODE ===== */
                <div className="flex flex-col md:flex-row-reverse">
                  <div className="md:w-1/2 bg-white border-b md:border-b-0 md:border-r border-border overflow-auto max-h-[500px]">
                    <img src={`/api/invoices/${inv.id}/preview`} alt="preview" className="w-full" draggable={false} />
                  </div>
                  <div className="md:w-1/2 p-4 space-y-3">
                    <div className="grid grid-cols-2 gap-2.5">
                      <div>
                        <label className="text-[11px] font-medium text-muted-foreground mb-0.5 block">ספק</label>
                        <input type="text" value={editData.vendor || ""} onChange={(e) => setEditData({ ...editData, vendor: e.target.value })} className="w-full h-8 rounded-lg border border-input bg-background px-2.5 text-sm" />
                      </div>
                      <div>
                        <label className="text-[11px] font-medium text-muted-foreground mb-0.5 block">סכום (₪)</label>
                        <input type="number" step="0.01" value={editData.amount || ""} onChange={(e) => setEditData({ ...editData, amount: parseFloat(e.target.value) || null })} className="w-full h-8 rounded-lg border border-input bg-background px-2.5 text-sm" />
                      </div>
                      <div>
                        <label className="text-[11px] font-medium text-muted-foreground mb-0.5 block">תאריך</label>
                        <input type="date" value={typeof editData.date === "string" ? editData.date : ""} onChange={(e) => setEditData({ ...editData, date: e.target.value })} className="w-full h-8 rounded-lg border border-input bg-background px-2.5 text-sm" />
                      </div>
                      <div>
                        <label className="text-[11px] font-medium text-muted-foreground mb-0.5 block">4 ספרות כרטיס</label>
                        <input type="text" maxLength={4} value={editData.creditCardLast4 || ""} onChange={(e) => setEditData({ ...editData, creditCardLast4: e.target.value.replace(/\D/g, "") })} className="w-full h-8 rounded-lg border border-input bg-background px-2.5 text-sm" placeholder="1234" />
                      </div>
                      <div className="col-span-2">
                        <label className="text-[11px] font-medium text-muted-foreground mb-0.5 block">קטגוריה</label>
                        <div className="flex gap-1.5">
                          <select value={editData.category?.id || ""} onChange={(e) => { const cat = categories.find((c) => c.id === e.target.value); setEditData({ ...editData, category: cat || null }); }} className="flex-1 h-8 rounded-lg border border-input bg-background px-2.5 text-sm">
                            <option value="">ללא קטגוריה</option>
                            {categories.map((cat) => <option key={cat.id} value={cat.id}>{cat.name}</option>)}
                          </select>
                          <Button variant="outline" size="sm" onClick={() => setShowNewCategory(!showNewCategory)} className="h-8 w-8 p-0 shrink-0"><Plus className="h-3.5 w-3.5" /></Button>
                        </div>
                        {showNewCategory && (
                          <div className="flex gap-1.5 mt-1.5">
                            <input type="text" value={newCategoryName} onChange={(e) => setNewCategoryName(e.target.value)} placeholder="שם קטגוריה חדשה" className="flex-1 h-8 rounded-lg border border-input bg-background px-2.5 text-sm" />
                            <Button size="sm" className="h-8" onClick={addCategory} disabled={addingCategory}>{addingCategory ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : "הוסף"}</Button>
                          </div>
                        )}
                      </div>
                    </div>
                    <div className="flex items-center gap-2 pt-1 border-t border-border/50">
                      <Button size="sm" className="gap-1 h-8 text-xs" onClick={() => saveEdit(inv.id)}><CheckCircle2 className="h-3 w-3" /> שמור</Button>
                      <Button variant="ghost" size="sm" className="h-8 text-xs" onClick={() => setEditingId(null)}><X className="h-3 w-3 ml-0.5" /> ביטול</Button>
                      <div className="flex-1" />
                      <Button variant="ghost" size="sm" className="h-8 text-xs text-red-500 hover:text-red-700 hover:bg-red-50 gap-1" onClick={() => deleteOne(inv.id)} disabled={deleting === inv.id}>
                        {deleting === inv.id ? <Loader2 className="h-3 w-3 animate-spin" /> : <Trash2 className="h-3 w-3" />} מחק
                      </Button>
                    </div>
                  </div>
                </div>
              ) : (
                /* ===== VIEW MODE ===== */
                <div className={`border-l-[3px] ${catBorder}`}>
                  <div className="p-2.5 sm:p-3 flex items-center gap-2 sm:gap-3">
                    {/* Checkbox */}
                    <button onClick={() => toggleSelect(inv.id)} className="shrink-0 text-muted-foreground hover:text-foreground">
                      {isSelected ? <CheckSquare className="h-[18px] w-[18px] text-primary" /> : <Square className="h-[18px] w-[18px]" />}
                    </button>

                    {/* 4. Thumbnail */}
                    <button onClick={() => setPreviewId(inv.id)} className="shrink-0 w-10 h-10 sm:w-12 sm:h-12 rounded-lg border border-border overflow-hidden bg-white hover:ring-2 hover:ring-primary/30 transition-all">
                      <img src={`/api/invoices/${inv.id}/preview`} alt="" className="w-full h-full object-cover object-top" loading="lazy" />
                    </button>

                    {/* Content */}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between gap-2">
                        <span className="font-semibold text-[13px] sm:text-sm truncate">{inv.vendor || inv.fileName}</span>
                        {inv.amount !== null ? (
                          <span className="font-bold text-sm sm:text-base shrink-0">₪{inv.amount.toLocaleString("he-IL")}</span>
                        ) : (
                          <span className="text-[11px] text-muted-foreground/50 shrink-0">ללא סכום</span>
                        )}
                      </div>
                      <div className="flex flex-wrap items-center gap-x-2 gap-y-0.5 mt-0.5 text-[11px] text-muted-foreground">
                        {inv.date && (
                          <span className="flex items-center gap-0.5">
                            <Calendar className="h-2.5 w-2.5" />
                            {new Date(inv.date).toLocaleDateString("he-IL")}
                          </span>
                        )}
                        {inv.category && (
                          <span className={`px-1.5 py-0.5 rounded text-[10px] font-medium ${categoryColors[inv.category.name] || categoryColors["אחר"]}`}>
                            {inv.category.name}
                          </span>
                        )}
                        {inv.creditCardLast4 && (
                          <span className="flex items-center gap-0.5">
                            <CreditCard className="h-2.5 w-2.5" />
                            ****{inv.creditCardLast4}
                          </span>
                        )}
                        {/* 5. Waiting indicator */}
                        {waitTime && (
                          <span className="flex items-center gap-0.5 text-amber-500">
                            <Clock className="h-2.5 w-2.5" />
                            {waitTime}
                          </span>
                        )}
                      </div>
                    </div>

                    {/* Quick approve */}
                    <Button
                      size="sm"
                      className="gap-1 bg-emerald-600 hover:bg-emerald-700 text-white h-8 text-[11px] px-2 shrink-0"
                      onClick={() => approveOne(inv.id)}
                      disabled={approving === inv.id}
                    >
                      {approving === inv.id ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <CheckCircle2 className="h-3.5 w-3.5" />}
                      <span className="hidden sm:inline">אשר</span>
                    </Button>
                  </div>

                  {/* Action bar */}
                  <div className="flex items-center gap-0.5 sm:gap-1 px-2.5 sm:px-3 pb-2 pt-0 pr-[52px] sm:pr-[64px]">
                    <button onClick={() => setPreviewId(inv.id)} className="flex items-center gap-1 text-[11px] text-muted-foreground hover:text-foreground px-1.5 py-0.5 rounded hover:bg-muted transition-colors">
                      <Eye className="h-3 w-3" /> <span className="hidden sm:inline">תצוגה</span>
                    </button>
                    <button onClick={() => startEdit(inv)} className="flex items-center gap-1 text-[11px] text-muted-foreground hover:text-foreground px-1.5 py-0.5 rounded hover:bg-muted transition-colors">
                      <Pencil className="h-3 w-3" /> <span className="hidden sm:inline">עריכה</span>
                    </button>
                    <button onClick={() => window.open(`/api/invoices/${inv.id}/download`, "_blank")} className="flex items-center gap-1 text-[11px] text-muted-foreground hover:text-foreground px-1.5 py-0.5 rounded hover:bg-muted transition-colors">
                      <Download className="h-3 w-3" /> <span className="hidden sm:inline">הורדה</span>
                    </button>
                    <div className="flex-1" />
                    <button onClick={() => deleteOne(inv.id)} disabled={deleting === inv.id} className="flex items-center gap-1 text-[11px] text-red-400 hover:text-red-600 px-1.5 py-0.5 rounded hover:bg-red-50 transition-colors">
                      {deleting === inv.id ? <Loader2 className="h-3 w-3 animate-spin" /> : <Trash2 className="h-3 w-3" />}
                      <span className="hidden sm:inline">מחק</span>
                    </button>
                  </div>
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
