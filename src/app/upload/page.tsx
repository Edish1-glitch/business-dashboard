"use client";

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

const categoryColors: Record<string, string> = {
  דלק: "bg-orange-100 text-orange-700",
  סופר: "bg-green-100 text-green-700",
  מסעדות: "bg-red-100 text-red-700",
  תחבורה: "bg-blue-100 text-blue-700",
  ביטוח: "bg-violet-100 text-violet-700",
  תקשורת: "bg-cyan-100 text-cyan-700",
  "חשמל ומים": "bg-yellow-100 text-yellow-700",
  שכירות: "bg-pink-100 text-pink-700",
  אחר: "bg-gray-100 text-gray-700",
};

export default function UploadPage() {
  const [isProcessing, setIsProcessing] = useState(false);
  const [progress, setProgress] = useState("");
  const [results, setResults] = useState<InvoiceResult[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [selectedFiles, setSelectedFiles] = useState<File[]>([]);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const cameraInputRef = useRef<HTMLInputElement>(null);

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

      const response = await fetch("/api/upload-invoices", {
        method: "POST",
        body: formData,
      });

      const data = await response.json();

      if (!response.ok) {
        setError(data.error || "שגיאה בעיבוד הקבצים");
        return;
      }

      setResults(data.invoices);
      setSelectedFiles([]);
    } catch {
      setError("שגיאה בהעלאת הקבצים");
    } finally {
      setIsProcessing(false);
      setProgress("");
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

      {/* Upload options */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        {/* Documents / PDF */}
        <label
          className="flex flex-col items-center gap-3 p-6 rounded-2xl border-2 border-dashed border-border hover:border-primary/50 hover:bg-primary/5 transition-all cursor-pointer"
          style={{ touchAction: "manipulation" }}
        >
          <input
            ref={fileInputRef}
            type="file"
            accept=".pdf"
            multiple
            onChange={(e) => e.target.files && addFiles(e.target.files)}
            className="sr-only"
          />
          <div className="flex items-center justify-center w-12 h-12 rounded-xl bg-blue-100">
            <FileText className="h-6 w-6 text-blue-600" />
          </div>
          <div className="text-center">
            <p className="text-sm font-medium">מסמך PDF</p>
            <p className="text-xs text-muted-foreground">קובץ עם חשבוניות</p>
          </div>
        </label>

        {/* Gallery / Images */}
        <label
          className="flex flex-col items-center gap-3 p-6 rounded-2xl border-2 border-dashed border-border hover:border-primary/50 hover:bg-primary/5 transition-all cursor-pointer"
          style={{ touchAction: "manipulation" }}
        >
          <input
            type="file"
            accept="image/*"
            multiple
            onChange={(e) => e.target.files && addFiles(e.target.files)}
            className="sr-only"
          />
          <div className="flex items-center justify-center w-12 h-12 rounded-xl bg-emerald-100">
            <ImageIcon className="h-6 w-6 text-emerald-600" />
          </div>
          <div className="text-center">
            <p className="text-sm font-medium">גלריה</p>
            <p className="text-xs text-muted-foreground">תמונות חשבוניות</p>
          </div>
        </label>

        {/* Camera */}
        <label
          className="flex flex-col items-center gap-3 p-6 rounded-2xl border-2 border-dashed border-border hover:border-primary/50 hover:bg-primary/5 transition-all cursor-pointer"
          style={{ touchAction: "manipulation" }}
        >
          <input
            ref={cameraInputRef}
            type="file"
            accept="image/*"
            capture="environment"
            onChange={(e) => e.target.files && addFiles(e.target.files)}
            className="sr-only"
          />
          <div className="flex items-center justify-center w-12 h-12 rounded-xl bg-violet-100">
            <Camera className="h-6 w-6 text-violet-600" />
          </div>
          <div className="text-center">
            <p className="text-sm font-medium">צילום</p>
            <p className="text-xs text-muted-foreground">צלם חשבונית עכשיו</p>
          </div>
        </label>
      </div>

      {/* Drag & drop area */}
      <div
        onDragOver={(e) => { e.preventDefault(); setIsDragging(true); }}
        onDragLeave={() => setIsDragging(false)}
        onDrop={handleDrop}
        className={`rounded-2xl border-2 border-dashed p-8 text-center transition-all ${
          isDragging
            ? "border-primary bg-primary/5 scale-[1.01]"
            : "border-border/50 hover:border-border"
        }`}
      >
        <Upload className="h-8 w-8 text-muted-foreground/40 mx-auto mb-2" />
        <p className="text-sm text-muted-foreground">או גרור קבצים לכאן</p>
        <p className="text-xs text-muted-foreground/60 mt-1">PDF, JPG, PNG, WebP</p>
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
                  {progress}
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
