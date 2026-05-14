import { Receipt, ArrowLeftRight } from "lucide-react";

export default function GreenInvoicePage() {
  return (
    <div className="flex flex-col items-center justify-center py-20 text-center max-w-md mx-auto">
      <div className="flex items-center justify-center w-16 h-16 rounded-2xl bg-emerald-100 mb-6">
        <Receipt className="h-8 w-8 text-emerald-600" />
      </div>
      <h2 className="text-xl font-bold mb-2">חשבונית ירוקה</h2>
      <p className="text-muted-foreground text-sm mb-4">
        סנכרון דו-כיווני עם חשבונית ירוקה בקרוב. תוכל למשוך ולדחוף נתונים ישירות מהמערכת.
      </p>
      <div className="flex items-center gap-2 text-xs text-muted-foreground bg-muted/50 px-4 py-2 rounded-full">
        <ArrowLeftRight className="h-3.5 w-3.5" />
        <span>סנכרון דו-כיווני עם API</span>
      </div>
    </div>
  );
}
