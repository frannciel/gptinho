import "server-only";
import type { NextAuthOptions } from "next-auth";
import CredentialsProvider from "next-auth/providers/credentials";
import { db } from "./db";
import { authenticate } from "@/server/login";
export const authOptions: NextAuthOptions = {
  secret: process.env.NEXTAUTH_SECRET,
  session: { strategy: "jwt", maxAge: 8 * 60 * 60 },
  pages: { signIn: "/login", error: "/login" },
  providers: [
    CredentialsProvider({
      name: "E-mail e senha",
      credentials: {
        email: { label: "E-mail", type: "email" },
        password: { label: "Senha", type: "password" },
      },
      async authorize(credentials) {
        if (!process.env.NEXTAUTH_SECRET) return null;
        try {
          return await authenticate(
            db,
            credentials,
            process.env.NEXTAUTH_SECRET,
          );
        } catch {
          console.error("govnex.auth_unavailable");
          return null;
        }
      },
    }),
  ],
  callbacks: {
    async jwt({ token, user }) {
      if (user) {
        token.role = user.role;
        token.sessionVersion = user.sessionVersion;
      }
      return token;
    },
    async session({ session, token }) {
      if (session.user && token.sub) {
        session.user.id = token.sub;
        session.user.role = token.role;
        session.user.sessionVersion = token.sessionVersion;
      }
      return session;
    },
  },
  events: {
    async signOut({ token }) {
      if (token?.sub) {
        await db.$transaction([
          db.user.updateMany({
            where: { id: token.sub },
            data: { sessionVersion: { increment: 1 } },
          }),
          db.auditLog.create({
            data: {
              actorId: token.sub,
              entity: "Authentication",
              action: "LOGOUT",
            },
          }),
        ]);
      }
    },
  },
  logger: {
    error(code) {
      console.error("govnex.auth_error", { code });
    },
    warn(code) {
      console.warn("govnex.auth_warning", { code });
    },
    debug() {},
  },
};
