import { SummaryCards } from "@/components/dashboard/SummaryCards";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

export default function DashboardPage() {
  return (
    <div className="space-y-6">
      {/* Summary Cards */}
      <SummaryCards />

      {/* Placeholder sections */}
      <div className="grid gap-4 md:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="text-base">הוצאות לפי קטגוריה</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex items-center justify-center h-48 text-muted-foreground text-sm">
              גרף הוצאות יופיע כאן לאחר הוספת נתונים
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">חשבוניות אחרונות</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex items-center justify-center h-48 text-muted-foreground text-sm">
              חשבוניות שנמשכו ממייל יופיעו כאן
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
