"use client";

import { useState, useCallback } from "react";
import {
  Upload,
  FileText,
  Loader2,
  Download,
  Tag,
  CreditCard,
  Calendar,
  Building2,
  CheckCircle2,
  AlertCircle,
} from "lucide-react";
import { Button } from "@/components/ui/button";

interface InvoiceResult {
  id: string;
  page: number;
  fileName: string;
  vendor: string | null;
  amount: number | null;
  date: string | null;
  category: string | null;
  creditCardLast4: string | null;
  textPreview: string;
}

interface SplitResponse {
  success: boolean;
  totalPages: number;
  invoices: InvoiceResult[];
  error?: string;
}

export default function PdfSplitPage() {
  const [isDragging, setIsDragging] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [progress, setProgress] = useState("");
  const [results, setResults] = useState<SplitResponse | null>(null);
  const [error, setError] = useState<string | null>(null);

  const handleFile = useCallback(async (file: File) => {
    if (!file.name.toLowerCase().endsWith(".pdf")) {
      setError("יש להעלות קובץ PDF בלבד");
      return;
    }

    setIsProcessing(true);
    setError(null);
    setResults(null);
    setProgress("מעלה את הקובץ...");

    try {
      const formData = new FormData();
      formData.append("file", file);

      setProgress("מפצל ומעבד חשבוניות...");

      const response = await fetch("/api/pdf-split", {
        method: "POST",
        body: formData,
      });

      const data: SplitResponse = await response.json();

      if (!response.ok) {
        setError(data.error || "שגיאה בעיבוד הקובץ");
        return;
      }

      setResults(data);
    } catch {
      setError("שגיאה בהעלאת הקובץ");
    } finally {
      setIsProcessing(false);
      setProgress("");
    }
  }, []);

  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      setIsDragging(false);
      const file = e.dataTransfer.files[0];
      if (file) handleFile(file);
    },
    [handleFile]
  );

  const handleInputChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      if (file) handleFile(file);
    },
    [handleFile]
  );

  const categoryColors: Record<string, string> = {
    דלק: "bg-orange-100 text-orange-700",
    סופר: "bg-green-100 text-green-700",
    מסעדות: "bg-red-100 text-red-700",
    תחבורה: "bg-blue-100 text-blue-700",
    ביטוח: "bg-violet-100 text-violet-700",
    תקשורת: "bg-cyan-100 text-cyan-700",
    "חשמל ומים": "bg-yellow-100 text-yellow-700",
    שכירות: "bg-pink-100 text-pink-700",
    "ציוד משרדי": "bg-slate-100 text-slate-700",
    "שיווק ופרסום": "bg-rose-100 text-rose-700",
    מיסים: "bg-purple-100 text-purple-700",
    אחר: "bg-gray-100 text-gray-700",
  };

  return (
    <div className="space-y-6 max-w-4xl mx-auto">
      {/* Upload area */}
      <div
        onDragOver={(e) => {
          e.preventDefault();
          setIsDragging(true);
        }}
        onDragLeave={() => setIsDragging(false)}
        onDrop={handleDrop}
        className={`relative rounded-2xl border-2 border-dashed transition-all duration-200 ${
          isDragging
            ? "border-primary bg-primary/5 scale-[1.01]"
            : "border-border hover:border-primary/50 hover:bg-muted/30"
        } ${isProcessing ? "pointer-events-none opacity-60" : ""}`}
      >
        <label
          className="flex flex-col items-center justify-center gap-4 p-10 md:p-16 cursor-pointer"
          style={{ touchAction: "manipulation" }}
        >
          <input
            type="file"
            accept=".pdf"
            onChange={handleInputChange}
            className="sr-only"
            disabled={isProcessing}
          />

          {isProcessing ? (
            <>
              <Loader2 className="h-12 w-12 text-primary animate-spin" />
              <div className="text-center">
                <p className="text-lg font-semibold">{progress}</p>
                <p className="text-sm text-muted-foreground mt-1">
                  זה יכול לקחת כמה שניות...
                </p>
              </div>
            </>
          ) : (
            <>
              <div className="flex items-center justify-center w-16 h-16 rounded-2xl bg-primary/10">
                <Upload className="h-8 w-8 text-primary" />
              </div>
              <div className="text-center">
                <p className="text-lg font-semibold">
                  גרור קובץ PDF לכאן
                </p>
                <p className="text-sm text-muted-foreground mt-1">
                  או לחץ לבחירת קובץ
                </p>
              </div>
              <div className="flex items-center gap-2 text-xs text-muted-foreground bg-muted/50 px-4 py-2 rounded-full">
                <FileText className="h-3.5 w-3.5" />
                <span>PDF עם חשבוניות - כל עמוד = חשבונית נפרדת</span>
              </div>
            </>
          )}
        </label>
      </div>

      {/* Error message */}
      {error && (
        <div className="flex items-center gap-3 p-4 rounded-xl bg-red-50 border border-red-200 text-red-700">
          <AlertCircle className="h-5 w-5 shrink-0" />
          <p className="text-sm">{error}</p>
        </div>
      )}

      {/* Results */}
      {results && (
        <div className="space-y-4">
          {/* Success header */}
          <div className="flex items-center gap-3 p-4 rounded-xl bg-emerald-50 border border-emerald-200">
            <CheckCircle2 className="h-5 w-5 text-emerald-600 shrink-0" />
            <div>
              <p className="font-semibold text-emerald-900">
                פוצלו {results.totalPages} חשבוניות בהצלחה
              </p>
              <p className="text-sm text-emerald-700">
                הנתונים חולצו ונשמרו במערכת
              </p>
            </div>
          </div>

          {/* Invoice cards */}
          <div className="grid gap-3">
            {results.invoices.map((inv) => (
              <div
                key={inv.id}
                className="rounded-2xl bg-card border border-border/50 p-4 shadow-sm hover:shadow-md transition-shadow"
              >
                <div className="flex items-start justify-between gap-4">
                  <div className="flex-1 space-y-2">
                    {/* Vendor & page */}
                    <div className="flex items-center gap-2">
                      <Building2 className="h-4 w-4 text-muted-foreground" />
                      <span className="font-semibold">
                        {inv.vendor || `חשבונית ${inv.page}`}
                      </span>
                      <span className="text-xs text-muted-foreground">
                        (עמוד {inv.page})
                      </span>
                    </div>

                    {/* Details */}
                    <div className="flex flex-wrap items-center gap-3 text-sm">
                      {inv.amount !== null && (
                        <span className="font-bold text-lg">
                          ₪{inv.amount.toLocaleString("he-IL")}
                        </span>
                      )}

                      {inv.date && (
                        <span className="flex items-center gap-1 text-muted-foreground">
                          <Calendar className="h-3.5 w-3.5" />
                          {new Date(inv.date).toLocaleDateString("he-IL")}
                        </span>
                      )}

                      {inv.category && (
                        <span
                          className={`flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-medium ${
                            categoryColors[inv.category] || categoryColors["אחר"]
                          }`}
                        >
                          <Tag className="h-3 w-3" />
                          {inv.category}
                        </span>
                      )}

                      {inv.creditCardLast4 && (
                        <span className="flex items-center gap-1 text-muted-foreground">
                          <CreditCard className="h-3.5 w-3.5" />
                          ****{inv.creditCardLast4}
                        </span>
                      )}
                    </div>
                  </div>

                  {/* Download button */}
                  <Button
                    variant="ghost"
                    size="icon"
                    className="shrink-0"
                    onClick={() => {
                      window.open(`/api/invoices/${inv.id}/download`, "_blank");
                    }}
                  >
                    <Download className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
