import { PrismaClient } from "../src/generated/prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";

const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL! });
const prisma = new PrismaClient({ adapter });

const defaultCategories = [
  { name: "דלק", icon: "Fuel", color: "#f97316" },
  { name: "סופר", icon: "ShoppingCart", color: "#22c55e" },
  { name: "מסעדות", icon: "UtensilsCrossed", color: "#ef4444" },
  { name: "תחבורה", icon: "Car", color: "#3b82f6" },
  { name: "ביטוח", icon: "Shield", color: "#8b5cf6" },
  { name: "תקשורת", icon: "Wifi", color: "#06b6d4" },
  { name: "חשמל ומים", icon: "Zap", color: "#eab308" },
  { name: "שכירות", icon: "Home", color: "#ec4899" },
  { name: "ציוד משרדי", icon: "Briefcase", color: "#64748b" },
  { name: "שיווק ופרסום", icon: "Megaphone", color: "#f43f5e" },
  { name: "מיסים", icon: "Landmark", color: "#7c3aed" },
  { name: "תוכנה", icon: "Monitor", color: "#0ea5e9" },
  { name: "אחר", icon: "MoreHorizontal", color: "#9ca3af" },
];

async function main() {
  console.log("Seeding categories...");
  for (const cat of defaultCategories) {
    await prisma.category.upsert({
      where: { name: cat.name },
      update: {},
      create: cat,
    });
  }
  console.log(`Seeded ${defaultCategories.length} categories.`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
