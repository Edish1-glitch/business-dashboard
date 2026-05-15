"use client";
import { categoryColors } from "@/lib/category-colors";

import { useState, useEffect, useCallback } from "react";
import {
  CheckCircle2,
  Download,
  Tag,
  CreditCard,
  Calendar,
  Building2,
  Loader2,
  CheckCheck,
  Pencil,
  X,
  Plus,
  Trash2,
  Square,
  CheckSquare,
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
}


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
    } catch (err) {
      console.error("Failed to fetch:", err);
      setInvoices([]);
    } finally {
      setLoading(false);
      setSelected(new Set());
    }
  }, []);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const toggleSelect = (id: string) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const toggleSelectAll = () => {
    if (selected.size === invoices.length) {
      setSelected(new Set());
    } else {
      setSelected(new Set(invoices.map((i) => i.id)));
    }
  };

  const startEdit = (inv: Invoice) => {
    setEditingId(inv.id);
    setEditData({
      vendor: inv.vendor,
      amount: inv.amount,
      date: inv.date ? inv.date.split("T")[0] : "",
      creditCardLast4: inv.creditCardLast4,
      category: inv.category,
    });
  };

  const saveEdit = async (id: string) => {
    await fetch(`/api/invoices/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        vendor: editData.vendor,
        amount: editData.amount,
        date: editData.date || null,
        categoryId: editData.category?.id || null,
        creditCardLast4: editData.creditCardLast4 || null,
      }),
    });
    setEditingId(null);
    fetchData();
  };

  const approveOne = async (id: string) => {
    setApproving(id);
    await fetch(`/api/invoices/${id}/approve`, { method: "POST" });
    setApproving(null);
    fetchData();
  };

  const deleteOne = async (id: string) => {
    setDeleting(id);
    await fetch(`/api/invoices/${id}`, { method: "DELETE" });
    setDeleting(null);
    fetchData();
  };

  const bulkApprove = async () => {
    if (selected.size === 0) return;
    setBulkAction(true);
    await fetch("/api/invoices/bulk", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "approve", ids: [...selected] }),
    });
    setBulkAction(false);
    fetchData();
  };

  const bulkDelete = async () => {
    if (selected.size === 0) return;
    setBulkAction(true);
    await fetch("/api/invoices/bulk", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "delete", ids: [...selected] }),
    });
    setBulkAction(false);
    fetchData();
  };

  const addCategory = async () => {
    if (!newCategoryName.trim() || addingCategory) return;
    setAddingCategory(true);
    try {
      const res = await fetch("/api/categories", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: newCategoryName.trim() }),
      });
      const data = await res.json();
      if (data.category) {
        setCategories((prev) => [...prev, data.category]);
        setEditData((prev) => ({ ...prev, category: data.category }));
        setNewCategoryName("");
        setShowNewCategory(false);
      }
    } finally {
      setAddingCategory(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-16">
        <Loader2 className="h-8 w-8 text-primary animate-spin" />
      </div>
    );
  }

  if (invoices.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-16 text-muted-foreground max-w-md mx-auto text-center">
        <CheckCircle2 className="h-12 w-12 mb-4 text-emerald-400" />
        <p className="text-lg font-medium">אין כרגע חשבוניות לאישור</p>
        <p className="text-sm mt-2">
          ניתן להעלות חשבונית חדשה בעמוד{" "}
          <a href="/upload" className="text-primary font-medium hover:underline">
            העלאת חשבוניות
          </a>
          , לאחר העלאה החשבוניות יופיעו כאן לבדיקה ואישור.
        </p>
      </div>
    );
  }

  const allSelected = selected.size === invoices.length;

  return (
    <div data-tour="pending-list" className="space-y-3 md:space-y-6 max-w-5xl mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-bold">ממתינות לאישור</h2>
          <p className="text-sm text-muted-foreground">
            {invoices.length} חשבוניות ממתינות לבדיקה ואישור
          </p>
        </div>
      </div>

      {/* Bulk action bar */}
      <div className="flex items-center gap-2 flex-wrap">
        <Button
          variant="outline"
          size="sm"
          onClick={toggleSelectAll}
          className="gap-2"
        >
          {allSelected ? (
            <CheckSquare className="h-4 w-4" />
          ) : (
            <Square className="h-4 w-4" />
          )}
          {allSelected ? "בטל בחירה" : "בחר הכל"}
        </Button>

        {selected.size > 0 && (
          <>
            <span className="text-sm text-muted-foreground">
              {selected.size} נבחרו
            </span>
            <Button
              size="sm"
              onClick={bulkApprove}
              disabled={bulkAction}
              className="gap-2 bg-emerald-600 hover:bg-emerald-700"
            >
              {bulkAction ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <CheckCheck className="h-4 w-4" />
              )}
              אשר נבחרים
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={bulkDelete}
              disabled={bulkAction}
              className="gap-2 text-red-600 hover:text-red-700 hover:bg-red-50 border-red-200"
            >
              {bulkAction ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Trash2 className="h-4 w-4" />
              )}
              מחק נבחרים
            </Button>
          </>
        )}
      </div>

      {/* Invoice cards */}
      <div className="grid gap-3">
        {invoices.map((inv) => {
          const isEditing = editingId === inv.id;
          const isSelected = selected.has(inv.id);

          return (
            <div
              key={inv.id}
              className={`rounded-xl bg-card border p-3 shadow-sm transition-colors ${
                isSelected ? "border-primary bg-primary/5" : "border-amber-200"
              }`}
            >
              {isEditing ? (
                /* Edit mode - side by side: image left, form right (RTL: row-reverse) */
                <div className="flex flex-col md:flex-row-reverse gap-4">
                  {/* Preview image */}
                  <div className="md:w-1/2 rounded-xl border border-border overflow-auto bg-white max-h-[600px] shrink-0">
                    <img
                      src={`/api/invoices/${inv.id}/preview`}
                      alt={`חשבונית - ${inv.vendor || inv.fileName}`}
                      className="w-full"
                      draggable={false}
                    />
                  </div>

                  {/* Form */}
                  <div className="md:w-1/2 space-y-3">
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                      <div>
                        <label className="text-xs font-medium text-muted-foreground mb-1 block">ספק</label>
                        <input
                          type="text"
                          value={editData.vendor || ""}
                          onChange={(e) => setEditData({ ...editData, vendor: e.target.value })}
                          className="w-full h-9 rounded-lg border border-input bg-background px-3 text-sm"
                        />
                      </div>
                      <div>
                        <label className="text-xs font-medium text-muted-foreground mb-1 block">סכום (₪)</label>
                        <input
                          type="number"
                          step="0.01"
                          value={editData.amount || ""}
                          onChange={(e) => setEditData({ ...editData, amount: parseFloat(e.target.value) || null })}
                          className="w-full h-9 rounded-lg border border-input bg-background px-3 text-sm"
                        />
                      </div>
                      <div>
                        <label className="text-xs font-medium text-muted-foreground mb-1 block">תאריך</label>
                        <input
                          type="date"
                          value={typeof editData.date === "string" ? editData.date : ""}
                          onChange={(e) => setEditData({ ...editData, date: e.target.value })}
                          className="w-full h-9 rounded-lg border border-input bg-background px-3 text-sm"
                        />
                      </div>
                      <div>
                        <label className="text-xs font-medium text-muted-foreground mb-1 block">4 ספרות כרטיס</label>
                        <input
                          type="text"
                          maxLength={4}
                          value={editData.creditCardLast4 || ""}
                          onChange={(e) => setEditData({ ...editData, creditCardLast4: e.target.value.replace(/\D/g, "") })}
                          className="w-full h-9 rounded-lg border border-input bg-background px-3 text-sm"
                          placeholder="1234"
                        />
                      </div>
                      <div className="sm:col-span-2">
                        <label className="text-xs font-medium text-muted-foreground mb-1 block">קטגוריה</label>
                        <div className="flex gap-2">
                          <select
                            value={editData.category?.id || ""}
                            onChange={(e) => {
                              const cat = categories.find((c) => c.id === e.target.value);
                              setEditData({ ...editData, category: cat || null });
                            }}
                            className="flex-1 h-9 rounded-lg border border-input bg-background px-3 text-sm"
                          >
                            <option value="">ללא קטגוריה</option>
                            {categories.map((cat) => (
                              <option key={cat.id} value={cat.id}>{cat.name}</option>
                            ))}
                          </select>
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => setShowNewCategory(!showNewCategory)}
                            className="shrink-0"
                          >
                            <Plus className="h-4 w-4" />
                          </Button>
                        </div>
                        {showNewCategory && (
                          <div className="flex gap-2 mt-2">
                            <input
                              type="text"
                              value={newCategoryName}
                              onChange={(e) => setNewCategoryName(e.target.value)}
                              placeholder="שם קטגוריה חדשה"
                              className="flex-1 h-9 rounded-lg border border-input bg-background px-3 text-sm"
                            />
                            <Button size="sm" onClick={addCategory} disabled={addingCategory}>
                              {addingCategory ? <Loader2 className="h-4 w-4 animate-spin" /> : "הוסף"}
                            </Button>
                          </div>
                        )}
                      </div>
                    </div>
                    <div className="flex gap-2 justify-end pt-2">
                      <Button variant="ghost" size="sm" onClick={() => setEditingId(null)}>
                        <X className="h-4 w-4 ml-1" /> ביטול
                      </Button>
                      <Button size="sm" onClick={() => saveEdit(inv.id)}>
                        שמור
                      </Button>
                    </div>
                  </div>
                </div>
              ) : (
                /* View mode - compact mobile-first layout */
                <div className="space-y-1.5">
                  {/* Row 1: checkbox + vendor name */}
                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => toggleSelect(inv.id)}
                      className="shrink-0 p-0.5 text-muted-foreground hover:text-foreground"
                    >
                      {isSelected ? (
                        <CheckSquare className="h-[18px] w-[18px] text-primary" />
                      ) : (
                        <Square className="h-[18px] w-[18px]" />
                      )}
                    </button>
                    <span className="font-semibold text-[13px] truncate flex-1">
                      {inv.vendor || inv.fileName}
                    </span>
                  </div>

                  {/* Row 2: amount + date + category + card */}
                  <div className="flex flex-wrap items-center gap-x-2 gap-y-1 pr-6 text-[12px]">
                    {inv.amount !== null && (
                      <span className="font-bold">₪{inv.amount.toLocaleString("he-IL")}</span>
                    )}
                    {inv.date && (
                      <span className="text-muted-foreground">{new Date(inv.date).toLocaleDateString("he-IL")}</span>
                    )}
                    {inv.category && (
                      <span className={`px-1.5 py-0.5 rounded text-[10px] font-medium ${categoryColors[inv.category.name] || categoryColors["אחר"]}`}>
                        {inv.category.name}
                      </span>
                    )}
                    {inv.creditCardLast4 && (
                      <span className="text-muted-foreground">****{inv.creditCardLast4}</span>
                    )}
                  </div>

                  {/* Row 3: actions */}
                  <div className="flex items-center gap-1 pr-6 pt-0.5">
                    <Button
                      size="sm"
                      className="gap-1 bg-emerald-600 hover:bg-emerald-700 text-white h-7 text-[11px] px-2"
                      onClick={() => approveOne(inv.id)}
                      disabled={approving === inv.id}
                    >
                      {approving === inv.id ? <Loader2 className="h-3 w-3 animate-spin" /> : <CheckCircle2 className="h-3 w-3" />}
                      אשר
                    </Button>
                    <Button variant="outline" size="sm" className="gap-1 h-7 text-[11px] px-2" onClick={() => startEdit(inv)}>
                      <Pencil className="h-3 w-3" />
                      ערוך
                    </Button>
                    <Button variant="ghost" size="sm" className="h-7 w-7 p-0" onClick={() => window.open(`/api/invoices/${inv.id}/download`, "_blank")}>
                      <Download className="h-3 w-3" />
                    </Button>
                    <div className="flex-1" />
                    <Button
                      variant="ghost"
                      size="sm"
                      className="h-7 w-7 p-0 text-red-500 hover:text-red-700 hover:bg-red-50"
                      onClick={() => deleteOne(inv.id)}
                      disabled={deleting === inv.id}
                    >
                      {deleting === inv.id ? <Loader2 className="h-3 w-3 animate-spin" /> : <Trash2 className="h-3 w-3" />}
                    </Button>
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
