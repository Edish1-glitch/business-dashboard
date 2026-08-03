"use client";

import { useState, useEffect, useCallback, useMemo } from "react";
import {
  CheckCircle2, Clock, CreditCard, Loader2, Calendar, FileText, Building2,
} from "lucide-react";
import { categoryColors } from "@/lib/category-colors";
import {
  PieChart, Pie, Cell, ResponsiveContainer, Tooltip, Legend,
  BarChart, Bar, XAxis, YAxis, CartesianGrid,
} from "recharts";

type Scope = "all" | "business" | "private";

interface DashboardData {
  summary: {
    totalExpenses: number;
    businessExpenses: number;
    privateExpenses: number;
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
    currency: string | null;
    date: string | null;
    category: { name: string; color: string | null } | null;
  }[];
}

const CUR: Record<string, string> = { USD: "$", EUR: "€", GBP: "£", ILS: "₪" };
const nis = (n: number) => `₪${n.toLocaleString("he-IL", { maximumFractionDigits: 2 })}`;

// Stale-while-revalidate cache of the default (unfiltered) dashboard.
let dashboardCache: DashboardData | null = null;

export default function DashboardPage() {
  const [data, setData] = useState<DashboardData | null>(dashboardCache);
  const [loading, setLoading] = useState(dashboardCache === null);
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const [showCustomDate, setShowCustomDate] = useState(false);
  const [scope, setScope] = useState<Scope>("all");

  const fetchData = useCallback(async () => {
    try {
      const params = new URLSearchParams();
      if (dateFrom) params.set("from", dateFrom);
      if (dateTo) params.set("to", dateTo);
      if (scope !== "all") params.set("scope", scope);
      const res = await fetch(`/api/dashboard?${params}`);
      const d = await res.json();
      if (!d.error) {
        setData(d);
        if (!dateFrom && !dateTo && scope === "all") dashboardCache = d;
      }
    } catch { /* ignore */ }
    finally { setLoading(false); }
  }, [dateFrom, dateTo, scope]);

  useEffect(() => { fetchData(); }, [fetchData]);

  const datePresets = useMemo(() => {
    const now = new Date();
    return [
      { label: "החודש", from: new Date(now.getFullYear(), now.getMonth(), 1).toISOString().slice(0, 10), to: "" },
      { label: "3 חודשים", from: new Date(new Date().setMonth(now.getMonth() - 3)).toISOString().slice(0, 10), to: "" },
      { label: "שנה", from: new Date(new Date().setFullYear(now.getFullYear() - 1)).toISOString().slice(0, 10), to: "" },
      { label: "הכל", from: "", to: "" },
    ];
  }, []);

  const scopeTitle = scope === "business" ? "הוצאות עסקיות" : scope === "private" ? "הוצאות פרטיות" : 'סה"כ הוצאות';

  const tiles = [
    { label: "מאושרות", value: data?.summary.approvedCount ?? 0, Icon: CheckCircle2, tint: "bg-emerald-500/15 text-emerald-600" },
    { label: "ממתינות", value: data?.summary.pendingCount ?? 0, Icon: Clock, tint: "bg-amber-500/15 text-amber-600", badge: true },
    { label: "כרטיסים", value: data?.summary.creditCardCount ?? 0, Icon: CreditCard, tint: "bg-violet-500/15 text-violet-600" },
  ];

  return (
    <div className="space-y-4 max-w-5xl mx-auto">
      {/* HERO */}
      <div className="hero-grad hero-gloss relative overflow-hidden rounded-3xl p-6 md:p-8 text-white text-center">
        <div className="relative text-[12px] md:text-sm font-medium text-white/75">
          {scopeTitle} · {dateFrom || dateTo ? "מסונן" : "הכל"}
        </div>
        <div className="relative text-[38px] md:text-6xl font-black tnum leading-none mt-1.5">
          {data ? nis(data.summary.totalExpenses) : "…"}
        </div>
        <div className="relative grid grid-cols-2 gap-2.5 mt-5 max-w-xs md:max-w-md mx-auto">
          <div className="rounded-2xl px-3 py-2.5 text-center" style={{ background: "rgba(255,255,255,.16)" }}>
            <div className="text-[11px] text-white/70">עסקי</div>
            <div className="text-[14px] md:text-lg font-bold tnum">{data ? nis(data.summary.businessExpenses) : "…"}</div>
          </div>
          <div className="rounded-2xl px-3 py-2.5 text-center" style={{ background: "rgba(255,255,255,.16)" }}>
            <div className="text-[11px] text-white/70">פרטי</div>
            <div className="text-[14px] md:text-lg font-bold tnum">{data ? nis(data.summary.privateExpenses) : "…"}</div>
          </div>
        </div>
      </div>

      {/* controls: scope segmented + date presets — centered */}
      <div className="flex flex-col items-center gap-2.5" data-tour="date-filter">
        <div className="glass rounded-2xl p-1 flex text-[13px] font-semibold">
          {([{ key: "all", label: "הכל" }, { key: "business", label: "עסקי" }, { key: "private", label: "פרטי" }] as { key: Scope; label: string }[]).map((s) => (
            <button
              key={s.key}
              onClick={() => setScope(s.key)}
              className={`px-5 py-1.5 rounded-xl transition-colors ${scope === s.key ? "bg-primary text-primary-foreground shadow-sm" : "text-muted-foreground"}`}
            >
              {s.label}
            </button>
          ))}
        </div>
        <div className="flex items-center gap-1.5 flex-wrap justify-center">
          {datePresets.map((p) => (
            <button
              key={p.label}
              onClick={() => { setDateFrom(p.from); setDateTo(p.to); setShowCustomDate(false); }}
              className={`px-3 py-1.5 rounded-xl text-[12px] font-medium transition-colors ${dateFrom === p.from && dateTo === p.to ? "bg-primary text-primary-foreground" : "glass text-muted-foreground"}`}
            >
              {p.label}
            </button>
          ))}
          <button onClick={() => setShowCustomDate((v) => !v)} className={`flex items-center gap-1 px-3 py-1.5 rounded-xl text-[12px] font-medium ${showCustomDate ? "bg-primary text-primary-foreground" : "glass text-muted-foreground"}`}>
            <Calendar className="h-3 w-3" /> התאמה
          </button>
        </div>
      </div>
      {showCustomDate && (
        <div className="glass rounded-2xl p-3 flex items-center gap-2">
          <span className="text-xs text-muted-foreground">מ-</span>
          <input type="date" value={dateFrom} onChange={(e) => setDateFrom(e.target.value)} className="h-8 rounded-lg border border-input bg-background/60 px-2 text-xs" />
          <span className="text-xs text-muted-foreground">עד</span>
          <input type="date" value={dateTo} onChange={(e) => setDateTo(e.target.value)} className="h-8 rounded-lg border border-input bg-background/60 px-2 text-xs" />
        </div>
      )}

      {loading ? (
        <div className="flex justify-center py-10"><Loader2 className="h-8 w-8 animate-spin text-primary" /></div>
      ) : (
        <>
          {/* bento stat tiles */}
          <div className="grid grid-cols-3 gap-2.5 sm:gap-3" data-tour="summary-cards">
            {tiles.map((t) => (
              <div key={t.label} className="glass rounded-2xl p-3.5 relative text-center">
                <div className={`w-9 h-9 rounded-xl flex items-center justify-center mb-2 mx-auto ${t.tint}`}>
                  <t.Icon className="h-[18px] w-[18px]" strokeWidth={2.2} />
                </div>
                <div className="text-[22px] md:text-3xl font-black tnum text-foreground leading-none">{t.value}</div>
                <div className="text-[11.5px] text-muted-foreground mt-1">{t.label}</div>
                {t.badge && t.value > 0 && (
                  <span className="absolute top-2.5 left-2.5 text-[10px] font-bold text-amber-700 bg-amber-100/80 px-2 py-0.5 rounded-full">לטיפול</span>
                )}
              </div>
            ))}
          </div>

          {/* charts */}
          <div className="grid gap-3 md:grid-cols-2" data-tour="charts">
            <div className="glass rounded-3xl p-4 sm:p-5">
              <h3 className="text-[15px] font-bold mb-2">הוצאות לפי קטגוריה</h3>
              {data && data.byCategory.length > 0 ? (
                <ResponsiveContainer width="100%" height={260}>
                  <PieChart>
                    <Pie data={data.byCategory} dataKey="amount" nameKey="name" cx="50%" cy="44%" outerRadius="72%" innerRadius="46%" paddingAngle={2}>
                      {data.byCategory.map((e, i) => <Cell key={i} fill={e.color} />)}
                    </Pie>
                    <Tooltip formatter={(v) => [`₪${Number(v).toLocaleString("he-IL")}`, "סכום"]} contentStyle={{ fontSize: 12, borderRadius: 12, padding: "8px 12px", boxShadow: "0 8px 24px rgba(60,40,120,.18)", border: "none", background: "rgba(255,255,255,.95)", backdropFilter: "blur(8px)" }} />
                    <Legend verticalAlign="bottom" height={38} formatter={(v) => <span className="text-[11px]">{v}</span>} />
                  </PieChart>
                </ResponsiveContainer>
              ) : (
                <div className="flex items-center justify-center h-[240px] text-muted-foreground text-sm">אין נתונים להצגה</div>
              )}
            </div>

            <div className="glass rounded-3xl p-4 sm:p-5">
              <h3 className="text-[15px] font-bold mb-2">הוצאות חודשיות</h3>
              {data && data.monthlyData.length > 0 ? (
                <ResponsiveContainer width="100%" height={240}>
                  <BarChart data={data.monthlyData} margin={{ top: 5, right: 5, left: 5, bottom: 5 }}>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="rgba(120,110,160,.18)" />
                    <XAxis dataKey="month" fontSize={11} stroke="currentColor" opacity={0.5} />
                    <YAxis fontSize={11} width={40} stroke="currentColor" opacity={0.5} />
                    <Tooltip formatter={(v) => [`₪${Number(v).toLocaleString("he-IL")}`, "סכום"]} cursor={{ fill: "rgba(139,92,246,.08)" }} contentStyle={{ fontSize: 12, borderRadius: 12, padding: "8px 12px", boxShadow: "0 8px 24px rgba(60,40,120,.18)", border: "none", background: "rgba(255,255,255,.95)" }} />
                    <Bar dataKey="amount" fill="#8b5cf6" radius={[7, 7, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              ) : (
                <div className="flex items-center justify-center h-[240px] text-muted-foreground text-sm">אין נתונים להצגה</div>
              )}
            </div>
          </div>

          {/* recent */}
          <div className="glass rounded-3xl p-4 sm:p-5">
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-[15px] font-bold">חשבוניות אחרונות</h3>
              <a href="/invoices" className="text-[12px] text-primary font-semibold">הכל ←</a>
            </div>
            {data && data.recentInvoices.length > 0 ? (
              <div className="divide-y divide-border/40">
                {data.recentInvoices.map((inv) => (
                  <div key={inv.id} className="flex items-center gap-3 py-2.5">
                    <div className="w-9 h-9 rounded-full bg-primary/10 flex items-center justify-center shrink-0">
                      <Building2 className="h-4 w-4 text-primary" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="text-[13.5px] font-semibold truncate">{inv.vendor || "חשבונית"}</div>
                      <div className="flex items-center gap-2 mt-0.5">
                        {inv.category && (
                          <span className={`px-1.5 py-0.5 rounded text-[10px] font-medium ${categoryColors[inv.category.name] || "bg-gray-100 text-gray-700"}`}>{inv.category.name}</span>
                        )}
                        {inv.date && <span className="text-[10.5px] text-muted-foreground">{new Date(inv.date).toLocaleDateString("he-IL")}</span>}
                      </div>
                    </div>
                    {inv.amount !== null && (
                      <span className="text-[14px] font-bold tnum shrink-0">{CUR[inv.currency || "ILS"] || "₪"}{inv.amount.toLocaleString("he-IL")}</span>
                    )}
                  </div>
                ))}
              </div>
            ) : (
              <div className="flex items-center justify-center h-24 text-muted-foreground text-sm">
                <FileText className="h-5 w-5 ml-2 opacity-30" /> אין חשבוניות מאושרות עדיין
              </div>
            )}
          </div>
        </>
      )}
    </div>
  );
}
