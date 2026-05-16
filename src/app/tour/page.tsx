"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import {
  Receipt, Upload, CheckCircle2, BarChart3,
  ChevronLeft, ChevronRight, X, Sparkles, Mail, Cloud,
  TrendingDown, TrendingUp, ClipboardCheck, CreditCard,
  Tag, Building2, Calendar, FileText, RefreshCw, Download, Pencil, Trash2,
} from "lucide-react";
import { Button } from "@/components/ui/button";

const tourSlides = [
  {
    title: "ברוך הבא ל-FinDash",
    description: "הדאשבורד שלך לניהול חשבוניות והוצאות. חכם, מהיר ואוטומטי. בוא נראה לך מה יש פה.",
    icon: Sparkles,
    color: "from-primary to-violet-600",
    demo: "welcome",
  },
  {
    title: "חבר את ה-Gmail",
    description: "חבר חשבונות Gmail ומשוך חשבוניות אוטומטית מצרופות מיילים. תומך בחשבוניות ישראליות ובינלאומיות.",
    icon: Mail,
    color: "from-red-500 to-orange-500",
    demo: "gmail",
  },
  {
    title: "העלאת חשבוניות",
    description: "העלה PDF, תמונה מהגלריה, או צלם ישירות מהמצלמה. המערכת מזהה אוטומטית את הפרטים באמצעות OCR.",
    icon: Upload,
    color: "from-blue-500 to-cyan-500",
    demo: "upload",
  },
  {
    title: "בדוק ואשר",
    description: "כל חשבונית עוברת בדיקה לפני שנכנסת לחישוב. ערוך, אשר, או מחק - בודדות או כמה בבת אחת.",
    icon: CheckCircle2,
    color: "from-emerald-500 to-green-500",
    demo: "pending",
  },
  {
    title: "דאשבורד ראשי",
    description: "סיכום כל ההוצאות במבט אחד - כרטיסי סיכום, גרפים לפי קטגוריה וחודש, וחשבוניות אחרונות.",
    icon: BarChart3,
    color: "from-violet-500 to-purple-500",
    demo: "dashboard",
  },
  {
    title: "ניהול וייצוא",
    description: "צפה בכל החשבוניות, חפש לפי ספק, סנן לפי קטגוריה, וייצא ל-CSV לעבודה עם אקסל.",
    icon: FileText,
    color: "from-amber-500 to-orange-500",
    demo: "invoices",
  },
  {
    title: "מסונכרן בכל מקום",
    description: "הנתונים שלך מסונכרנים בין המחשב לטלפון. קבצים מאוחסנים בענן (Cloudflare R2) בצורה מאובטחת.",
    icon: Cloud,
    color: "from-sky-500 to-blue-500",
    demo: "sync",
  },
];

// Mock data
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

function DemoWelcome() {
  return (
    <div className="flex flex-col items-center justify-center py-6 text-center space-y-4">
      <div className="flex items-center justify-center w-20 h-20 rounded-3xl bg-primary/10">
        <Receipt className="h-10 w-10 text-primary" />
      </div>
      <h3 className="text-lg font-bold">FinDash</h3>
      <div className="grid grid-cols-3 gap-3 w-full max-w-xs text-center">
        <div className="p-3 rounded-xl bg-muted/50">
          <Mail className="h-5 w-5 mx-auto mb-1 text-red-500" />
          <p className="text-[10px] text-muted-foreground">Gmail</p>
        </div>
        <div className="p-3 rounded-xl bg-muted/50">
          <Upload className="h-5 w-5 mx-auto mb-1 text-blue-500" />
          <p className="text-[10px] text-muted-foreground">OCR</p>
        </div>
        <div className="p-3 rounded-xl bg-muted/50">
          <BarChart3 className="h-5 w-5 mx-auto mb-1 text-violet-500" />
          <p className="text-[10px] text-muted-foreground">דאשבורד</p>
        </div>
      </div>
    </div>
  );
}

function DemoGmail() {
  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between p-3 rounded-xl bg-card border border-border">
        <div className="space-y-0.5">
          <p className="text-sm font-medium">edishteinberg10@gmail.com</p>
          <p className="text-[11px] text-muted-foreground">סנכרון אחרון: 15.5.2026</p>
        </div>
        <div className="flex gap-1">
          <div className="h-7 w-7 rounded bg-muted flex items-center justify-center"><RefreshCw className="h-3 w-3" /></div>
          <div className="h-7 w-7 rounded bg-red-50 flex items-center justify-center"><Trash2 className="h-3 w-3 text-red-500" /></div>
        </div>
      </div>
      <div className="rounded-xl bg-muted/30 border border-border p-3 space-y-2">
        <p className="text-[11px] text-muted-foreground">מעבד מייל 245 מתוך 426...</p>
        <div className="w-full h-1.5 bg-muted rounded-full">
          <div className="h-1.5 bg-primary rounded-full w-[57%]" />
        </div>
        <p className="text-[11px] font-medium">412 חשבוניות נמצאו, 48MB</p>
      </div>
      <div className="p-2.5 rounded-lg bg-emerald-50 border border-emerald-200 text-emerald-800 text-[11px]">
        912 חשבוניות סונכרנו בהצלחה מ-01/2024 עד 05/2026
      </div>
    </div>
  );
}

function DemoUpload() {
  return (
    <div className="space-y-3">
      <div className="flex flex-col items-center justify-center p-6 rounded-xl border-2 border-dashed border-border">
        <Upload className="h-8 w-8 text-primary/30 mb-2" />
        <p className="text-sm font-medium">בחר קבצים להעלאה</p>
        <p className="text-[11px] text-muted-foreground">PDF, תמונה, או צילום</p>
        <div className="flex gap-2 mt-2">
          <span className="text-[10px] bg-muted px-2 py-0.5 rounded-full">PDF</span>
          <span className="text-[10px] bg-muted px-2 py-0.5 rounded-full">JPG / PNG</span>
          <span className="text-[10px] bg-muted px-2 py-0.5 rounded-full">צילום</span>
        </div>
      </div>
      <div className="p-2.5 rounded-lg bg-blue-50 border border-blue-200 text-blue-800 text-[11px]">
        OCR אוטומטי: מזהה ספק, סכום, תאריך, קטגוריה וכרטיס אשראי - בעברית ובאנגלית
      </div>
    </div>
  );
}

function DemoPending() {
  return (
    <div className="space-y-2">
      {mockInvoices.map((inv, i) => (
        <div key={i} className="flex items-center justify-between p-2.5 rounded-xl bg-card border border-amber-200">
          <div className="flex items-center gap-2">
            <div className="w-4 h-4 rounded border border-muted-foreground/30" />
            <span className="text-xs font-medium">{inv.vendor}</span>
            <span className={`text-[10px] px-1.5 py-0.5 rounded ${inv.catColor}`}>{inv.category}</span>
          </div>
          <div className="flex items-center gap-1.5">
            <span className="text-xs font-bold">₪{inv.amount}</span>
            <div className="flex gap-0.5">
              <div className="h-6 px-1.5 rounded bg-emerald-600 text-white text-[10px] flex items-center gap-0.5"><CheckCircle2 className="h-2.5 w-2.5" />אשר</div>
              <div className="h-6 px-1.5 rounded bg-muted text-[10px] flex items-center gap-0.5"><Pencil className="h-2.5 w-2.5" />ערוך</div>
            </div>
          </div>
        </div>
      ))}
      <div className="p-2.5 rounded-lg bg-amber-50 border border-amber-200 text-amber-800 text-[11px]">
        בחר כמה חשבוניות ואשר או מחק בבת אחת עם Bulk Actions
      </div>
    </div>
  );
}

function DemoDashboard() {
  return (
    <div className="space-y-3">
      <div className="grid grid-cols-4 gap-2">
        {mockCards.map((c) => (
          <div key={c.title} className="relative overflow-hidden rounded-lg bg-card border border-border/50 p-2 shadow-sm">
            <div className={`absolute top-0 left-0 right-0 h-0.5 bg-gradient-to-l ${c.gradient}`} />
            <p className="text-[10px] text-muted-foreground">{c.title}</p>
            <p className="text-base font-bold">{c.value}</p>
          </div>
        ))}
      </div>
      <div className="grid grid-cols-2 gap-2">
        <div className="rounded-lg bg-card border border-border/50 p-3 h-24 flex items-center justify-center text-muted-foreground text-[11px]">
          📊 הוצאות לפי קטגוריה
        </div>
        <div className="rounded-lg bg-card border border-border/50 p-3 h-24 flex items-center justify-center text-muted-foreground text-[11px]">
          📈 הוצאות חודשיות
        </div>
      </div>
    </div>
  );
}

function DemoInvoices() {
  return (
    <div className="space-y-2">
      <div className="flex items-center gap-2">
        <div className="flex-1 h-7 rounded-lg border border-input bg-background px-2 text-[11px] flex items-center text-muted-foreground">
          🔍 חיפוש לפי שם ספק...
        </div>
        <div className="h-7 px-2 rounded-lg border border-input bg-background text-[11px] flex items-center gap-1">
          <Download className="h-3 w-3" /> CSV
        </div>
      </div>
      {mockInvoices.map((inv, i) => (
        <div key={i} className="flex items-center justify-between p-2.5 rounded-lg bg-card border border-emerald-200">
          <div className="flex items-center gap-2">
            <span className="text-xs font-medium">{inv.vendor}</span>
            <span className="text-[10px] bg-emerald-100 text-emerald-700 px-1.5 py-0.5 rounded">מאושר</span>
          </div>
          <span className="text-xs font-bold">₪{inv.amount}</span>
        </div>
      ))}
    </div>
  );
}

function DemoSync() {
  return (
    <div className="flex flex-col items-center justify-center py-4 text-center space-y-4">
      <div className="flex items-center gap-6">
        <div className="flex flex-col items-center gap-1">
          <div className="w-12 h-12 rounded-xl bg-muted/50 flex items-center justify-center">💻</div>
          <span className="text-[10px] text-muted-foreground">מחשב</span>
        </div>
        <div className="flex flex-col items-center gap-1">
          <RefreshCw className="h-5 w-5 text-primary animate-spin" style={{ animationDuration: '3s' }} />
          <span className="text-[10px] text-primary font-medium">מסונכרן</span>
        </div>
        <div className="flex flex-col items-center gap-1">
          <div className="w-12 h-12 rounded-xl bg-muted/50 flex items-center justify-center">📱</div>
          <span className="text-[10px] text-muted-foreground">טלפון</span>
        </div>
      </div>
      <div className="grid grid-cols-2 gap-2 w-full max-w-xs text-[11px]">
        <div className="p-2 rounded-lg bg-muted/30 text-center">
          <Cloud className="h-4 w-4 mx-auto mb-1 text-sky-500" />
          <p className="font-medium">Cloudflare R2</p>
          <p className="text-muted-foreground">אחסון קבצים</p>
        </div>
        <div className="p-2 rounded-lg bg-muted/30 text-center">
          <div className="h-4 w-4 mx-auto mb-1 text-emerald-500 font-bold text-sm">🔒</div>
          <p className="font-medium">מאובטח</p>
          <p className="text-muted-foreground">Google OAuth</p>
        </div>
      </div>
    </div>
  );
}

const demoComponents: Record<string, () => React.ReactElement> = {
  welcome: DemoWelcome,
  gmail: DemoGmail,
  upload: DemoUpload,
  pending: DemoPending,
  dashboard: DemoDashboard,
  invoices: DemoInvoices,
  sync: DemoSync,
};

export default function TourPage() {
  const [step, setStep] = useState(0);
  const router = useRouter();
  const slide = tourSlides[step];
  const DemoComponent = demoComponents[slide.demo];
  const isLast = step === tourSlides.length - 1;

  return (
    <div className="min-h-screen bg-background flex flex-col">
      {/* Gradient banner */}
      <div className={`bg-gradient-to-l ${slide.color} text-white text-center py-2.5 text-sm font-medium transition-all`}>
        🎯 סיור באפליקציה ({step + 1}/{tourSlides.length})
      </div>

      <div className="flex-1 flex items-center justify-center p-3 sm:p-4">
        <div className="w-full max-w-lg space-y-4">
          {/* Step info */}
          <div className="flex items-center gap-3">
            <div className={`flex items-center justify-center w-11 h-11 sm:w-14 sm:h-14 rounded-2xl bg-gradient-to-bl ${slide.color} text-white shrink-0`}>
              <slide.icon className="h-6 w-6 sm:h-7 sm:w-7" />
            </div>
            <div className="flex-1 min-w-0">
              <h2 className="text-base sm:text-xl font-bold">{slide.title}</h2>
              <p className="text-xs sm:text-sm text-muted-foreground leading-relaxed">{slide.description}</p>
            </div>
          </div>

          {/* Demo preview */}
          <div className="rounded-2xl bg-muted/20 border border-border p-3 sm:p-4">
            <DemoComponent />
          </div>

          {/* Progress bar */}
          <div className="w-full h-1 bg-muted rounded-full">
            <div
              className={`h-1 bg-gradient-to-l ${slide.color} rounded-full transition-all duration-300`}
              style={{ width: `${((step + 1) / tourSlides.length) * 100}%` }}
            />
          </div>

          {/* Navigation */}
          <div className="flex items-center justify-between">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => router.push("/")}
            >
              <X className="h-4 w-4 ml-1" />
              חזרה
            </Button>
            <div className="flex gap-2">
              {step > 0 && (
                <Button variant="outline" size="sm" onClick={() => setStep(step - 1)}>
                  <ChevronRight className="h-4 w-4 ml-1" />
                  הקודם
                </Button>
              )}
              {!isLast ? (
                <Button size="sm" onClick={() => setStep(step + 1)}>
                  הבא
                  <ChevronLeft className="h-4 w-4 mr-1" />
                </Button>
              ) : (
                <Button size="sm" onClick={() => router.push("/")} className={`bg-gradient-to-l ${slide.color}`}>
                  <Sparkles className="h-4 w-4 ml-1" />
                  יאללה!
                </Button>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
