import { DefaultSession } from "next-auth"

declare module "next-auth" {
  /**
   * Returned by `useSession`, `auth`, etc.
   */
  interface Session {
    user: {
      team?: string;
      id?: string;
      role?: string;
    } & DefaultSession["user"]
  }

  interface User {
    team?: string;
    id?: string;
    role?: string;
  }
}

declare module "next-auth/jwt" {
  interface JWT {
    team?: string;
    id?: string;
    role?: string;
  }
}