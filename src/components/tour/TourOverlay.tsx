"use client";

import { useEffect, useState, useRef } from "react";
import { useRouter, usePathname } from "next/navigation";
import { useTour } from "./TourProvider";
import { X, ChevronLeft, ChevronRight } from "lucide-react";
import { Button } from "@/components/ui/button";

export function TourOverlay() {
  const { isTouring, currentStep, steps, currentStepData, nextStep, prevStep, endTour } = useTour();
  const router = useRouter();
  const pathname = usePathname();
  const [targetRect, setTargetRect] = useState<DOMRect | null>(null);
  const overlayRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!isTouring || !currentStepData) return;

    // Navigate to the correct page if needed
    if (currentStepData.page !== pathname) {
      router.push(currentStepData.page);
      return;
    }

    // Find target element and get its position
    const findTarget = () => {
      const el = document.querySelector(currentStepData.target);
      if (el) {
        const rect = el.getBoundingClientRect();
        setTargetRect(rect);
        el.scrollIntoView({ behavior: "smooth", block: "center" });
      } else {
        setTargetRect(null);
      }
    };

    // Wait for page to render
    const timer = setTimeout(findTarget, 500);
    return () => clearTimeout(timer);
  }, [isTouring, currentStep, currentStepData, pathname, router]);

  if (!isTouring || !currentStepData) return null;

  const padding = 8;
  const spotlightStyle = targetRect
    ? {
        top: targetRect.top - padding + window.scrollY,
        left: targetRect.left - padding,
        width: targetRect.width + padding * 2,
        height: targetRect.height + padding * 2,
      }
    : null;

  // Tooltip position
  const tooltipTop = spotlightStyle
    ? spotlightStyle.top + spotlightStyle.height + 16
    : window.innerHeight / 2 - 100;
  const tooltipLeft = spotlightStyle
    ? Math.min(Math.max(spotlightStyle.left, 16), window.innerWidth - 350)
    : window.innerWidth / 2 - 175;

  return (
    <div ref={overlayRef} className="fixed inset-0 z-[300]" style={{ pointerEvents: "none" }}>
      {/* Dark overlay with cutout */}
      <svg className="fixed inset-0 w-full h-full" style={{ pointerEvents: "auto" }}>
        <defs>
          <mask id="spotlight-mask">
            <rect width="100%" height="100%" fill="white" />
            {spotlightStyle && (
              <rect
                x={spotlightStyle.left}
                y={spotlightStyle.top}
                width={spotlightStyle.width}
                height={spotlightStyle.height}
                rx={12}
                fill="black"
              />
            )}
          </mask>
        </defs>
        <rect
          width="100%"
          height="100%"
          fill="rgba(0,0,0,0.6)"
          mask="url(#spotlight-mask)"
        />
        {/* Spotlight border */}
        {spotlightStyle && (
          <rect
            x={spotlightStyle.left}
            y={spotlightStyle.top}
            width={spotlightStyle.width}
            height={spotlightStyle.height}
            rx={12}
            fill="none"
            stroke="#8b5cf6"
            strokeWidth={2}
          />
        )}
      </svg>

      {/* Tooltip */}
      <div
        className="fixed bg-card border border-border rounded-2xl shadow-2xl p-5 max-w-[340px] z-[301]"
        style={{
          top: `${Math.min(tooltipTop, window.innerHeight - 250)}px`,
          left: `${tooltipLeft}px`,
          pointerEvents: "auto",
        }}
      >
        {/* Demo badge */}
        <div className="flex items-center justify-between mb-3">
          <span className="text-xs bg-violet-100 text-violet-700 px-2 py-0.5 rounded-full font-medium">
            סיור באפליקציה
          </span>
          <span className="text-xs text-muted-foreground">
            {currentStep + 1} / {steps.length}
          </span>
        </div>

        <h3 className="font-bold text-base mb-1">{currentStepData.title}</h3>
        <p className="text-sm text-muted-foreground mb-4">{currentStepData.content}</p>

        {/* Progress bar */}
        <div className="w-full h-1 bg-muted rounded-full mb-4">
          <div
            className="h-1 bg-primary rounded-full transition-all"
            style={{ width: `${((currentStep + 1) / steps.length) * 100}%` }}
          />
        </div>

        {/* Actions */}
        <div className="flex items-center justify-between">
          <Button variant="ghost" size="sm" onClick={endTour}>
            <X className="h-4 w-4 ml-1" />
            סיום
          </Button>
          <div className="flex gap-2">
            {currentStep > 0 && (
              <Button variant="outline" size="sm" onClick={prevStep}>
                <ChevronRight className="h-4 w-4" />
              </Button>
            )}
            <Button size="sm" onClick={nextStep}>
              {currentStep < steps.length - 1 ? (
                <>
                  הבא
                  <ChevronLeft className="h-4 w-4" />
                </>
              ) : (
                "סיום הסיור"
              )}
            </Button>
          </div>
        </div>
      </div>

      {/* Demo banner */}
      <div
        className="fixed top-0 left-0 right-0 bg-violet-600 text-white text-center py-2 text-sm font-medium z-[302]"
        style={{ pointerEvents: "auto" }}
      >
        🎯 מצב דמו - סיור באפליקציה |{" "}
        <button onClick={endTour} className="underline hover:no-underline">
          סיים סיור
        </button>
      </div>
    </div>
  );
}
