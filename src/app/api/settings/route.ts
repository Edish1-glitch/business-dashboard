import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getAuthUser } from "@/lib/api-auth";
import { canSendEmail } from "@/lib/gmail";

/**
 * GET /api/settings
 * Returns the saved accountant email and the connected Gmail accounts
 * that can be used as senders (with a flag for whether send is permitted).
 */
export async function GET() {
  const { user, error } = await getAuthUser();
  if (error) return error;

  const [dbUser, accounts] = await Promise.all([
    prisma.user.findUnique({ where: { id: user.id }, select: { accountantEmail: true } }),
    prisma.emailAccount.findMany({
      where: { userId: user.id },
      select: { id: true, email: true, scopes: true },
      orderBy: { createdAt: "asc" },
    }),
  ]);

  const senderAccounts = accounts.map((a) => ({
    id: a.id,
    email: a.email,
    canSend: canSendEmail(a.scopes),
  }));

  return NextResponse.json({
    accountantEmail: dbUser?.accountantEmail || "",
    senderAccounts,
  });
}

/**
 * PATCH /api/settings
 * Updates the saved accountant email.
 */
export async function PATCH(request: NextRequest) {
  const { user, error } = await getAuthUser();
  if (error) return error;

  const body = await request.json();
  const accountantEmail = typeof body.accountantEmail === "string" ? body.accountantEmail.trim() : "";

  await prisma.user.update({
    where: { id: user.id },
    data: { accountantEmail: accountantEmail || null },
  });

  return NextResponse.json({ ok: true, accountantEmail });
}
