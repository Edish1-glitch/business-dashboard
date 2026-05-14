import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getAuthUser } from "@/lib/api-auth";

export async function GET(request: NextRequest) {
  try {
    const { user, error } = await getAuthUser();
    if (error) return error;

    const { searchParams } = new URL(request.url);
    const format = searchParams.get("format") || "csv";

    const invoices = await prisma.invoice.findMany({
      where: { userId: user.id, status: "approved" },
      include: { category: true },
      orderBy: { date: "desc" },
    });

    const rows = invoices.map((inv) => ({
      ספק: inv.vendor || "",
      סכום: inv.amount?.toString() || "",
      תאריך: inv.date ? new Date(inv.date).toLocaleDateString("he-IL") : "",
      קטגוריה: inv.category?.name || "",
      כרטיס: inv.creditCardLast4 || "",
      מקור: inv.source,
    }));

    if (format === "csv") {
      const headers = Object.keys(rows[0] || { ספק: "", סכום: "", תאריך: "", קטגוריה: "", כרטיס: "", מקור: "" });
      const csvContent = [
        "\uFEFF" + headers.join(","), // BOM for Hebrew Excel support
        ...rows.map((row) =>
          headers.map((h) => `"${(row as Record<string, string>)[h] || ""}"`).join(",")
        ),
      ].join("\n");

      return new NextResponse(csvContent, {
        headers: {
          "Content-Type": "text/csv; charset=utf-8",
          "Content-Disposition": `attachment; filename="invoices_${new Date().toISOString().slice(0, 10)}.csv"`,
        },
      });
    }

    // JSON format for Excel (can be processed client-side)
    return NextResponse.json({ rows });
  } catch (error) {
    console.error("Export error:", error);
    return NextResponse.json({ error: "שגיאה בייצוא" }, { status: 500 });
  }
}
