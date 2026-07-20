import { auth } from "@/auth";
import { db } from "./db";
import { teams } from "@/schema";
import { and, eq } from "drizzle-orm";
import { getLeagueId } from "./getLeagueId";

export async function isAdmin() {
  const session = await auth();
  const role = session?.user?.role;
  if (role === "superuser") return true;
  if (role !== "admin" && role !== "demo") return false;
  // verify commissioner status against DB (works for both 'admin' and 'demo' roles)
  return isCommissioner();
}

export async function isCommissioner() {
  const session = await auth();
  if (!session?.user) return false;
  const teamshort = (session.user as { id?: string }).id;
  if (!teamshort) return false;
  const leagueId = await getLeagueId();
  const result = await db.select({ isCommissioner: teams.isCommissioner })
    .from(teams)
    .where(and(eq(teams.teamshort, teamshort), eq(teams.leagueId, leagueId)))
    .limit(1);
  return result[0]?.isCommissioner || false;
}
