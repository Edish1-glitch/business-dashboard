import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getAuthUser } from "@/lib/api-auth";

export async function GET(request: NextRequest) {
  try {
    const { user, error } = await getAuthUser();
    if (error) return error;

    const { searchParams } = new URL(request.url);
    const from = searchParams.get("from");
    const to = searchParams.get("to");

    const dateFilter: Record<string, unknown> = {};
    if (from) dateFilter.gte = new Date(from);
    if (to) dateFilter.lte = new Date(to);
    const hasDateFilter = Object.keys(dateFilter).length > 0;

    // Total expenses this month (approved only)
    const expenses = await prisma.expense.findMany({
      where: {
        userId: user.id,
        ...(hasDateFilter && { date: dateFilter }),
      },
      include: { category: true },
    });

    const totalExpenses = expenses.reduce((sum, e) => sum + e.amount, 0);

    // Invoices count
    const approvedCount = await prisma.invoice.count({
      where: { userId: user.id, status: "approved" },
    });
    const pendingCount = await prisma.invoice.count({
      where: { userId: user.id, status: "pending" },
    });

    // Credit cards count
    const creditCardCount = await prisma.creditCard.count({
      where: { userId: user.id },
    });

    // Expenses by category (for pie chart)
    const byCategory: Record<string, { name: string; amount: number; color: string }> = {};
    for (const exp of expenses) {
      const catName = exp.category?.name || "אחר";
      const catColor = exp.category?.color || "#9ca3af";
      if (!byCategory[catName]) {
        byCategory[catName] = { name: catName, amount: 0, color: catColor };
      }
      byCategory[catName].amount += exp.amount;
    }

    // Expenses by month (for bar chart)
    const byMonth: Record<string, number> = {};
    for (const exp of expenses) {
      const month = exp.date.toISOString().slice(0, 7); // YYYY-MM
      byMonth[month] = (byMonth[month] || 0) + exp.amount;
    }
    const monthlyData = Object.entries(byMonth)
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([month, amount]) => ({
        month: new Date(month + "-01").toLocaleDateString("he-IL", { month: "short", year: "2-digit" }),
        amount: Math.round(amount * 100) / 100,
      }));

    // Recent invoices (last 5 approved)
    const recentInvoices = await prisma.invoice.findMany({
      where: { userId: user.id, status: "approved" },
      include: { category: true },
      orderBy: { createdAt: "desc" },
      take: 5,
    });

    return NextResponse.json({
      summary: {
        totalExpenses: Math.round(totalExpenses * 100) / 100,
        approvedCount,
        pendingCount,
        creditCardCount,
      },
      byCategory: Object.values(byCategory),
      monthlyData,
      recentInvoices,
    });
  } catch (error) {
    console.error("Dashboard API error:", error);
    return NextResponse.json({ error: "שגיאה בטעינת נתונים" }, { status: 500 });
  }
}
