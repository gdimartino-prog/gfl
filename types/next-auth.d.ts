import NextAuth, { DefaultSession } from "next-auth"

declare module "next-auth" {
  /**
   * Returned by `useSession`, `auth`, etc.
   */
  interface Session {
    user: {
      team?: string;
    } & DefaultSession["user"]
  }

  interface User {
    team?: string;
  }
}

declare module "next-auth/jwt" {
  interface JWT {
    team?: string;
  }
}