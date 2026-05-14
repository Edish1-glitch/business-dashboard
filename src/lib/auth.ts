import { NextAuthOptions } from "next-auth";
import GoogleProvider from "next-auth/providers/google";
import { prisma } from "@/lib/db";

export const authOptions: NextAuthOptions = {
  providers: [
    GoogleProvider({
      clientId: process.env.GOOGLE_CLIENT_ID!,
      clientSecret: process.env.GOOGLE_CLIENT_SECRET!,
    }),
  ],
  callbacks: {
    async signIn({ user }) {
      // Create or update user in our DB
      if (user.email) {
        await prisma.user.upsert({
          where: { email: user.email },
          update: { name: user.name || undefined },
          create: {
            email: user.email,
            name: user.name || "משתמש",
          },
        });
      }
      return true;
    },
    async session({ session }) {
      // Add user ID from our DB to session
      if (session.user?.email) {
        const dbUser = await prisma.user.findUnique({
          where: { email: session.user.email },
        });
        if (dbUser) {
          (session.user as { id?: string }).id = dbUser.id;
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
