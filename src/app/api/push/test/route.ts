import { NextResponse } from "next/server";
import { getAuthUser } from "@/lib/api-auth";
import { sendPushToUser, isPushConfigured } from "@/lib/push";
import { rateLimit } from "@/lib/rate-limit";

// Send a test push to the current user's own devices, so they can confirm
// notifications actually arrive after enabling them.
export async function POST() {
  const { user, error } = await getAuthUser();
  if (error) return error;

  if (!isPushConfigured()) {
    return NextResponse.json({ error: "התראות לא מוגדרות בשרת" }, { status: 503 });
  }

  // Throttle: sending push is abuse-prone.
  const rl = rateLimit(`push-test:${user.id}`, 5, 60_000);
  if (!rl.ok) {
    return NextResponse.json({ error: `נסה שוב בעוד ${rl.retryAfterSeconds} שניות` }, { status: 429 });
  }

  const sent = await sendPushToUser(user.id, {
    title: "בדיקת התראות ✅",
    body: "ההתראות עובדות! זו התראת בדיקה מ-FinDash.",
    url: "/settings",
    tag: "test-push",
  });

  if (sent === 0) {
    return NextResponse.json(
      { error: "לא נמצא מנוי פעיל. הפעל התראות במכשיר הזה ונסה שוב." },
      { status: 404 }
    );
  }

  return NextResponse.json({ sent });
}
