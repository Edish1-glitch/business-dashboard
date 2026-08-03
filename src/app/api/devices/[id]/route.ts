import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getAuthUser } from "@/lib/api-auth";

// Disconnect a device: mark its Session revoked (don't delete — a deleted row
// would just be recreated on the device's next request). getAuthUser blocks a
// revoked session with 401, logging that device out.
export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { user, error } = await getAuthUser();
  if (error) return error;

  const { id } = await params;
  // Scope by userId so a session can only revoke its own devices.
  await prisma.session.updateMany({ where: { id, userId: user.id }, data: { revoked: true } });

  return NextResponse.json({ success: true });
}
