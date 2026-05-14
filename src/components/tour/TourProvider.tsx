"use client";

import { createContext, useContext, useState, useCallback } from "react";

export interface TourStep {
  target: string; // CSS selector
  title: string;
  content: string;
  page: string; // which page this step is on
  position?: "top" | "bottom" | "left" | "right";
}

const tourSteps: TourStep[] = [
  // Dashboard
  {
    target: "[data-tour='welcome-banner']",
    title: "ברוך הבא לדאשבורד",
    content: "כאן תראה סיכום של כל ההוצאות, גרפים ונתונים חשובים במבט אחד.",
    page: "/",
  },
  {
    target: "[data-tour='summary-cards']",
    title: "כרטיסי סיכום",
    content: "סה\"כ הוצאות, חשבוניות מאושרות, ממתינות לאישור, וכרטיסי אשראי - הכל בשורה אחת.",
    page: "/",
  },
  {
    target: "[data-tour='date-filter']",
    title: "סינון לפי תאריך",
    content: "בחר טווח תאריכים כדי לראות נתונים של תקופה מסוימת.",
    page: "/",
  },
  {
    target: "[data-tour='charts']",
    title: "גרפים",
    content: "גרף עוגה להוצאות לפי קטגוריה, וגרף עמודות להוצאות חודשיות.",
    page: "/",
  },
  // Upload
  {
    target: "[data-tour='upload-area']",
    title: "העלאת חשבוניות",
    content: "העלה PDF, תמונה מהגלריה, או צלם חשבונית. המערכת תזהה אוטומטית את הפרטים.",
    page: "/upload",
  },
  // Pending
  {
    target: "[data-tour='pending-list']",
    title: "ממתינות לאישור",
    content: "כאן תראה חשבוניות שהועלו וממתינות לבדיקה. תוכל לערוך, לאשר, או לדחות.",
    page: "/invoices/pending",
  },
  // Invoices
  {
    target: "[data-tour='invoices-list']",
    title: "חשבוניות מאושרות",
    content: "כל החשבוניות שאישרת. אפשר לסנן, לחפש, לייצא ל-CSV, ולהחזיר לעריכה.",
    page: "/invoices",
  },
  // Settings
  {
    target: "[data-tour='settings']",
    title: "הגדרות",
    content: "ניהול קטגוריות, פרופיל, ועוד. תוכל להוסיף ולמחוק קטגוריות בהתאם לצרכים שלך.",
    page: "/settings",
  },
];

interface TourContextType {
  isTouring: boolean;
  currentStep: number;
  steps: TourStep[];
  startTour: () => void;
  endTour: () => void;
  nextStep: () => void;
  prevStep: () => void;
  currentStepData: TourStep | null;
}

const TourContext = createContext<TourContextType>({
  isTouring: false,
  currentStep: 0,
  steps: [],
  startTour: () => {},
  endTour: () => {},
  nextStep: () => {},
  prevStep: () => {},
  currentStepData: null,
});

export function TourProvider({ children }: { children: React.ReactNode }) {
  const [isTouring, setIsTouring] = useState(false);
  const [currentStep, setCurrentStep] = useState(0);

  const startTour = useCallback(() => {
    setIsTouring(true);
    setCurrentStep(0);
  }, []);

  const endTour = useCallback(() => {
    setIsTouring(false);
    setCurrentStep(0);
  }, []);

  const nextStep = useCallback(() => {
    if (currentStep < tourSteps.length - 1) {
      setCurrentStep((s) => s + 1);
    } else {
      endTour();
    }
  }, [currentStep, endTour]);

  const prevStep = useCallback(() => {
    if (currentStep > 0) setCurrentStep((s) => s - 1);
  }, [currentStep]);

  return (
    <TourContext.Provider
      value={{
        isTouring,
        currentStep,
        steps: tourSteps,
        startTour,
        endTour,
        nextStep,
        prevStep,
        currentStepData: isTouring ? tourSteps[currentStep] : null,
      }}
    >
      {children}
    </TourContext.Provider>
  );
}

export const useTour = () => useContext(TourContext);
