import NextAuth from "next-auth";
import Credentials from "next-auth/providers/credentials";
import { logSystemEvent } from "@/lib/db-helpers";

export const { handlers, auth, signIn, signOut } = NextAuth({
  providers: [
    Credentials({
      name: "League Login",
      credentials: {
        username: { label: "Team Name", type: "text" },
        password: { label: "Password", type: "password" },
      },
      async authorize(credentials) {
        try {
          const rawInput = String(credentials.username).trim();
          const password = String(credentials.password).trim();

          // Superuser check — env-var credentials bypass league lookup
          const superUsername = process.env.SUPERUSER_USERNAME;
          const superPassword = process.env.SUPERUSER_PASSWORD;
          if (
            superUsername && superPassword &&
            rawInput.toLowerCase() === superUsername.toLowerCase() &&
            password === superPassword
          ) {
            logSystemEvent('Administrator', 'System', 'LOGIN', 'Superuser accessed Front Office');
            return { id: 'SUPER', name: 'Administrator', team: 'System', role: 'superuser' };
          }

          // Demo league check
          const demoUsername = process.env.DEMO_USERNAME;
          const demoPassword = process.env.DEMO_PASSWORD;
          if (
            demoUsername && demoPassword &&
            rawInput.toLowerCase() === demoUsername.toLowerCase() &&
            password === demoPassword
          ) {
            return { id: 'VV', name: 'Demo Commissioner', team: 'Vico', role: 'demo' };
          }

          const { db } = await import('@/lib/db');
          const { teams } = await import('@/schema');
          const { sql: drizzleSql, eq, and, or } = await import('drizzle-orm');
          const { default: bcrypt } = await import('bcrypt');

          let lookupName = rawInput.toLowerCase();

          // If input looks like an email, resolve to team name via DB
          if (rawInput.includes('@')) {
            const emailRows = await db
              .select({ name: teams.name })
              .from(teams)
              .where(drizzleSql`lower(${teams.email}) = ${rawInput.toLowerCase()}`)
              .limit(1);
            if (emailRows[0]?.name) lookupName = emailRows[0].name.toLowerCase();
          }

          // DB lookup — teams with bcrypt password (status = active)
          const dbTeam = await db
            .select({
              teamshort: teams.teamshort,
              coach: teams.coach,
              name: teams.name,
              isCommissioner: teams.isCommissioner,
              password: teams.password,
            })
            .from(teams)
            .where(and(
              drizzleSql`lower(${teams.name}) = ${lookupName}`,
              eq(teams.status, 'active')
            ))
            .limit(1);

          if (dbTeam[0]?.password) {
            const passwordMatch = await bcrypt.compare(password, dbTeam[0].password);
            if (passwordMatch) {
              const user = {
                id: dbTeam[0].teamshort!,
                name: dbTeam[0].coach!,
                team: dbTeam[0].name,
                role: dbTeam[0].isCommissioner ? 'admin' : 'coach',
              };
              logSystemEvent(user.name, user.team, 'LOGIN', 'Coach entered Front Office');
              return user;
            }
          }

          return null;
        } catch (error) {
          console.error("Auth Error:", error);
          return null;
        }
      },
    }),
  ],
  session: {
    strategy: "jwt",
    maxAge: 30 * 24 * 60 * 60,
    updateAge: 24 * 60 * 60,
  },
  pages: {
    signIn: "/login",
  },
  callbacks: {
    async jwt({ token, user }) {
      if (user) {
        token.id = user.id;
        token.role = user.role;
        token.team = user.team;
      }
      return token;
    },
    async session({ session, token }) {
      if (session.user) {
        session.user.id = token.id as string;
        session.user.role = token.role as string;
        session.user.team = token.team as string;
      }
      return session;
    },
  },
});
