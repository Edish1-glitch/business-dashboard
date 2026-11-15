import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getAuthUser } from "@/lib/api-auth";

// List the user's active MCP connections (one per issued, non-revoked grant).
export async function GET() {
  const { user, error } = await getAuthUser();
  if (error) return error;

  const connections = await prisma.mcpToken.findMany({
    where: { userId: user.id, revoked: false },
    orderBy: { createdAt: "desc" },
    select: { id: true, label: true, clientId: true, createdAt: true, lastUsedAt: true },
  });

  return NextResponse.json({ connections });
}
