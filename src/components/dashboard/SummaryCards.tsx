import {
  TrendingDown,
  TrendingUp,
  FileText,
  CreditCard,
} from "lucide-react";

const cards = [
  {
    title: 'סה"כ הוצאות החודש',
    value: "₪0",
    description: "לא נטענו נתונים עדיין",
    icon: TrendingDown,
    gradient: "from-red-500 to-rose-600",
    bgLight: "bg-red-50",
    textColor: "text-red-600",
  },
  {
    title: 'סה"כ הכנסות החודש',
    value: "₪0",
    description: "לא נטענו נתונים עדיין",
    icon: TrendingUp,
    gradient: "from-emerald-500 to-green-600",
    bgLight: "bg-emerald-50",
    textColor: "text-emerald-600",
  },
  {
    title: "חשבוניות שנמשכו",
    value: "0",
    description: "חבר מיילים כדי להתחיל",
    icon: FileText,
    gradient: "from-blue-500 to-indigo-600",
    bgLight: "bg-blue-50",
    textColor: "text-blue-600",
  },
  {
    title: "כרטיסי אשראי",
    value: "0",
    description: "הוסף כרטיסים בהגדרות",
    icon: CreditCard,
    gradient: "from-violet-500 to-purple-600",
    bgLight: "bg-violet-50",
    textColor: "text-violet-600",
  },
];

export function SummaryCards() {
  return (
    <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
      {cards.map((card) => (
        <div
          key={card.title}
          data-slot="card"
          className="relative overflow-hidden rounded-2xl bg-card border border-border/50 p-5 shadow-sm hover:shadow-md transition-shadow duration-200"
        >
          {/* Gradient accent bar */}
          <div className={`absolute top-0 left-0 right-0 h-1 bg-gradient-to-l ${card.gradient}`} />

          <div className="flex items-start justify-between">
            <p className="text-sm font-medium text-muted-foreground">
              {card.title}
            </p>
            <div className={`flex items-center justify-center w-10 h-10 rounded-xl ${card.bgLight}`}>
              <card.icon className={`h-5 w-5 ${card.textColor}`} />
            </div>
          </div>

          <div className="mt-3">
            <p className="text-3xl font-bold tracking-tight">{card.value}</p>
            <p className="text-xs text-muted-foreground mt-1.5">
              {card.description}
            </p>
          </div>
        </div>
      ))}
    </div>
  );
}
