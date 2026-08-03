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
    // Mint a stable session id (sid) at login and persist a Session row so this
    // device can later be listed and revoked ("disconnect device"). Only sets
    // token.sid if the row is created — so a sid always implies a real row, and
    // getAuthUser can treat "sid present but row missing" as revoked.
    async jwt({ token, user }) {
      const email = user?.email || token.email;
      if (user && email && !(token as { sid?: string }).sid) {
        try {
          const { prisma } = await import("@/lib/db");
          const dbUser = await prisma.user.findUnique({ where: { email } });
          if (dbUser) {
            const sid = randomUUID();
            await prisma.session.create({ data: { jti: sid, userId: dbUser.id } });
            (token as { sid?: string }).sid = sid;
          }
        } catch (e) {
          console.error("Failed to create session:", e);
        }
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
