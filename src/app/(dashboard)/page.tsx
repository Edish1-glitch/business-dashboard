"use client";

import { useState, useEffect, useCallback } from "react";
import {
  TrendingDown,
  TrendingUp,
  FileText,
  CreditCard,
  Sparkles,
  Calendar,
  Building2,
  Tag,
  ClipboardCheck,
  Loader2,
} from "lucide-react";
import { categoryColors } from "@/lib/category-colors";
import {
  PieChart, Pie, Cell, ResponsiveContainer, Tooltip, Legend,
  BarChart, Bar, XAxis, YAxis, CartesianGrid,
} from "recharts";

interface DashboardData {
  summary: {
    totalExpenses: number;
    approvedCount: number;
    pendingCount: number;
    creditCardCount: number;
  };
  byCategory: { name: string; amount: number; color: string }[];
  monthlyData: { month: string; amount: number }[];
  recentInvoices: {
    id: string;
    vendor: string | null;
    amount: number | null;
    date: string | null;
    category: { name: string; color: string | null } | null;
  }[];
}

export default function DashboardPage() {
  const [data, setData] = useState<DashboardData | null>(null);
  const [loading, setLoading] = useState(true);
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const [showCustomDate, setShowCustomDate] = useState(false);

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (dateFrom) params.set("from", dateFrom);
      if (dateTo) params.set("to", dateTo);
      const res = await fetch(`/api/dashboard?${params}`);
      const d = await res.json();
      if (!d.error) setData(d);
    } catch { /* ignore */ }
    finally { setLoading(false); }
  }, [dateFrom, dateTo]);

  useEffect(() => { fetchData(); }, [fetchData]);

  const cards = [
    {
      title: 'סה"כ הוצאות',
      value: data ? `₪${data.summary.totalExpenses.toLocaleString("he-IL")}` : "...",
      icon: TrendingDown,
      gradient: "from-red-500 to-rose-600",
      bgLight: "bg-red-50",
      textColor: "text-red-600",
    },
    {
      title: "חשבוניות מאושרות",
      value: data ? data.summary.approvedCount.toString() : "...",
      icon: TrendingUp,
      gradient: "from-emerald-500 to-green-600",
      bgLight: "bg-emerald-50",
      textColor: "text-emerald-600",
    },
    {
      title: "ממתינות לאישור",
      value: data ? data.summary.pendingCount.toString() : "...",
      icon: ClipboardCheck,
      gradient: "from-amber-500 to-orange-600",
      bgLight: "bg-amber-50",
      textColor: "text-amber-600",
    },
    {
      title: "כרטיסי אשראי",
      value: data ? data.summary.creditCardCount.toString() : "...",
      icon: CreditCard,
      gradient: "from-violet-500 to-purple-600",
      bgLight: "bg-violet-50",
      textColor: "text-violet-600",
    },
  ];

  return (
    <div className="space-y-6">
      {/* Welcome banner */}
      <div data-tour="welcome-banner" className="relative overflow-hidden rounded-2xl bg-gradient-to-l from-indigo-600 via-violet-600 to-purple-700 p-6 md:p-8 text-white shadow-lg">
        <div className="relative z-10">
          <div className="flex items-center gap-2 mb-2">
            <Sparkles className="h-5 w-5 text-amber-300" />
            <span className="text-sm font-medium text-white/80">FinDash</span>
          </div>
          <h2 className="text-2xl md:text-3xl font-bold tracking-tight">ברוך הבא לדאשבורד</h2>
          <p className="mt-2 text-sm md:text-base text-white/70 max-w-lg">
            כאן תוכל לנהל את ההוצאות, לעקוב אחרי חשבוניות ולסנכרן עם חשבונית ירוקה.
          </p>
        </div>
        <div className="absolute -top-10 -left-10 w-40 h-40 rounded-full bg-white/10 blur-2xl" />
        <div className="absolute -bottom-10 left-1/3 w-32 h-32 rounded-full bg-white/5 blur-xl" />
      </div>

      {/* Date filter */}
      <div data-tour="date-filter" className="space-y-2">
        <div className="flex flex-wrap items-center gap-2">
          {[
            { label: "החודש", from: new Date(new Date().getFullYear(), new Date().getMonth(), 1).toISOString().slice(0, 10), to: "" },
            { label: "3 חודשים", from: new Date(new Date().setMonth(new Date().getMonth() - 3)).toISOString().slice(0, 10), to: "" },
            { label: "שנה", from: new Date(new Date().setFullYear(new Date().getFullYear() - 1)).toISOString().slice(0, 10), to: "" },
            { label: "הכל", from: "", to: "" },
          ].map((preset) => (
            <button
              key={preset.label}
              onClick={() => { setDateFrom(preset.from); setDateTo(preset.to); setShowCustomDate(false); }}
              className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${
                dateFrom === preset.from && dateTo === preset.to
                  ? "bg-primary text-primary-foreground"
                  : "bg-muted hover:bg-accent"
              }`}
            >
              {preset.label}
            </button>
          ))}
          <button
            onClick={() => setShowCustomDate(!showCustomDate)}
            className={`flex items-center gap-1 px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${
              showCustomDate ? "bg-primary text-primary-foreground" : "bg-muted hover:bg-accent"
            }`}
          >
            <Calendar className="h-3 w-3" />
            התאמה אישית
          </button>
        </div>
        {showCustomDate && (
          <div className="flex items-center gap-2 bg-muted/30 p-3 rounded-xl">
            <span className="text-xs text-muted-foreground">מ-</span>
            <input
              type="date"
              value={dateFrom}
              onChange={(e) => setDateFrom(e.target.value)}
              className="h-8 rounded-lg border border-input bg-background px-2 text-xs"
            />
            <span className="text-xs text-muted-foreground">עד</span>
            <input
              type="date"
              value={dateTo}
              onChange={(e) => setDateTo(e.target.value)}
              className="h-8 rounded-lg border border-input bg-background px-2 text-xs"
            />
          </div>
        )}
      </div>

      {/* Summary Cards */}
      {loading ? (
        <div className="flex justify-center py-8">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
        </div>
      ) : (
        <>
          <div data-tour="summary-cards" className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {cards.map((card) => (
              <div
                key={card.title}
                data-slot="card"
                className="relative overflow-hidden rounded-2xl bg-card border border-border/50 p-5 shadow-sm hover:shadow-md transition-shadow duration-200"
              >
                <div className={`absolute top-0 left-0 right-0 h-1 bg-gradient-to-l ${card.gradient}`} />
                <div className="flex items-start justify-between">
                  <p className="text-sm font-medium text-muted-foreground">{card.title}</p>
                  <div className={`flex items-center justify-center w-10 h-10 rounded-xl ${card.bgLight}`}>
                    <card.icon className={`h-5 w-5 ${card.textColor}`} />
                  </div>
                </div>
                <div className="mt-3">
                  <p className="text-3xl font-bold tracking-tight">{card.value}</p>
                </div>
              </div>
            ))}
          </div>

          {/* Charts */}
          <div data-tour="charts" className="grid gap-4 md:grid-cols-2">
            {/* Pie chart */}
            <div className="rounded-2xl bg-card border border-border/50 p-4 sm:p-5 shadow-sm outline-none" style={{ WebkitTapHighlightColor: "transparent" }}>
              <h3 className="text-base font-semibold mb-3">הוצאות לפי קטגוריה</h3>
              {data && data.byCategory.length > 0 ? (
                <div className="outline-none select-none" style={{ WebkitTapHighlightColor: "transparent" }}>
                  <ResponsiveContainer width="100%" height={280}>
                    <PieChart>
                      <Pie
                        data={data.byCategory}
                        dataKey="amount"
                        nameKey="name"
                        cx="50%"
                        cy="42%"
                        outerRadius="70%"
                        innerRadius="40%"
                        paddingAngle={2}
                      >
                        {data.byCategory.map((entry, i) => (
                          <Cell key={i} fill={entry.color} />
                        ))}
                      </Pie>
                      <Tooltip
                        formatter={(value) => `₪${Number(value).toLocaleString("he-IL")}`}
                        contentStyle={{ fontSize: 12, borderRadius: 8, padding: "4px 8px" }}
                      />
                      <Legend
                        verticalAlign="bottom"
                        height={40}
                        formatter={(value) => <span className="text-[11px] sm:text-xs">{value}</span>}
                      />
                    </PieChart>
                  </ResponsiveContainer>
                </div>
              ) : (
                <div className="flex items-center justify-center h-[250px] text-muted-foreground text-sm">
                  אין נתונים להצגה
                </div>
              )}
            </div>

            {/* Bar chart */}
            <div className="rounded-2xl bg-card border border-border/50 p-4 sm:p-5 shadow-sm outline-none" style={{ WebkitTapHighlightColor: "transparent" }}>
              <h3 className="text-base font-semibold mb-3">הוצאות חודשיות</h3>
              {data && data.monthlyData.length > 0 ? (
                <div className="outline-none select-none" style={{ WebkitTapHighlightColor: "transparent" }}>
                  <ResponsiveContainer width="100%" height={250}>
                    <BarChart data={data.monthlyData}>
                      <CartesianGrid strokeDasharray="3 3" vertical={false} />
                      <XAxis dataKey="month" fontSize={11} />
                      <YAxis fontSize={11} width={40} />
                      <Tooltip
                        formatter={(value) => `₪${Number(value).toLocaleString("he-IL")}`}
                        contentStyle={{ fontSize: 12, borderRadius: 8, padding: "4px 8px" }}
                      />
                      <Bar dataKey="amount" fill="#8b5cf6" radius={[6, 6, 0, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              ) : (
                <div className="flex items-center justify-center h-[250px] text-muted-foreground text-sm">
                  אין נתונים להצגה
                </div>
              )}
            </div>
          </div>

          {/* Recent invoices */}
          <div className="rounded-2xl bg-card border border-border/50 p-5 shadow-sm">
            <h3 className="text-base font-semibold mb-4">חשבוניות אחרונות</h3>
            {data && data.recentInvoices.length > 0 ? (
              <div className="space-y-3">
                {data.recentInvoices.map((inv) => (
                  <div key={inv.id} className="flex items-center justify-between py-2 border-b border-border/30 last:border-0">
                    <div className="flex items-center gap-3">
                      <Building2 className="h-4 w-4 text-muted-foreground" />
                      <span className="text-sm font-medium">{inv.vendor || "חשבונית"}</span>
                      {inv.category && (
                        <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${categoryColors[inv.category.name] || "bg-gray-100 text-gray-700"}`}>
                          <Tag className="h-2.5 w-2.5 inline ml-1" />
                          {inv.category.name}
                        </span>
                      )}
                    </div>
                    <div className="flex items-center gap-3 text-sm">
                      {inv.date && (
                        <span className="text-muted-foreground">
                          {new Date(inv.date).toLocaleDateString("he-IL")}
                        </span>
                      )}
                      {inv.amount !== null && (
                        <span className="font-bold">₪{inv.amount.toLocaleString("he-IL")}</span>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="flex items-center justify-center h-24 text-muted-foreground text-sm">
                <FileText className="h-5 w-5 ml-2 opacity-30" />
                אין חשבוניות מאושרות עדיין
              </div>
            )}
          </div>
        </>
      )}
    </div>
  );
}
