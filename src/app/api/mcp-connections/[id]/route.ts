import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getAuthUser } from "@/lib/api-auth";

// Disconnect an MCP connection: revoke its token (scoped to the user).
export async function DELETE(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { user, error } = await getAuthUser();
  if (error) return error;
  const { id } = await params;

  await prisma.mcpToken.updateMany({ where: { id, userId: user.id }, data: { revoked: true } });
  return NextResponse.json({ ok: true });
}
