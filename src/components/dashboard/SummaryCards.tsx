import {
  TrendingDown,
  TrendingUp,
  FileText,
  CreditCard,
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

const cards = [
  {
    title: "סה\"כ הוצאות החודש",
    value: "₪0",
    description: "לא נטענו נתונים עדיין",
    icon: TrendingDown,
    iconColor: "text-red-500",
  },
  {
    title: "סה\"כ הכנסות החודש",
    value: "₪0",
    description: "לא נטענו נתונים עדיין",
    icon: TrendingUp,
    iconColor: "text-green-500",
  },
  {
    title: "חשבוניות שנמשכו",
    value: "0",
    description: "חבר מיילים כדי להתחיל",
    icon: FileText,
    iconColor: "text-blue-500",
  },
  {
    title: "כרטיסי אשראי",
    value: "0",
    description: "הוסף כרטיסים בהגדרות",
    icon: CreditCard,
    iconColor: "text-purple-500",
  },
];

export function SummaryCards() {
  return (
    <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
      {cards.map((card) => (
        <Card key={card.title}>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              {card.title}
            </CardTitle>
            <card.icon className={`h-5 w-5 ${card.iconColor}`} />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{card.value}</div>
            <p className="text-xs text-muted-foreground mt-1">
              {card.description}
            </p>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}
