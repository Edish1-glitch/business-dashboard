"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { Sparkles, X } from "lucide-react";
import { Button } from "@/components/ui/button";

export function Onboarding() {
  const [show, setShow] = useState(false);
  const router = useRouter();

  useEffect(() => {
    const seen = localStorage.getItem("findash-onboarding-v3");
    if (!seen) setShow(true);
  }, []);

  const dismiss = () => {
    setShow(false);
    localStorage.setItem("findash-onboarding-v3", "true");
  };

  const startTour = () => {
    dismiss();
    router.push("/tour");
  };

  if (!show) return null;

  return (
    <div className="fixed inset-0 z-[200] flex items-end sm:items-center justify-center bg-black/60 backdrop-blur-sm">
      <div className="bg-card rounded-t-3xl sm:rounded-2xl shadow-2xl w-full sm:max-w-sm mx-auto overflow-hidden">
        <div className="relative bg-gradient-to-bl from-primary/20 to-violet-500/20 px-6 pt-8 pb-6">
          <button
            onClick={dismiss}
            className="absolute top-3 left-3 p-1.5 rounded-full bg-background/50 text-muted-foreground hover:text-foreground hover:bg-background/80 transition-colors"
          >
            <X className="h-4 w-4" />
          </button>
          <div className="flex flex-col items-center text-center gap-3">
            <div className="flex items-center justify-center w-14 h-14 rounded-2xl bg-background/80 text-primary">
              <Sparkles className="h-7 w-7" />
            </div>
            <h3 className="text-lg font-bold">ברוך הבא ל-FinDash!</h3>
          </div>
        </div>
        <div className="px-6 py-5 space-y-4">
          <p className="text-sm text-muted-foreground text-center leading-relaxed">
            הדאשבורד שלך לניהול חשבוניות והוצאות. רוצה סיור קצר שמראה לך מה יש פה?
          </p>
          <div className="flex gap-2">
            <Button variant="ghost" size="sm" onClick={dismiss} className="flex-1 text-muted-foreground">
              אני מסתדר
            </Button>
            <Button size="sm" onClick={startTour} className="flex-1 gap-1.5">
              <Sparkles className="h-3.5 w-3.5" />
              קח אותי לסיור
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}
