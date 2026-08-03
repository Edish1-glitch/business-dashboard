import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getAuthUser } from "@/lib/api-auth";

// Disconnect a device: delete its Session row. On that device's next request,
// getAuthUser finds no row for its sid → 401 → it's logged out.
export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { user, error } = await getAuthUser();
  if (error) return error;

  const { id } = await params;
  // Scope by userId so a session can only revoke its own devices.
  await prisma.session.deleteMany({ where: { id, userId: user.id } });

  return NextResponse.json({ success: true });
}
