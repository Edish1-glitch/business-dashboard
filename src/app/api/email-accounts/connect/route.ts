import { NextResponse } from "next/server";
import { getAuthUser } from "@/lib/api-auth";
import { getGmailAuthUrl } from "@/lib/gmail";

export async function GET() {
  const { user, error } = await getAuthUser();
  if (error) return error;

  const authUrl = getGmailAuthUrl(user.id);
  return NextResponse.redirect(authUrl);
}
