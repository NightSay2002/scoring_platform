import bcrypt from "bcryptjs";
import { Role } from "@prisma/client";
import { type DefaultSession, type NextAuthConfig } from "next-auth";
import NextAuth from "next-auth";
import Credentials from "next-auth/providers/credentials";
import { z } from "zod";

import { prisma } from "@/lib/prisma";

declare module "next-auth" {
  interface Session {
    user: DefaultSession["user"] & {
      id: string;
      role: Role;
    };
  }
}

const loginSchema = z.object({
  identifier: z.string().min(1),
  password: z.string().min(1),
});

const authConfig: NextAuthConfig = {
  session: {
    strategy: "jwt",
  },
  pages: {
    signIn: "/login",
  },
  providers: [
    Credentials({
      credentials: {
        identifier: { label: "Email or username", type: "text" },
        password: { label: "Password", type: "password" },
      },
      async authorize(credentials) {
        const parsed = loginSchema.safeParse(credentials);

        if (!parsed.success) {
          return null;
        }

        const identifier = parsed.data.identifier.trim().toLowerCase();

        const user = await prisma.user.findFirst({
          where: {
            active: true,
            OR: [
              { email: identifier },
              { name: parsed.data.identifier.trim() },
            ],
          },
        });

        if (!user) {
          return null;
        }

        const isValid = await bcrypt.compare(parsed.data.password.trim(), user.passwordHash);

        if (!isValid) {
          return null;
        }

        await prisma.user.update({
          where: { id: user.id },
          data: { lastLoginAt: new Date() },
        });

        return {
          id: user.id,
          name: user.name,
          email: user.email,
          role: user.role,
        };
      },
    }),
  ],
  callbacks: {
    jwt({ token, user }) {
      if (user) {
        token.id = user.id;
        token.role = user.role;
      }

      return token;
    },
    session({ session, token }) {
      if (session.user) {
        session.user.id = String(token.id);
        session.user.role = token.role as Role;
      }

      return session;
    },
  },
  secret: process.env.AUTH_SECRET ?? "dev-only-secret-for-scoring-platform",
};

export const { auth, handlers, signIn, signOut } = NextAuth(authConfig);
