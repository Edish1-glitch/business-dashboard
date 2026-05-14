"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import {
  Receipt, Upload, CheckCircle2, BarChart3,
  ChevronLeft, ChevronRight, X, Sparkles,
  TrendingDown, TrendingUp, ClipboardCheck, CreditCard,
  Tag, Building2, Calendar, FileText,
} from "lucide-react";
import { Button } from "@/components/ui/button";

const tourSlides = [
  {
    title: "דאשבורד ראשי",
    description: "סיכום כל ההוצאות במבט אחד - כרטיסי סיכום, גרפים, וחשבוניות אחרונות. סנן לפי תאריכים וצפה בפילוח לפי קטגוריות.",
    icon: BarChart3,
    color: "bg-violet-100 text-violet-600",
    demo: "dashboard",
  },
  {
    title: "העלאת חשבוניות",
    description: "העלה PDF, תמונה מהגלריה, או צלם ישירות מהמצלמה. המערכת מזהה אוטומטית את הספק, הסכום, התאריך והקטגוריה באמצעות OCR.",
    icon: Upload,
    color: "bg-blue-100 text-blue-600",
    demo: "upload",
  },
  {
    title: "אישור חשבוניות",
    description: "כל חשבונית עוברת בדיקה לפני שנכנסת לחישוב. תוכל לערוך פרטים, לצפות בתמונת המקור, ולאשר או לדחות.",
    icon: CheckCircle2,
    color: "bg-emerald-100 text-emerald-600",
    demo: "pending",
  },
  {
    title: "ניהול וייצוא",
    description: "צפה בכל החשבוניות המאושרות, חפש לפי שם ספק, סנן לפי קטגוריה או כרטיס אשראי, וייצא ל-CSV.",
    icon: FileText,
    color: "bg-orange-100 text-orange-600",
    demo: "invoices",
  },
];

// Mock data for demo
const mockCards = [
  { title: 'סה"כ הוצאות', value: "₪4,230", gradient: "from-red-500 to-rose-600", bgLight: "bg-red-50", textColor: "text-red-600", Icon: TrendingDown },
  { title: "מאושרות", value: "24", gradient: "from-emerald-500 to-green-600", bgLight: "bg-emerald-50", textColor: "text-emerald-600", Icon: TrendingUp },
  { title: "ממתינות", value: "3", gradient: "from-amber-500 to-orange-600", bgLight: "bg-amber-50", textColor: "text-amber-600", Icon: ClipboardCheck },
  { title: "כרטיסים", value: "2", gradient: "from-violet-500 to-purple-600", bgLight: "bg-violet-50", textColor: "text-violet-600", Icon: CreditCard },
];

const mockInvoices = [
  { vendor: "פז חברת נפט", amount: 49.12, date: "14.1.2024", category: "דלק", catColor: "bg-orange-100 text-orange-700" },
  { vendor: "רמי לוי", amount: 312.50, date: "12.1.2024", category: "סופר", catColor: "bg-green-100 text-green-700" },
  { vendor: "סלקום", amount: 89.90, date: "10.1.2024", category: "תקשורת", catColor: "bg-cyan-100 text-cyan-700" },
];

function DemoDashboard() {
  return (
    <div className="space-y-4">
      <div className="grid grid-cols-4 gap-3">
        {mockCards.map((c) => (
          <div key={c.title} className="relative overflow-hidden rounded-xl bg-card border border-border/50 p-3 shadow-sm">
            <div className={`absolute top-0 left-0 right-0 h-1 bg-gradient-to-l ${c.gradient}`} />
            <div className="flex items-start justify-between">
              <p className="text-xs text-muted-foreground">{c.title}</p>
              <div className={`w-7 h-7 rounded-lg ${c.bgLight} flex items-center justify-center`}>
                <c.Icon className={`h-3.5 w-3.5 ${c.textColor}`} />
              </div>
            </div>
            <p className="text-xl font-bold mt-1">{c.value}</p>
          </div>
        ))}
      </div>
      <div className="space-y-2">
        {mockInvoices.map((inv, i) => (
          <div key={i} className="flex items-center justify-between p-2.5 rounded-xl bg-card border border-border/30">
            <div className="flex items-center gap-2">
              <Building2 className="h-3.5 w-3.5 text-muted-foreground" />
              <span className="text-xs font-medium">{inv.vendor}</span>
              <span className={`text-[10px] px-1.5 py-0.5 rounded-full ${inv.catColor}`}>{inv.category}</span>
            </div>
            <div className="flex items-center gap-2 text-xs">
              <span className="text-muted-foreground">{inv.date}</span>
              <span className="font-bold">₪{inv.amount}</span>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

function DemoUpload() {
  return (
    <div className="flex flex-col items-center justify-center p-8 rounded-xl border-2 border-dashed border-border">
      <Upload className="h-10 w-10 text-primary/30 mb-3" />
      <p className="text-sm font-medium">בחר קבצים להעלאה</p>
      <p className="text-xs text-muted-foreground">PDF, תמונה, או צילום</p>
      <div className="flex gap-2 mt-3">
        <span className="text-[10px] bg-muted px-2 py-1 rounded-full">PDF</span>
        <span className="text-[10px] bg-muted px-2 py-1 rounded-full">JPG</span>
        <span className="text-[10px] bg-muted px-2 py-1 rounded-full">צילום</span>
      </div>
    </div>
  );
}

function DemoPending() {
  return (
    <div className="space-y-2">
      {mockInvoices.map((inv, i) => (
        <div key={i} className="flex items-center justify-between p-3 rounded-xl bg-card border border-amber-200">
          <div className="flex items-center gap-2">
            <div className="w-6 h-6 rounded-full bg-emerald-100 flex items-center justify-center">
              <CheckCircle2 className="h-3.5 w-3.5 text-emerald-600" />
            </div>
            <span className="text-xs font-medium">{inv.vendor}</span>
            <span className="text-[10px] bg-amber-100 text-amber-700 px-1.5 py-0.5 rounded-full">ממתין</span>
          </div>
          <span className="text-sm font-bold">₪{inv.amount}</span>
        </div>
      ))}
    </div>
  );
}

function DemoInvoices() {
  return (
    <div className="space-y-2">
      <div className="flex items-center gap-2 mb-3">
        <div className="flex-1 h-8 rounded-lg border border-input bg-background px-3 text-xs flex items-center text-muted-foreground">
          🔍 חיפוש לפי שם ספק...
        </div>
        <div className="h-8 px-3 rounded-lg border border-input bg-background text-xs flex items-center gap-1 text-muted-foreground">
          CSV ⬇️
        </div>
      </div>
      {mockInvoices.map((inv, i) => (
        <div key={i} className="flex items-center justify-between p-3 rounded-xl bg-card border border-emerald-200">
          <div className="flex items-center gap-2">
            <span className="text-xs font-medium">{inv.vendor}</span>
            <span className="text-[10px] bg-emerald-100 text-emerald-700 px-1.5 py-0.5 rounded-full">מאושר</span>
          </div>
          <span className="text-sm font-bold">₪{inv.amount}</span>
        </div>
      ))}
    </div>
  );
}

const demoComponents: Record<string, () => React.ReactElement> = {
  dashboard: DemoDashboard,
  upload: DemoUpload,
  pending: DemoPending,
  invoices: DemoInvoices,
};

export default function TourPage() {
  const [step, setStep] = useState(0);
  const router = useRouter();
  const slide = tourSlides[step];
  const DemoComponent = demoComponents[slide.demo];

  return (
    <div className="min-h-screen bg-background flex flex-col">
      {/* Demo banner */}
      <div className="bg-violet-600 text-white text-center py-2 text-sm font-medium">
        🎯 סיור באפליקציה - מצב דמו
      </div>

      <div className="flex-1 flex items-center justify-center p-4">
        <div className="w-full max-w-2xl space-y-6">
          {/* Step info */}
          <div className="flex items-center gap-4">
            <div className={`flex items-center justify-center w-14 h-14 rounded-2xl ${slide.color}`}>
              <slide.icon className="h-7 w-7" />
            </div>
            <div className="flex-1">
              <div className="flex items-center gap-2 mb-1">
                <h2 className="text-xl font-bold">{slide.title}</h2>
                <span className="text-xs bg-muted px-2 py-0.5 rounded-full text-muted-foreground">
                  {step + 1}/{tourSlides.length}
                </span>
              </div>
              <p className="text-sm text-muted-foreground">{slide.description}</p>
            </div>
          </div>

          {/* Demo preview */}
          <div className="rounded-2xl bg-muted/30 border border-border p-5 min-h-[300px]">
            <DemoComponent />
          </div>

          {/* Progress bar */}
          <div className="w-full h-1.5 bg-muted rounded-full">
            <div
              className="h-1.5 bg-violet-500 rounded-full transition-all duration-300"
              style={{ width: `${((step + 1) / tourSlides.length) * 100}%` }}
            />
          </div>

          {/* Navigation */}
          <div className="flex items-center justify-between">
            <Button
              variant="ghost"
              onClick={() => router.push("/login")}
            >
              <X className="h-4 w-4 ml-1" />
              חזרה
            </Button>
            <div className="flex gap-2">
              {step > 0 && (
                <Button variant="outline" onClick={() => setStep(step - 1)}>
                  <ChevronRight className="h-4 w-4 ml-1" />
                  הקודם
                </Button>
              )}
              {step < tourSlides.length - 1 ? (
                <Button onClick={() => setStep(step + 1)}>
                  הבא
                  <ChevronLeft className="h-4 w-4 mr-1" />
                </Button>
              ) : (
                <Button onClick={() => router.push("/login")} className="bg-violet-600 hover:bg-violet-700">
                  <Sparkles className="h-4 w-4 ml-1" />
                  מוכן? התחבר עכשיו
                </Button>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
