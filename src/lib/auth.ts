import { NextAuthOptions } from "next-auth";
import GoogleProvider from "next-auth/providers/google";
import { randomUUID } from "crypto";

export const authOptions: NextAuthOptions = {
  providers: [
    GoogleProvider({
      clientId: process.env.GOOGLE_CLIENT_ID || "",
      clientSecret: process.env.GOOGLE_CLIENT_SECRET || "",
    }),
  ],
  callbacks: {
    async signIn({ user }) {
      // Allowlist: if ALLOWED_EMAILS is set (comma-separated), only those
      // addresses may sign in — closes public sign-up on the shared instance.
      // Unset ⇒ open (so a missing env never locks anyone out).
      const allow = (process.env.ALLOWED_EMAILS || "")
        .split(",").map((e) => e.trim().toLowerCase()).filter(Boolean);
      if (allow.length > 0 && (!user.email || !allow.includes(user.email.toLowerCase()))) {
        return false;
      }
      if (user.email) {
        try {
          const { prisma } = await import("@/lib/db");
          await prisma.user.upsert({
            where: { email: user.email },
            update: { name: user.name || undefined },
            create: {
              email: user.email,
              name: user.name || "משתמש",
            },
          });
        } catch (e) {
          console.error("Failed to upsert user:", e);
        }
      }
      return true;
    },
    // Mint a stable session id (sid) on initial sign-in for device tracking.
    // The Session row itself is created lazily by getAuthUser (which has the
    // request's user-agent/IP) — keeping DB work out of this callback avoids a
    // login-time write failure leaving a sid with no row.
    async jwt({ token, user }) {
      if (user && !(token as { sid?: string }).sid) {
        (token as { sid?: string }).sid = randomUUID();
      }
      return token;
    },
    async session({ session, token }) {
      if (session.user?.email) {
        try {
          const { prisma } = await import("@/lib/db");
          let dbUser = await prisma.user.findUnique({
            where: { email: session.user.email },
          });
          if (!dbUser) {
            dbUser = await prisma.user.create({
              data: {
                email: session.user.email,
                name: session.user.name || "משתמש",
              },
            });
          }
          (session.user as { id?: string }).id = dbUser.id;
        } catch (e) {
          console.error("Failed to get user:", e);
        }
      }
      // Expose the session id so getAuthUser can validate/revoke it.
      (session as { sid?: string }).sid = (token as { sid?: string }).sid;
      return session;
    },
  },
  pages: {
    signIn: "/login",
  },
  secret: process.env.NEXTAUTH_SECRET,
};
