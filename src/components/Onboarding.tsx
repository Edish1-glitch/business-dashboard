"use client";

import { useState, useEffect } from "react";
import { Upload, CheckCircle2, BarChart3, X } from "lucide-react";
import { Button } from "@/components/ui/button";

const steps = [
  {
    icon: Upload,
    title: "העלה חשבוניות",
    description: "העלה קבצי PDF או צלם חשבוניות מהמצלמה. המערכת תזהה אוטומטית את הספק, הסכום והקטגוריה.",
    color: "bg-blue-100 text-blue-600",
  },
  {
    icon: CheckCircle2,
    title: "אשר ובדוק",
    description: "בדוק שהנתונים נכונים, ערוך במידת הצורך, ואשר. רק חשבוניות מאושרות נכנסות לחישוב.",
    color: "bg-emerald-100 text-emerald-600",
  },
  {
    icon: BarChart3,
    title: "עקוב אחרי ההוצאות",
    description: "צפה בגרפים, סנן לפי תאריכים וקטגוריות, וייצא לאקסל. הכל במקום אחד.",
    color: "bg-violet-100 text-violet-600",
  },
];

export function Onboarding() {
  const [show, setShow] = useState(false);
  const [step, setStep] = useState(0);

  useEffect(() => {
    const seen = localStorage.getItem("findash-onboarding-seen");
    if (!seen) setShow(true);
  }, []);

  const dismiss = () => {
    setShow(false);
    localStorage.setItem("findash-onboarding-seen", "true");
  };

  if (!show) return null;

  return (
    <div className="fixed inset-0 z-[200] flex items-center justify-center p-4 bg-black/50">
      <div className="bg-card rounded-2xl shadow-2xl max-w-md w-full p-6 space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-bold">ברוך הבא ל-FinDash!</h2>
          <button onClick={dismiss} className="text-muted-foreground hover:text-foreground">
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Step content */}
        <div className="text-center space-y-4">
          <div className={`flex items-center justify-center w-16 h-16 rounded-2xl mx-auto ${steps[step].color}`}>
            {(() => { const Icon = steps[step].icon; return <Icon className="h-8 w-8" />; })()}
          </div>
          <h3 className="text-base font-semibold">{steps[step].title}</h3>
          <p className="text-sm text-muted-foreground">{steps[step].description}</p>
        </div>

        {/* Progress dots */}
        <div className="flex items-center justify-center gap-2">
          {steps.map((_, i) => (
            <div
              key={i}
              className={`w-2 h-2 rounded-full transition-all ${i === step ? "bg-primary w-6" : "bg-muted"}`}
            />
          ))}
        </div>

        {/* Actions */}
        <div className="flex gap-2">
          {step < steps.length - 1 ? (
            <>
              <Button variant="ghost" size="sm" onClick={dismiss} className="flex-1">
                דלג
              </Button>
              <Button size="sm" onClick={() => setStep(step + 1)} className="flex-1">
                הבא
              </Button>
            </>
          ) : (
            <Button size="sm" onClick={dismiss} className="w-full">
              בוא נתחיל!
            </Button>
          )}
        </div>
      </div>
    </div>
  );
}
