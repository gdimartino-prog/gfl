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
        leagueId: { label: "League", type: "text" },
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
            logSystemEvent('Demo Commissioner', 'VV', 'LOGIN', 'Demo user accessed Front Office', 1);
            return { id: 'VV', name: 'Demo Commissioner', team: 'Vico', role: 'demo' };
          }

          const { db } = await import('@/lib/db');
          const { teams } = await import('@/schema');
          const { sql: drizzleSql, eq, and, or } = await import('drizzle-orm');
          const { default: bcrypt } = await import('bcrypt');

          const selectedLeagueId = credentials.leagueId ? parseInt(String(credentials.leagueId)) : null;
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
          // Scoped by leagueId when provided; accepts full team name OR team short code
          const leagueFilter = selectedLeagueId ? eq(teams.leagueId, selectedLeagueId) : drizzleSql`1=1`;
          const dbTeam = await db
            .select({
              teamshort: teams.teamshort,
              coach: teams.coach,
              name: teams.name,
              isCommissioner: teams.isCommissioner,
              password: teams.password,
              leagueId: teams.leagueId,
            })
            .from(teams)
            .where(and(
              drizzleSql`(lower(${teams.name}) = ${lookupName} OR lower(${teams.teamshort}) = ${lookupName})`,
              eq(teams.status, 'active'),
              leagueFilter,
            ))
            .orderBy(drizzleSql`${teams.password} IS NOT NULL DESC`)
            .limit(1);

          console.log('[auth] lookupName:', lookupName, '| found:', dbTeam[0]?.name, '| hasPassword:', !!dbTeam[0]?.password);

          if (dbTeam[0]?.password) {
            const passwordMatch = await bcrypt.compare(password, dbTeam[0].password);
            console.log('[auth] passwordMatch:', passwordMatch);
            if (passwordMatch) {
              const user = {
                id: dbTeam[0].teamshort!,
                name: dbTeam[0].coach!,
                team: dbTeam[0].name,
                role: dbTeam[0].isCommissioner ? 'admin' : 'coach',
                leagueId: dbTeam[0].leagueId ?? 1,
              };
              logSystemEvent(user.name, user.team, 'LOGIN', 'Coach entered Front Office', dbTeam[0].leagueId ?? undefined);
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
        token.leagueId = (user as { leagueId?: number }).leagueId ?? 1;
      }
      return token;
    },
    async session({ session, token }) {
      if (session.user) {
        session.user.id = token.id as string;
        session.user.role = token.role as string;
        session.user.team = token.team as string;
        (session.user as { leagueId?: number }).leagueId = token.leagueId as number ?? 1;
      }
      return session;
    },
  },
});
