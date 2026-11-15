import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getAuthUser } from "@/lib/api-auth";

// The MCP action log (most recent first) for the settings audit view.
export async function GET() {
  const { user, error } = await getAuthUser();
  if (error) return error;

  const logs = await prisma.mcpActionLog.findMany({
    where: { userId: user.id },
    orderBy: { createdAt: "desc" },
    take: 50,
    select: { id: true, tool: true, summary: true, ok: true, result: true, createdAt: true },
  });

  return NextResponse.json({ logs });
}
