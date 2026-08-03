"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { Sparkles, X, Bell, Briefcase, Mail } from "lucide-react";
import { Button } from "@/components/ui/button";

export function Onboarding() {
  const [show, setShow] = useState(false);
  const router = useRouter();

  useEffect(() => {
    // bumped to v4 so returning users see the refreshed tour with the new features
    const seen = localStorage.getItem("findash-onboarding-v4");
    if (!seen) setShow(true);
  }, []);

  const dismiss = () => {
    setShow(false);
    localStorage.setItem("findash-onboarding-v4", "true");
  };

  const startTour = () => {
    dismiss();
    router.push("/tour");
  };

  if (!show) return null;

  return (
    <div className="fixed inset-0 z-[200] flex items-end sm:items-center justify-center bg-black/50 backdrop-blur-sm p-0 sm:p-4">
      <div className="glass rounded-t-3xl sm:rounded-3xl shadow-2xl w-full sm:max-w-sm overflow-hidden">
        {/* gradient header */}
        <div className="relative hero-grad hero-gloss px-6 pt-8 pb-6 text-white text-center">
          <button
            onClick={dismiss}
            className="absolute top-3 left-3 p-1.5 rounded-full bg-white/20 text-white/90 hover:bg-white/30 transition-colors"
            aria-label="סגור"
          >
            <X className="h-4 w-4" />
          </button>
          <div className="relative flex flex-col items-center gap-3">
            <div className="flex items-center justify-center w-14 h-14 rounded-2xl bg-white/20 backdrop-blur">
              <Sparkles className="h-7 w-7" />
            </div>
            <h3 className="text-lg font-black">ברוך הבא ל-FinDash!</h3>
          </div>
        </div>

        <div className="px-6 py-5 space-y-4">
          <p className="text-sm text-muted-foreground text-center leading-relaxed">
            ניהול חשבוניות והוצאות — אוטומטי וחכם. עכשיו עם כמה דברים חדשים:
          </p>
          <div className="grid grid-cols-3 gap-2 text-center">
            <div className="glass rounded-xl p-2.5">
              <Bell className="h-5 w-5 mx-auto mb-1 text-violet-500" />
              <p className="text-[10px] text-muted-foreground leading-tight">התראה על כל חשבונית</p>
            </div>
            <div className="glass rounded-xl p-2.5">
              <Briefcase className="h-5 w-5 mx-auto mb-1 text-amber-500" />
              <p className="text-[10px] text-muted-foreground leading-tight">עסקי / פרטי</p>
            </div>
            <div className="glass rounded-xl p-2.5">
              <Mail className="h-5 w-5 mx-auto mb-1 text-rose-500" />
              <p className="text-[10px] text-muted-foreground leading-tight">סנכרון Gmail אוטומטי</p>
            </div>
          </div>
          <div className="flex gap-2">
            <Button variant="ghost" size="sm" onClick={dismiss} className="flex-1 text-muted-foreground">
              אני מסתדר
            </Button>
            <Button size="sm" onClick={startTour} className="flex-1 gap-1.5 hero-grad text-white border-0">
              <Sparkles className="h-3.5 w-3.5" />
              קח אותי לסיור
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}
