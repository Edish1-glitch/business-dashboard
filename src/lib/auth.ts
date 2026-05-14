import { NextAuthOptions } from "next-auth";
import GoogleProvider from "next-auth/providers/google";

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
    async session({ session }) {
      if (session.user?.email) {
        try {
          const { prisma } = await import("@/lib/db");
          const dbUser = await prisma.user.findUnique({
            where: { email: session.user.email },
          });
          if (dbUser) {
            (session.user as { id?: string }).id = dbUser.id;
          }
        } catch (e) {
          console.error("Failed to get user:", e);
        }
      }
      return session;
    },
  },
  pages: {
    signIn: "/login",
  },
  secret: process.env.NEXTAUTH_SECRET,
};
