import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getAuthUser } from "@/lib/api-auth";

// GET all categories
export async function GET() {
  try {
    const categories = await prisma.category.findMany({
      orderBy: { name: "asc" },
    });
    return NextResponse.json({ categories });
  } catch (error) {
    console.error("Categories error:", error);
    return NextResponse.json({ categories: [] }, { status: 500 });
  }
}

// POST create new category
export async function POST(request: NextRequest) {
  try {
    const { user, error } = await getAuthUser();
    if (error) return error;

    const { name, icon, color } = await request.json();

    if (!name?.trim()) {
      return NextResponse.json({ error: "שם קטגוריה חובה" }, { status: 400 });
    }

    // Check for duplicate
    const existing = await prisma.category.findFirst({ where: { name: name.trim() } });
    if (existing) {
      return NextResponse.json({ error: "קטגוריה כבר קיימת" }, { status: 400 });
    }

    const category = await prisma.category.create({
      data: { name: name.trim(), icon, color },
    });

    return NextResponse.json({ category });
  } catch (error) {
    console.error("Category create error:", error);
    return NextResponse.json({ error: "שגיאה ביצירת קטגוריה" }, { status: 500 });
  }
}
