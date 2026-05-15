"use client";
import { categoryColors } from "@/lib/category-colors";

import { useState, useCallback, useRef } from "react";
import {
  Upload,
  FileText,
  Image as ImageIcon,
  Camera,
  Loader2,
  CheckCircle2,
  AlertCircle,
  Building2,
  Calendar,
  Tag,
  X,
} from "lucide-react";
import { Button } from "@/components/ui/button";

interface InvoiceResult {
  id: string;
  page: number;
  fileName: string;
  sourceFile: string;
  vendor: string | null;
  amount: number | null;
  date: string | null;
  category: string | null;
  creditCardLast4: string | null;
}


export default function UploadPage() {
  const [isProcessing, setIsProcessing] = useState(false);
  const [progress, setProgress] = useState("");
  const [progressPercent, setProgressPercent] = useState(0);
  const [results, setResults] = useState<InvoiceResult[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [selectedFiles, setSelectedFiles] = useState<File[]>([]);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const addFiles = useCallback((newFiles: FileList | File[]) => {
    const validFiles = Array.from(newFiles).filter((f) => {
      const ext = f.name.toLowerCase();
      return ext.endsWith(".pdf") || ext.endsWith(".jpg") || ext.endsWith(".jpeg") ||
        ext.endsWith(".png") || ext.endsWith(".webp") || ext.endsWith(".heic");
    });
    setSelectedFiles((prev) => [...prev, ...validFiles]);
    setError(null);
  }, []);

  const removeFile = (index: number) => {
    setSelectedFiles((prev) => prev.filter((_, i) => i !== index));
  };

  const uploadFiles = async () => {
    if (selectedFiles.length === 0) return;

    setIsProcessing(true);
    setError(null);
    setResults(null);
    setProgress(`מעבד ${selectedFiles.length} קבצים...`);

    try {
      const formData = new FormData();
      selectedFiles.forEach((file) => formData.append("files", file));
      setProgressPercent(0);

      const response = await fetch("/api/upload-invoices", {
        method: "POST",
        body: formData,
      });

      if (!response.ok) {
        const data = await response.json();
        setError(data.error || "שגיאה בעיבוד הקבצים");
        return;
      }

      // Read streaming response
      const reader = response.body?.getReader();
      const decoder = new TextDecoder();
      let finalData = null;

      if (reader) {
        let buffer = "";
        while (true) {
          const { done, value } = await reader.read();
          if (done) break;
          buffer += decoder.decode(value, { stream: true });

          const lines = buffer.split("\n");
          buffer = lines.pop() || "";

          for (const line of lines) {
            if (!line.trim()) continue;
            try {
              const msg = JSON.parse(line);
              if (msg.type === "progress") {
                setProgress(msg.message);
                setProgressPercent(msg.total > 0 ? (msg.current / msg.total) * 100 : 0);
              } else if (msg.type === "done") {
                finalData = msg;
              }
            } catch { /* ignore parse errors */ }
          }
        }
      }

      if (finalData) {
        setResults(finalData.invoices);
        setSelectedFiles([]);
      }
    } catch {
      setError("שגיאה בהעלאת הקבצים");
    } finally {
      setIsProcessing(false);
      setProgress("");
      setProgressPercent(0);
    }
  };

  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      setIsDragging(false);
      addFiles(e.dataTransfer.files);
    },
    [addFiles]
  );

  return (
    <div className="space-y-6 max-w-3xl mx-auto">
      {/* Page header */}
      <div>
        <h2 className="text-xl font-bold">העלאת חשבוניות</h2>
        <p className="text-sm text-muted-foreground mt-1">
          העלה חשבוניות מקובץ PDF, תמונה מהגלריה, או צלם חשבונית ישירות מהמצלמה
        </p>
      </div>

      {/* Single upload area */}
      <div data-tour="upload-area">
      <label
        onDragOver={(e) => { e.preventDefault(); setIsDragging(true); }}
        onDragLeave={() => setIsDragging(false)}
        onDrop={handleDrop}
        className={`flex flex-col items-center justify-center gap-4 p-10 md:p-16 rounded-2xl border-2 border-dashed transition-all cursor-pointer ${
          isDragging
            ? "border-primary bg-primary/5 scale-[1.01]"
            : "border-border hover:border-primary/50 hover:bg-muted/30"
        } ${isProcessing ? "pointer-events-none opacity-60" : ""}`}
        style={{ touchAction: "manipulation" }}
      >
        <input
          ref={fileInputRef}
          type="file"
          accept=".pdf,image/*"
          multiple
          onChange={(e) => e.target.files && addFiles(e.target.files)}
          className="sr-only"
        />
        <div className="flex items-center justify-center w-16 h-16 rounded-2xl bg-primary/10">
          <Upload className="h-8 w-8 text-primary" />
        </div>
        <div className="text-center">
          <p className="text-lg font-semibold">בחר קבצים להעלאה</p>
          <p className="text-sm text-muted-foreground mt-1">
            PDF, תמונה מהגלריה, או צילום מהמצלמה
          </p>
        </div>
        <div className="flex flex-wrap items-center justify-center gap-2 text-xs text-muted-foreground">
          <span className="flex items-center gap-1 bg-muted/50 px-3 py-1.5 rounded-full">
            <FileText className="h-3.5 w-3.5" /> PDF
          </span>
          <span className="flex items-center gap-1 bg-muted/50 px-3 py-1.5 rounded-full">
            <ImageIcon className="h-3.5 w-3.5" /> JPG / PNG
          </span>
          <span className="flex items-center gap-1 bg-muted/50 px-3 py-1.5 rounded-full">
            <Camera className="h-3.5 w-3.5" /> צילום
          </span>
        </div>
      </label>

      </div>

      {/* Selected files list */}
      {selectedFiles.length > 0 && (
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <p className="text-sm font-medium">{selectedFiles.length} קבצים נבחרו</p>
            <Button onClick={uploadFiles} disabled={isProcessing} className="gap-2">
              {isProcessing ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" />
                  מעבד...
                </>
              ) : (
                <>
                  <Upload className="h-4 w-4" />
                  העלה ועבד
                </>
              )}
            </Button>
          </div>

          <div className="grid gap-2">
            {selectedFiles.map((file, i) => (
              <div
                key={`${file.name}-${i}`}
                className="flex items-center justify-between p-3 rounded-xl bg-card border border-border/50"
              >
                <div className="flex items-center gap-3">
                  {file.type.startsWith("image/") ? (
                    <ImageIcon className="h-4 w-4 text-emerald-500" />
                  ) : (
                    <FileText className="h-4 w-4 text-blue-500" />
                  )}
                  <span className="text-sm truncate max-w-[200px]">{file.name}</span>
                  <span className="text-xs text-muted-foreground">
                    {(file.size / 1024).toFixed(0)} KB
                  </span>
                </div>
                <Button variant="ghost" size="icon" onClick={() => removeFile(i)} className="h-8 w-8">
                  <X className="h-3.5 w-3.5" />
                </Button>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Progress bar */}
      {isProcessing && (
        <div className="space-y-2">
          <div className="flex items-center justify-between text-sm">
            <span className="text-muted-foreground">{progress}</span>
            <span className="font-medium">{Math.round(progressPercent)}%</span>
          </div>
          <div className="w-full h-2 bg-muted rounded-full overflow-hidden">
            <div
              className="h-full bg-primary rounded-full transition-all duration-300"
              style={{ width: `${progressPercent}%` }}
            />
          </div>
        </div>
      )}

      {/* Error */}
      {error && (
        <div className="flex items-center gap-3 p-4 rounded-xl bg-red-50 border border-red-200 text-red-700">
          <AlertCircle className="h-5 w-5 shrink-0" />
          <p className="text-sm">{error}</p>
        </div>
      )}

      {/* Results */}
      {results && (
        <div className="space-y-4">
          <div className="flex items-center gap-3 p-4 rounded-xl bg-emerald-50 border border-emerald-200">
            <CheckCircle2 className="h-5 w-5 text-emerald-600 shrink-0" />
            <div>
              <p className="font-semibold text-emerald-900">
                {results.length} חשבוניות עובדו בהצלחה
              </p>
              <p className="text-sm text-emerald-700">
                עבור ל<a href="/invoices/pending" className="underline font-medium">ממתינות לאישור</a> כדי לבדוק ולאשר
              </p>
            </div>
          </div>

          <div className="grid gap-2">
            {results.map((inv) => (
              <div key={inv.id} className="rounded-xl bg-card border border-border/50 p-3 shadow-sm">
                <div className="flex items-center justify-between">
                  <div className="space-y-1">
                    <div className="flex items-center gap-2">
                      <Building2 className="h-3.5 w-3.5 text-muted-foreground" />
                      <span className="text-sm font-medium">{inv.vendor || inv.fileName}</span>
                    </div>
                    <div className="flex flex-wrap items-center gap-2 text-xs">
                      {inv.amount !== null && (
                        <span className="font-bold">₪{inv.amount.toLocaleString("he-IL")}</span>
                      )}
                      {inv.date && (
                        <span className="flex items-center gap-1 text-muted-foreground">
                          <Calendar className="h-3 w-3" />
                          {new Date(inv.date).toLocaleDateString("he-IL")}
                        </span>
                      )}
                      {inv.category && (
                        <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${categoryColors[inv.category] || categoryColors["אחר"]}`}>
                          <Tag className="h-2.5 w-2.5 inline ml-1" />
                          {inv.category}
                        </span>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
