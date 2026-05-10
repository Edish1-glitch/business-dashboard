import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";

// GET all categories
export async function GET() {
  const categories = await prisma.category.findMany({
    orderBy: { name: "asc" },
  });
  return NextResponse.json({ categories });
}

// POST create new category
export async function POST(request: NextRequest) {
  const { name, icon, color } = await request.json();

  if (!name) {
    return NextResponse.json({ error: "שם קטגוריה חובה" }, { status: 400 });
  }

  const category = await prisma.category.create({
    data: { name, icon, color },
  });

  return NextResponse.json({ category });
}
