import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { NextResponse } from "next/server";

/**
 * Get the authenticated user for API routes.
 * Returns the user or a 401 response.
 */
export async function getAuthUser() {
  const session = await getServerSession(authOptions);
  if (!session?.user?.email) {
    return { user: null, error: NextResponse.json({ error: "לא מורשה" }, { status: 401 }) };
  }

  const user = await prisma.user.findUnique({
    where: { email: session.user.email },
  });

  if (!user) {
    return { user: null, error: NextResponse.json({ error: "משתמש לא נמצא" }, { status: 401 }) };
  }

  return { user, error: null };
}
