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
          const response = await sheets.spreadsheets.values.get({
            spreadsheetId: SHEET_ID,
            range: "Coaches!A:H", 
          });

          const rows = response.data.values;
          if (!rows || rows.length < 2) return null;

          const match = rows.slice(1).find(row => 
            row[0]?.trim().toLowerCase() === String(credentials.username).trim().toLowerCase() &&
            row[7]?.trim() === String(credentials.password).trim()
          );

          if (match) {
            const user = {
              id: match[1],   // Team Shortcode (e.g., LBI, AFL, VICO)
              name: match[2], // Coach Name
              team: match[0], // Full Team Name
              role: match[3]?.toUpperCase() === "TRUE" ? "admin" : "coach",
            };

            // Log login event
            logSystemEvent(user.name, user.team, "LOGIN", "Coach entered Front Office");

            return user;
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
      // If this is the first time the user logs in, attach properties to the token
      if (user) {
        token.id = (user as any).id; // Crucial: Store the shortcode (e.g. LBI) in the token
        token.role = (user as any).role;
        token.team = (user as any).team;
      }
      return token;
    },
    async session({ session, token }) {
      // Pass properties from the token to the session object accessible by useSession()
      if (session.user) {
        (session.user as any).id = token.id as string; // This fixes "HOME_FRANCHISE: NONE"
        (session.user as any).role = token.role as string;
        (session.user as any).team = token.team as string;
      }
      return session;
    },
  },
});