import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getAuthUser } from "@/lib/api-auth";

export async function GET() {
  try {
    const { user, error } = await getAuthUser();
    if (error) return error;

    const accounts = await prisma.emailAccount.findMany({
      where: { userId: user.id },
      select: {
        id: true,
        email: true,
        provider: true,
        lastSyncAt: true,
        createdAt: true,
        syncRanges: {
          orderBy: { fromDate: "desc" },
          take: 5,
          select: { fromDate: true, toDate: true, invoicesFound: true, createdAt: true },
        },
      },
      orderBy: { createdAt: "desc" },
    });

    return NextResponse.json({ accounts });
  } catch {
    return NextResponse.json({ accounts: [], error: "שגיאה בטעינת חשבונות" }, { status: 500 });
  }
}
