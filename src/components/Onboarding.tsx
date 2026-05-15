"use client";

import { useState, useEffect } from "react";
import { Upload, CheckCircle2, BarChart3, X, Mail, Cloud, Shield, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";

const steps = [
  {
    icon: Sparkles,
    title: "ברוך הבא ל-FinDash",
    description: "הדאשבורד שלך לניהול חשבוניות והוצאות. הכל במקום אחד - חכם, מהיר ואוטומטי.",
    color: "from-primary/20 to-violet-500/20",
    iconColor: "text-primary",
  },
  {
    icon: Mail,
    title: "חבר את ה-Gmail שלך",
    description: "חבר חשבונות Gmail ומשוך חשבוניות אוטומטית מצרופות מיילים. תומך בחשבוניות ישראליות ובינלאומיות.",
    color: "from-red-500/20 to-orange-500/20",
    iconColor: "text-red-500",
  },
  {
    icon: Upload,
    title: "העלה חשבוניות",
    description: "העלה PDF, צלם מהמצלמה או גרור קבצים. המערכת מזהה אוטומטית ספק, סכום, תאריך וקטגוריה באמצעות OCR.",
    color: "from-blue-500/20 to-cyan-500/20",
    iconColor: "text-blue-500",
  },
  {
    icon: CheckCircle2,
    title: "בדוק ואשר",
    description: "בדוק את החשבוניות, ערוך במידת הצורך, ואשר בודדות או הכל בבת אחת. מחיקה ועריכה בלחיצה.",
    color: "from-emerald-500/20 to-green-500/20",
    iconColor: "text-emerald-500",
  },
  {
    icon: BarChart3,
    title: "עקוב אחרי ההוצאות",
    description: "דאשבורד עם גרפים, סינון לפי תאריכים וקטגוריות, וייצוא ל-CSV. צפה בתמונה המלאה.",
    color: "from-violet-500/20 to-purple-500/20",
    iconColor: "text-violet-500",
  },
  {
    icon: Cloud,
    title: "מסונכרן בכל מקום",
    description: "הנתונים שלך מסונכרנים בין המחשב לטלפון. קבצים מאוחסנים בענן בצורה מאובטחת.",
    color: "from-sky-500/20 to-blue-500/20",
    iconColor: "text-sky-500",
  },
];

export function Onboarding() {
  const [show, setShow] = useState(false);
  const [step, setStep] = useState(0);

  useEffect(() => {
    const seen = localStorage.getItem("findash-onboarding-v2");
    if (!seen) setShow(true);
  }, []);

  const dismiss = () => {
    setShow(false);
    localStorage.setItem("findash-onboarding-v2", "true");
  };

  if (!show) return null;

  const current = steps[step];
  const isLast = step === steps.length - 1;

  return (
    <div className="fixed inset-0 z-[200] flex items-end sm:items-center justify-center bg-black/60 backdrop-blur-sm">
      <div className="bg-card rounded-t-3xl sm:rounded-2xl shadow-2xl w-full sm:max-w-sm mx-auto overflow-hidden">
        {/* Gradient header */}
        <div className={`relative bg-gradient-to-bl ${current.color} px-6 pt-8 pb-6`}>
          <button
            onClick={dismiss}
            className="absolute top-3 left-3 p-1.5 rounded-full bg-background/50 text-muted-foreground hover:text-foreground hover:bg-background/80 transition-colors"
          >
            <X className="h-4 w-4" />
          </button>

          <div className="flex flex-col items-center text-center gap-3">
            <div className={`flex items-center justify-center w-14 h-14 rounded-2xl bg-background/80 ${current.iconColor}`}>
              {(() => { const Icon = current.icon; return <Icon className="h-7 w-7" />; })()}
            </div>
            <h3 className="text-lg font-bold">{current.title}</h3>
          </div>
        </div>

        {/* Body */}
        <div className="px-6 py-5 space-y-5">
          <p className="text-sm text-muted-foreground text-center leading-relaxed">
            {current.description}
          </p>

          {/* Progress dots */}
          <div className="flex items-center justify-center gap-1.5">
            {steps.map((_, i) => (
              <button
                key={i}
                onClick={() => setStep(i)}
                className={`rounded-full transition-all ${
                  i === step
                    ? "bg-primary w-5 h-2"
                    : i < step
                    ? "bg-primary/40 w-2 h-2"
                    : "bg-muted w-2 h-2"
                }`}
              />
            ))}
          </div>

          {/* Actions */}
          <div className="flex gap-2">
            {!isLast ? (
              <>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={dismiss}
                  className="flex-1 text-muted-foreground"
                >
                  דלג
                </Button>
                <Button size="sm" onClick={() => setStep(step + 1)} className="flex-1">
                  הבא
                </Button>
              </>
            ) : (
              <Button size="sm" onClick={dismiss} className="w-full">
                יאללה, בוא נתחיל!
              </Button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
