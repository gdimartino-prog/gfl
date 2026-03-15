import NextAuth from "next-auth";
import Credentials from "next-auth/providers/credentials";
import { sheets, SHEET_ID } from "@/lib/googleSheets";

// Helper to log events to the AuditLog tab
async function logSystemEvent(coach: string, team: string, action: string, details: string = "") {
  try {
    const timestamp = new Date().toLocaleString('en-US', { timeZone: 'America/New_York' });
    await sheets.spreadsheets.values.append({
      spreadsheetId: SHEET_ID,
      range: "AuditLog!A:E",
      valueInputOption: "RAW",
      requestBody: {
        values: [[timestamp, coach, team, action, details]],
      },
    });
  } catch (error) {
    console.error("Audit Log Failure:", error);
  }
}

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

          // Demo league check — env-var credentials return AFL Vico commissioner session
          const demoUsername = process.env.DEMO_USERNAME;
          const demoPassword = process.env.DEMO_PASSWORD;
          if (
            demoUsername && demoPassword &&
            rawInput.toLowerCase() === demoUsername.toLowerCase() &&
            password === demoPassword
          ) {
            return { id: 'VV', name: 'Demo Commissioner', team: 'Vico', role: 'demo' };
          }

          const response = await sheets.spreadsheets.values.get({
            spreadsheetId: SHEET_ID,
            range: "Coaches!A:H",
          });

          const rows = response.data.values;
          if (!rows || rows.length < 2) return null;

          let lookupName = rawInput.toLowerCase();

          // If input looks like an email, resolve to team name via DB
          if (rawInput.includes('@')) {
            try {
              const { db } = await import('@/lib/db');
              const { teams } = await import('@/schema');
              const { sql } = await import('drizzle-orm');
              const teamRows = await db
                .select({ name: teams.name })
                .from(teams)
                .where(sql`lower(${teams.email}) = ${rawInput.toLowerCase()}`)
                .limit(1);
              if (teamRows[0]?.name) lookupName = teamRows[0].name.toLowerCase();
            } catch {}
          }

          const match = rows.slice(1).find(row =>
            row[0]?.trim().toLowerCase() === lookupName &&
            row[7]?.trim() === password
          );

          if (match) {
            const user = {
              id: match[1],   // Team Shortcode (e.g., LBI, AFL, VICO)
              name: match[2], // Coach Name
              team: match[0], // Full Team Name
              role: match[3]?.toUpperCase() === "TRUE" ? "admin" : "coach",
            };
            logSystemEvent(user.name, user.team, "LOGIN", "Coach entered Front Office");
            return user;
          }

          // DB fallback — for accounts created via signup (bcrypt passwords, status = active)
          try {
            const { db } = await import('@/lib/db');
            const { teams } = await import('@/schema');
            const { sql: drizzleSql, eq, and } = await import('drizzle-orm');
            const { default: bcrypt } = await import('bcrypt');

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
                logSystemEvent(user.name, user.team, "LOGIN", "Coach entered Front Office");
                return user;
              }
            }
          } catch {}

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
      // If this is the first time the user logs in, attach properties to the token
      if (user) {
        token.id = user.id; // Crucial: Store the shortcode (e.g. LBI) in the token
        token.role = user.role;
        token.team = user.team;
      }
      return token;
    },
    async session({ session, token }) {
      // Pass properties from the token to the session object accessible by useSession()
      if (session.user) {
        session.user.id = token.id as string; // This fixes "HOME_FRANCHISE: NONE"
        session.user.role = token.role as string;
        session.user.team = token.team as string;
      }
      return session;
    },
  },
});