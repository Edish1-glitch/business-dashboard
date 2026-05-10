"use client";

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
  Eye,
  FileText,
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

export default function PendingInvoicesPage() {
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [loading, setLoading] = useState(true);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editData, setEditData] = useState<Partial<Invoice>>({});
  const [newCategoryName, setNewCategoryName] = useState("");
  const [showNewCategory, setShowNewCategory] = useState(false);
  const [approving, setApproving] = useState<string | null>(null);
  const [approvingAll, setApprovingAll] = useState(false);
  const [previewId, setPreviewId] = useState<string | null>(null);

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
    }
  }, []);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

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

  const approveAll = async () => {
    setApprovingAll(true);
    await fetch("/api/invoices/approve-all", { method: "POST" });
    setApprovingAll(false);
    fetchData();
  };

  const addCategory = async () => {
    if (!newCategoryName.trim()) return;
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
          <a href="/pdf-split" className="text-primary font-medium hover:underline">
            פיצול PDF
          </a>
          , לאחר העלאה החשבוניות יופיעו כאן לבדיקה ואישור.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-6 max-w-4xl mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-bold">ממתינות לאישור</h2>
          <p className="text-sm text-muted-foreground">
            {invoices.length} חשבוניות ממתינות לבדיקה ואישור
          </p>
        </div>
        <Button
          onClick={approveAll}
          disabled={approvingAll}
          className="gap-2 bg-emerald-600 hover:bg-emerald-700"
        >
          {approvingAll ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <CheckCheck className="h-4 w-4" />
          )}
          אשר הכל
        </Button>
      </div>

      {/* Invoice cards */}
      <div className="grid gap-3">
        {invoices.map((inv) => {
          const isEditing = editingId === inv.id;

          return (
            <div
              key={inv.id}
              className="rounded-2xl bg-card border border-amber-200 p-4 shadow-sm"
            >
              {isEditing ? (
                /* Edit mode with PDF preview */
                <div className="space-y-3">
                  {/* PDF Preview */}
                  <div className="rounded-xl border border-border overflow-hidden bg-muted/30">
                    <img
                      src={`/api/invoices/${inv.id}/preview`}
                      alt={`חשבונית - ${inv.vendor || inv.fileName}`}
                      className="w-full max-h-[500px] object-contain"
                    />
                  </div>

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
                          <Button size="sm" onClick={addCategory}>
                            הוסף
                          </Button>
                        </div>
                      )}
                    </div>
                  </div>
                  <div className="flex gap-2 justify-end">
                    <Button variant="ghost" size="sm" onClick={() => setEditingId(null)}>
                      <X className="h-4 w-4 ml-1" /> ביטול
                    </Button>
                    <Button size="sm" onClick={() => saveEdit(inv.id)}>
                      שמור
                    </Button>
                  </div>
                </div>
              ) : (
                /* View mode */
                <div className="space-y-3">
                  <div className="flex items-start justify-between gap-4">
                    <div className="flex-1 space-y-2">
                      <div className="flex items-center gap-2">
                        <Building2 className="h-4 w-4 text-muted-foreground" />
                        <span className="font-semibold">
                          {inv.vendor || inv.fileName}
                        </span>
                        <span className="text-xs bg-amber-100 text-amber-700 px-2 py-0.5 rounded-full font-medium">
                          ממתין
                        </span>
                      </div>

                      <div className="flex flex-wrap items-center gap-3 text-sm">
                        {inv.amount !== null && (
                          <span className="font-bold text-lg">
                            ₪{inv.amount.toLocaleString("he-IL")}
                          </span>
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
                        {inv.creditCardLast4 && (
                          <span className="flex items-center gap-1 text-muted-foreground">
                            <CreditCard className="h-3.5 w-3.5" />
                            ****{inv.creditCardLast4}
                          </span>
                        )}
                      </div>
                    </div>

                    <div className="flex items-center gap-1">
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => setPreviewId(previewId === inv.id ? null : inv.id)}
                        title="תצוגה מקדימה"
                      >
                        <Eye className="h-4 w-4" />
                      </Button>
                      <Button variant="ghost" size="icon" onClick={() => window.open(`/api/invoices/${inv.id}/download`, "_blank")}>
                        <Download className="h-4 w-4" />
                      </Button>
                      <Button variant="ghost" size="icon" onClick={() => startEdit(inv)}>
                        <Pencil className="h-4 w-4" />
                      </Button>
                    <Button
                      size="icon"
                      className="bg-emerald-600 hover:bg-emerald-700 text-white"
                      onClick={() => approveOne(inv.id)}
                      disabled={approving === inv.id}
                    >
                      {approving === inv.id ? (
                        <Loader2 className="h-4 w-4 animate-spin" />
                      ) : (
                        <CheckCircle2 className="h-4 w-4" />
                      )}
                    </Button>
                  </div>
                  </div>

                  {/* Inline Preview - scrollable with full-width image */}
                  {previewId === inv.id && (
                    <div className="rounded-xl border border-border overflow-auto bg-white max-h-[500px]">
                      <img
                        src={`/api/invoices/${inv.id}/preview`}
                        alt={`חשבונית - ${inv.vendor || inv.fileName}`}
                        className="w-full"
                        draggable={false}
                      />
                    </div>
                  )}
                </div>
              )}
            </div>
          );
        })}
      </div>

    </div>
  );
}
