import NextAuth from "next-auth";
import GitHub from "next-auth/providers/github";
import { env } from "./env";

declare module "next-auth" {
  interface Session {
    user: {
      name?: string | null;
      email?: string | null;
      image?: string | null;
      githubLogin?: string;
    };
  }
}

export const { handlers, auth, signIn, signOut } = NextAuth({
  secret: env.AUTH_SECRET,
  session: { strategy: "jwt" },
  providers: [
    GitHub({
      clientId: env.AUTH_GITHUB_ID,
      clientSecret: env.AUTH_GITHUB_SECRET,
    }),
  ],
  pages: {
    error: "/auth/error",
  },
  callbacks: {
    async signIn({ account, profile }) {
      if (account?.provider !== "github") return false;
      const login = typeof profile?.login === "string" ? profile.login.toLowerCase() : null;
      if (!login) return false;
      return env.allowedGithubLogins.includes(login);
    },
    async jwt({ token, profile }) {
      if (profile && typeof profile.login === "string") {
        token.githubLogin = profile.login;
      }
      return token;
    },
    async session({ session, token }) {
      if (typeof token.githubLogin === "string") {
        session.user.githubLogin = token.githubLogin;
      }
      return session;
    },
  },
});
