"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import {
  Receipt, Upload, CheckCircle2, BarChart3,
  ChevronLeft, ChevronRight, X, Sparkles, Mail, Cloud,
  CheckCheck, ClipboardCheck, CreditCard,
  RefreshCw, Pencil, Trash2,
  Bell, Briefcase, Lock, ShieldCheck, Smartphone, Monitor, Send,
} from "lucide-react";
import { Button } from "@/components/ui/button";

const tourSlides = [
  { title: "ברוך הבא ל-FinDash", description: "ניהול חשבוניות והוצאות — אוטומטי, חכם ובעברית. בוא נראה מה יש (וכמה חדש).", icon: Sparkles, color: "from-indigo-500 via-violet-500 to-fuchsia-500", demo: "welcome" },
  { title: "חבר את ה-Gmail", description: "משוך חשבוניות אוטומטית ממיילים — ישראליות ובינלאומיות, עם זיהוי חכם.", icon: Mail, color: "from-rose-500 to-orange-500", demo: "gmail" },
  { title: "התראה על כל חשבונית חדשה", description: "ברגע שנכנסת חשבונית — קופצת התראה לטלפון: אַשר ושלח לרו״ח, ערוך, או סמן כפרטי. סנכרון רקע אוטומטי כל 15 דק׳.", icon: Bell, color: "from-violet-500 to-fuchsia-500", demo: "notifications" },
  { title: "העלאה + זיהוי אוטומטי", description: "צלם, בחר קובץ או גרור. OCR מזהה ספק, סכום, תאריך וקטגוריה — בעברית ובאנגלית.", icon: Upload, color: "from-blue-500 to-cyan-500", demo: "upload" },
  { title: "בדוק ואשר", description: "כל חשבונית עוברת בדיקה לפני החישוב. אשר, ערוך או מחק — בודדות או בכמות.", icon: CheckCircle2, color: "from-emerald-500 to-green-500", demo: "pending" },
  { title: "עסקי או פרטי", description: "סווג כל הוצאה — מה שמתקזז (עסקי) ומה שלא (פרטי). הדשבורד מפריד אוטומטית.", icon: Briefcase, color: "from-amber-500 to-yellow-500", demo: "business" },
  { title: "דאשבורד במבט אחד", description: "סה״כ הוצאות עם פירוט עסקי/פרטי, גרפים לפי קטגוריה וחודש, וחשבוניות אחרונות.", icon: BarChart3, color: "from-violet-500 to-purple-500", demo: "dashboard" },
  { title: "מאובטח ומחובר", description: "סנכרון בין הטלפון למחשב, אחסון מאובטח בענן, וניהול המכשירים המחוברים — נתק כל מכשיר שלא מזוהה.", icon: ShieldCheck, color: "from-sky-500 to-blue-500", demo: "secure" },
];

const mockInvoices = [
  { vendor: "פז חברת נפט", amount: 49.12, date: "14.1.2024", category: "דלק", catColor: "bg-orange-100 text-orange-700" },
  { vendor: "רמי לוי", amount: 312.5, date: "12.1.2024", category: "סופר", catColor: "bg-green-100 text-green-700" },
  { vendor: "סלקום", amount: 89.9, date: "10.1.2024", category: "תקשורת", catColor: "bg-cyan-100 text-cyan-700" },
];

function DemoWelcome() {
  const pills = [
    { Icon: Mail, label: "Gmail", tint: "text-rose-500" },
    { Icon: Bell, label: "התראות", tint: "text-violet-500" },
    { Icon: Briefcase, label: "עסקי/פרטי", tint: "text-amber-500" },
    { Icon: BarChart3, label: "דאשבורד", tint: "text-indigo-500" },
  ];
  return (
    <div className="flex flex-col items-center justify-center py-4 text-center space-y-4">
      <div className="w-20 h-20 rounded-3xl hero-grad flex items-center justify-center text-white shadow-lg">
        <Receipt className="h-10 w-10" />
      </div>
      <h3 className="text-lg font-black">FinDash</h3>
      <div className="grid grid-cols-4 gap-2 w-full">
        {pills.map((p) => (
          <div key={p.label} className="glass rounded-xl p-2.5 text-center">
            <p.Icon className={`h-5 w-5 mx-auto mb-1 ${p.tint}`} />
            <p className="text-[9px] text-muted-foreground">{p.label}</p>
          </div>
        ))}
      </div>
    </div>
  );
}

function DemoGmail() {
  return (
    <div className="space-y-3">
      <div className="glass rounded-2xl p-3 flex items-center justify-between">
        <div className="space-y-0.5">
          <p className="text-sm font-medium">user@gmail.com</p>
          <p className="text-[11px] text-muted-foreground">סנכרון אחרון: היום</p>
        </div>
        <div className="flex gap-1">
          <div className="h-7 w-7 rounded-lg bg-primary/10 flex items-center justify-center"><RefreshCw className="h-3.5 w-3.5 text-primary" /></div>
          <div className="h-7 w-7 rounded-lg bg-rose-500/10 flex items-center justify-center"><Trash2 className="h-3.5 w-3.5 text-rose-500" /></div>
        </div>
      </div>
      <div className="glass rounded-2xl p-3 space-y-2">
        <p className="text-[11px] text-muted-foreground">מעבד מייל 245 מתוך 426…</p>
        <div className="w-full h-1.5 rounded-full bg-muted/60 overflow-hidden"><div className="h-full rounded-full hero-grad w-[57%]" /></div>
        <p className="text-[11px] font-medium">412 חשבוניות נמצאו</p>
      </div>
    </div>
  );
}

function DemoNotifications() {
  return (
    <div className="space-y-3">
      <div className="glass rounded-2xl p-3 flex items-start gap-3">
        <div className="w-9 h-9 rounded-xl bg-primary/15 flex items-center justify-center shrink-0"><Bell className="h-4 w-4 text-primary" /></div>
        <div className="flex-1">
          <div className="flex items-center justify-between"><span className="text-[13px] font-bold">חשבונית חדשה</span><span className="text-[10px] text-muted-foreground">עכשיו</span></div>
          <p className="text-[11.5px] text-muted-foreground">רמי לוי · ₪47.65</p>
        </div>
      </div>
      <div className="grid grid-cols-3 gap-2">
        <div className="h-9 rounded-xl text-white text-[12px] font-semibold flex items-center justify-center gap-1" style={{ background: "linear-gradient(135deg,#10b981,#059669)" }}><CheckCircle2 className="h-3.5 w-3.5" />אשר</div>
        <div className="h-9 rounded-xl glass text-[12px] font-semibold flex items-center justify-center gap-1"><Pencil className="h-3.5 w-3.5" />ערוך</div>
        <div className="h-9 rounded-xl bg-muted/70 text-[12px] font-semibold flex items-center justify-center gap-1"><Lock className="h-3.5 w-3.5" />פרטי</div>
      </div>
      <div className="p-2.5 rounded-xl bg-violet-500/10 text-violet-700 dark:text-violet-300 text-[11px] flex items-center gap-1.5">
        <RefreshCw className="h-3.5 w-3.5 shrink-0" /> סנכרון רקע כל 15 דק׳ — בלי לפתוח את האפליקציה
      </div>
    </div>
  );
}

function DemoUpload() {
  return (
    <div className="space-y-3">
      <div className="glass rounded-2xl p-6 flex flex-col items-center justify-center text-center" style={{ borderStyle: "dashed", borderWidth: 2, borderColor: "rgba(139,92,246,.35)" }}>
        <div className="w-12 h-12 rounded-2xl hero-grad flex items-center justify-center text-white mb-2"><Upload className="h-6 w-6" /></div>
        <p className="text-sm font-bold">בחר קבצים להעלאה</p>
        <div className="flex gap-1.5 mt-2">
          {["PDF", "JPG / PNG", "צילום"].map((t) => <span key={t} className="text-[10px] glass px-2 py-0.5 rounded-full">{t}</span>)}
        </div>
      </div>
      <div className="p-2.5 rounded-xl bg-blue-500/10 text-blue-700 dark:text-blue-300 text-[11px]">OCR אוטומטי: ספק, סכום, תאריך, קטגוריה וכרטיס אשראי</div>
    </div>
  );
}

function DemoPending() {
  return (
    <div className="space-y-2">
      {mockInvoices.map((inv, i) => (
        <div key={i} className="glass rounded-xl p-2.5 flex items-center justify-between">
          <div className="flex items-center gap-2 min-w-0">
            <span className="text-xs font-semibold truncate">{inv.vendor}</span>
            <span className={`text-[10px] px-1.5 py-0.5 rounded ${inv.catColor}`}>{inv.category}</span>
          </div>
          <div className="flex items-center gap-1.5 shrink-0">
            <span className="text-xs font-bold tnum">₪{inv.amount}</span>
            <div className="h-6 w-6 rounded-lg text-white flex items-center justify-center" style={{ background: "linear-gradient(135deg,#10b981,#059669)" }}><CheckCircle2 className="h-3.5 w-3.5" /></div>
          </div>
        </div>
      ))}
      <div className="p-2.5 rounded-xl bg-amber-500/10 text-amber-700 dark:text-amber-300 text-[11px] flex items-center gap-1.5"><CheckCheck className="h-3.5 w-3.5 shrink-0" /> בחר כמה ואשר/מחק בבת אחת</div>
    </div>
  );
}

function DemoBusiness() {
  return (
    <div className="space-y-3">
      <div className="glass rounded-2xl p-3">
        <p className="text-[11px] text-muted-foreground mb-2">סיווג ההוצאה</p>
        <div className="grid grid-cols-2 gap-2">
          <div className="h-9 rounded-xl text-white text-[12px] font-semibold flex items-center justify-center gap-1.5" style={{ background: "linear-gradient(135deg,#10b981,#059669)" }}><Briefcase className="h-3.5 w-3.5" />עסקי</div>
          <div className="h-9 rounded-xl glass text-muted-foreground text-[12px] font-semibold flex items-center justify-center gap-1.5"><Lock className="h-3.5 w-3.5" />פרטי</div>
        </div>
      </div>
      <div className="hero-grad rounded-2xl p-4 text-white text-center relative overflow-hidden">
        <p className="text-[10px] text-white/70">סה״כ הוצאות</p>
        <p className="text-2xl font-black tnum leading-none mt-0.5">₪4,230</p>
        <div className="grid grid-cols-2 gap-2 mt-3">
          <div className="rounded-xl px-2 py-1.5" style={{ background: "rgba(255,255,255,.16)" }}><p className="text-[9px] text-white/70">עסקי</p><p className="text-[13px] font-bold tnum">₪3,180</p></div>
          <div className="rounded-xl px-2 py-1.5" style={{ background: "rgba(255,255,255,.16)" }}><p className="text-[9px] text-white/70">פרטי</p><p className="text-[13px] font-bold tnum">₪1,050</p></div>
        </div>
      </div>
    </div>
  );
}

function DemoDashboard() {
  const tiles = [
    { label: "מאושרות", value: "24", Icon: CheckCircle2, tint: "bg-emerald-500/15 text-emerald-600" },
    { label: "ממתינות", value: "3", Icon: ClipboardCheck, tint: "bg-amber-500/15 text-amber-600" },
    { label: "כרטיסים", value: "2", Icon: CreditCard, tint: "bg-violet-500/15 text-violet-600" },
  ];
  return (
    <div className="space-y-2.5">
      <div className="hero-grad rounded-2xl p-4 text-white text-center">
        <p className="text-[10px] text-white/70">סה״כ הוצאות · הכל</p>
        <p className="text-2xl font-black tnum leading-none mt-0.5">₪4,230</p>
      </div>
      <div className="grid grid-cols-3 gap-2">
        {tiles.map((t) => (
          <div key={t.label} className="glass rounded-xl p-2.5 text-center">
            <div className={`w-7 h-7 rounded-lg mx-auto mb-1 flex items-center justify-center ${t.tint}`}><t.Icon className="h-4 w-4" /></div>
            <p className="text-lg font-black tnum leading-none">{t.value}</p>
            <p className="text-[9px] text-muted-foreground mt-0.5">{t.label}</p>
          </div>
        ))}
      </div>
      <div className="grid grid-cols-2 gap-2">
        <div className="glass rounded-xl h-20 flex items-center justify-center text-muted-foreground text-[11px]">📊 לפי קטגוריה</div>
        <div className="glass rounded-xl h-20 flex items-center justify-center text-muted-foreground text-[11px]">📈 חודשי</div>
      </div>
    </div>
  );
}

function DemoSecure() {
  return (
    <div className="space-y-3">
      <div className="glass rounded-2xl p-3 space-y-2">
        <p className="text-[11px] font-bold">מכשירים מחוברים</p>
        <div className="flex items-center gap-2 text-[11.5px]">
          <div className="w-7 h-7 rounded-lg bg-primary/10 flex items-center justify-center"><Smartphone className="h-3.5 w-3.5 text-primary" /></div>
          <span className="font-medium">Safari · iPhone</span>
          <span className="text-[9px] bg-emerald-500/15 text-emerald-600 rounded-full px-1.5 py-0.5 font-bold">הנוכחי</span>
        </div>
        <div className="flex items-center justify-between text-[11.5px]">
          <span className="flex items-center gap-2"><div className="w-7 h-7 rounded-lg bg-primary/10 flex items-center justify-center"><Monitor className="h-3.5 w-3.5 text-primary" /></div><span className="font-medium">Chrome · Mac</span></span>
          <span className="text-rose-500 font-semibold">נתק</span>
        </div>
      </div>
      <div className="grid grid-cols-2 gap-2 text-[11px]">
        <div className="glass rounded-xl p-2.5 text-center"><Cloud className="h-4 w-4 mx-auto mb-1 text-sky-500" /><p className="font-medium">אחסון בענן</p></div>
        <div className="glass rounded-xl p-2.5 text-center"><Send className="h-4 w-4 mx-auto mb-1 text-emerald-500" /><p className="font-medium">שליחה לרו״ח</p></div>
      </div>
    </div>
  );
}

const demoComponents: Record<string, () => React.ReactElement> = {
  welcome: DemoWelcome,
  gmail: DemoGmail,
  notifications: DemoNotifications,
  upload: DemoUpload,
  pending: DemoPending,
  business: DemoBusiness,
  dashboard: DemoDashboard,
  secure: DemoSecure,
};

export default function TourPage() {
  const [step, setStep] = useState(0);
  const router = useRouter();
  const slide = tourSlides[step];
  const DemoComponent = demoComponents[slide.demo];
  const isLast = step === tourSlides.length - 1;

  return (
    <div className="min-h-screen relative flex flex-col overflow-hidden">
      <div className="lg-canvas" aria-hidden>
        <div className="lg-blob" style={{ width: 300, height: 300, top: -90, insetInlineStart: -70, background: "#a78bfa", opacity: 0.16 }} />
        <div className="lg-blob" style={{ width: 260, height: 260, bottom: 60, insetInlineEnd: -90, background: "#f0abfc", opacity: 0.12 }} />
      </div>

      {/* progress banner — pad the notch so its colour fills the status-bar area */}
      <div
        className={`bg-gradient-to-l ${slide.color} text-white text-center py-2.5 text-sm font-semibold`}
        style={{ paddingTop: "calc(0.625rem + env(safe-area-inset-top))" }}
      >
        🎯 סיור מודרך ({step + 1}/{tourSlides.length})
      </div>

      <div className="flex-1 flex items-center justify-center p-4">
        <div className="w-full max-w-md space-y-4">
          {/* step header */}
          <div className="flex items-center gap-3">
            <div className={`flex items-center justify-center w-12 h-12 sm:w-14 sm:h-14 rounded-2xl bg-gradient-to-bl ${slide.color} text-white shrink-0 shadow-lg`}>
              <slide.icon className="h-6 w-6 sm:h-7 sm:w-7" />
            </div>
            <div className="flex-1 min-w-0">
              <h2 className="text-lg sm:text-xl font-black">{slide.title}</h2>
              <p className="text-xs sm:text-[13px] text-muted-foreground leading-relaxed">{slide.description}</p>
            </div>
          </div>

          {/* demo */}
          <div className="glass rounded-3xl p-4">
            <DemoComponent />
          </div>

          {/* progress dots */}
          <div className="flex items-center justify-center gap-1.5">
            {tourSlides.map((_, i) => (
              <div key={i} className={`h-1.5 rounded-full transition-all ${i === step ? "w-6 bg-primary" : "w-1.5 bg-muted-foreground/30"}`} />
            ))}
          </div>

          {/* nav */}
          <div className="flex items-center justify-between">
            <Button variant="ghost" size="sm" onClick={() => router.push("/")} className="text-muted-foreground">
              <X className="h-4 w-4 ml-1" /> דלג
            </Button>
            <div className="flex gap-2">
              {step > 0 && (
                <Button variant="outline" size="sm" onClick={() => setStep(step - 1)} className="glass border-0">
                  <ChevronRight className="h-4 w-4 ml-1" /> הקודם
                </Button>
              )}
              {!isLast ? (
                <Button size="sm" onClick={() => setStep(step + 1)}>
                  הבא <ChevronLeft className="h-4 w-4 mr-1" />
                </Button>
              ) : (
                <Button size="sm" onClick={() => router.push("/")} className="hero-grad text-white border-0">
                  <Sparkles className="h-4 w-4 ml-1" /> יאללה, מתחילים!
                </Button>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
