import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getAuthUser } from "@/lib/api-auth";

export async function GET() {
  try {
    const { user, error } = await getAuthUser();
    if (error) return error;

    const count = await prisma.invoice.count({
      where: { userId: user.id, status: "pending" },
    });

    return NextResponse.json({ count });
  } catch {
    return NextResponse.json({ count: 0 });
  }
}
