import { SummaryCards } from "@/components/dashboard/SummaryCards";
import {
  PieChart,
  FileText,
  ArrowUpLeft,
  Sparkles,
} from "lucide-react";

export default function DashboardPage() {
  return (
    <div className="space-y-6">
      {/* Welcome banner */}
      <div className="relative overflow-hidden rounded-2xl bg-gradient-to-l from-indigo-600 via-violet-600 to-purple-700 p-6 md:p-8 text-white shadow-lg">
        <div className="relative z-10">
          <div className="flex items-center gap-2 mb-2">
            <Sparkles className="h-5 w-5 text-amber-300" />
            <span className="text-sm font-medium text-white/80">FinDash</span>
          </div>
          <h2 className="text-2xl md:text-3xl font-bold tracking-tight">
            ברוך הבא לדאשבורד
          </h2>
          <p className="mt-2 text-sm md:text-base text-white/70 max-w-lg">
            כאן תוכל לנהל את ההוצאות, לעקוב אחרי חשבוניות ולסנכרן עם חשבונית ירוקה.
          </p>
        </div>
        {/* Decorative circles */}
        <div className="absolute -top-10 -left-10 w-40 h-40 rounded-full bg-white/10 blur-2xl" />
        <div className="absolute -bottom-10 left-1/3 w-32 h-32 rounded-full bg-white/5 blur-xl" />
      </div>

      {/* Summary Cards */}
      <SummaryCards />

      {/* Content sections */}
      <div className="grid gap-4 md:grid-cols-2">
        <div data-slot="card" className="rounded-2xl bg-card border border-border/50 shadow-sm overflow-hidden">
          <div className="flex items-center gap-3 px-5 pt-5 pb-3">
            <div className="flex items-center justify-center w-9 h-9 rounded-xl bg-orange-50">
              <PieChart className="h-5 w-5 text-orange-500" />
            </div>
            <h3 className="text-base font-semibold">הוצאות לפי קטגוריה</h3>
          </div>
          <div className="px-5 pb-5">
            <div className="flex flex-col items-center justify-center h-48 rounded-xl bg-muted/50 text-muted-foreground text-sm">
              <PieChart className="h-10 w-10 mb-3 text-muted-foreground/30" />
              גרף הוצאות יופיע כאן לאחר הוספת נתונים
            </div>
          </div>
        </div>

        <div data-slot="card" className="rounded-2xl bg-card border border-border/50 shadow-sm overflow-hidden">
          <div className="flex items-center gap-3 px-5 pt-5 pb-3">
            <div className="flex items-center justify-center w-9 h-9 rounded-xl bg-sky-50">
              <FileText className="h-5 w-5 text-sky-500" />
            </div>
            <h3 className="text-base font-semibold">חשבוניות אחרונות</h3>
          </div>
          <div className="px-5 pb-5">
            <div className="flex flex-col items-center justify-center h-48 rounded-xl bg-muted/50 text-muted-foreground text-sm">
              <ArrowUpLeft className="h-10 w-10 mb-3 text-muted-foreground/30" />
              חשבוניות שנמשכו ממייל יופיעו כאן
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
