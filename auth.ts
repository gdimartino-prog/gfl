import NextAuth from "next-auth";
import Credentials from "next-auth/providers/credentials";
import { logSystemEvent } from "@/lib/db-helpers";
import { tokenBucket } from "@/lib/rateLimit";
import { timingSafeEqual } from "crypto";

// Constant-time string compare for env-credential checks
function safeEqual(a: string, b: string): boolean {
  const bufA = Buffer.from(a);
  const bufB = Buffer.from(b);
  if (bufA.length !== bufB.length) return false;
  return timingSafeEqual(bufA, bufB);
}

export const { handlers, auth, signIn, signOut } = NextAuth({
  providers: [
    Credentials({
      name: "League Login",
      credentials: {
        username: { label: "Team Name", type: "text" },
        password: { label: "Password", type: "password" },
        leagueId: { label: "League", type: "text" },
      },
      async authorize(credentials, request) {
        try {
          const rawInput = String(credentials.username).trim();
          const password = String(credentials.password).trim();

          // Per-IP throttle to blunt credential brute-forcing. Keyed on IP (not
          // IP+username) so rotating usernames — or submitting an email vs the
          // team name they resolve to — can't reset the budget.
          const ip = (request?.headers?.get('x-forwarded-for')?.split(',')[0] || 'unknown').trim();
          const rl = tokenBucket(`login:${ip}`, 8, 600);
          if (!rl.ok) {
            // Record at most one audit row per IP per window. Every rejected
            // request reaches this branch, so logging unconditionally turns a
            // brute-force flood into unbounded DB writes / cost.
            if (tokenBucket(`loginlog:${ip}`, 1, 600).ok) {
              await logSystemEvent('System', 'System', 'LOGIN_RATE_LIMITED', `Rate limited login attempts from ${ip}`);
            }
            return null;
          }

          // Superuser check — env-var credentials bypass league lookup
          const superUsername = process.env.SUPERUSER_USERNAME;
          const superPassword = process.env.SUPERUSER_PASSWORD;
          if (
            superUsername && superPassword &&
            rawInput.toLowerCase() === superUsername.toLowerCase() &&
            safeEqual(password, superPassword)
          ) {
            await logSystemEvent('Administrator', 'System', 'LOGIN', 'Superuser accessed Front Office');
            return { id: 'SUPER', name: 'Administrator', team: 'System', role: 'superuser' };
          }

          // Demo league check
          const demoUsername = process.env.DEMO_USERNAME;
          const demoPassword = process.env.DEMO_PASSWORD;
          if (
            demoUsername && demoPassword &&
            rawInput.toLowerCase() === demoUsername.toLowerCase() &&
            safeEqual(password, demoPassword)
          ) {
            await logSystemEvent('Demo Commissioner', 'VV', 'LOGIN', 'Demo user accessed Front Office', 2);
            return { id: 'VV', name: 'Demo Commissioner', team: 'Vico', role: 'demo', leagueId: 2 };
          }

          const { db } = await import('@/lib/db');
          const { teams } = await import('@/schema');
          const { sql: drizzleSql, eq, and } = await import('drizzle-orm');
          const { default: bcrypt } = await import('bcrypt');

          const selectedLeagueId = credentials.leagueId ? parseInt(String(credentials.leagueId)) : null;
          // League team logins must name their league — an unscoped lookup
          // could authenticate against a same-named team in another league.
          if (!selectedLeagueId || isNaN(selectedLeagueId)) return null;
          let lookupName = rawInput.toLowerCase();

          // If input looks like an email, resolve to team name via DB
          // (scoped to the selected league)
          if (rawInput.includes('@')) {
            const emailRows = await db
              .select({ name: teams.name })
              .from(teams)
              .where(and(
                drizzleSql`lower(${teams.email}) = ${rawInput.toLowerCase()}`,
                eq(teams.leagueId, selectedLeagueId),
              ))
              .limit(1);
            if (emailRows[0]?.name) lookupName = emailRows[0].name.toLowerCase();
          }

          // DB lookup — teams with bcrypt password (status = active)
          // Accepts full team name OR team short code
          const leagueFilter = eq(teams.leagueId, selectedLeagueId);
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

          const teamRow = dbTeam[0];
          // teamshort is the session identity and is nullable on the schema —
          // refuse the login rather than mint a session with a null id.
          if (teamRow?.password && teamRow.teamshort) {
            const passwordMatch = await bcrypt.compare(password, teamRow.password);
            if (passwordMatch) {
              const user = {
                id: teamRow.teamshort,
                name: teamRow.coach!,
                team: teamRow.name,
                role: teamRow.isCommissioner ? 'admin' : 'coach',
                leagueId: teamRow.leagueId ?? 1,
              };
              // Awaited — Vercel kills unawaited promises on response return
              await logSystemEvent(user.name, user.team, 'LOGIN', 'Coach entered Front Office', teamRow.leagueId ?? undefined);
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
      // Normalize superuser name — stale tokens may have the raw env-var value
      if (token.id === 'SUPER') token.name = 'Administrator';
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
