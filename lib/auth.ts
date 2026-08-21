import { auth } from "@/auth";
import { db } from "./db";
import { teams } from "@/schema";
import { and, eq, sql } from "drizzle-orm";
import { getLeagueId } from "./getLeagueId";
import { cache } from "react";

export async function isAdmin() {
  const session = await auth();
  const role = session?.user?.role;
  if (role === "superuser") return true;
  if (role !== "admin" && role !== "demo") return false;
  // verify commissioner status against DB (works for both 'admin' and 'demo' roles)
  return isCommissioner();
}

// React cache(): at most one commissioner DB lookup per request, however many
// times routes call isCommissioner()/isAdmin()/isPrivileged().
export const isCommissioner = cache(async function isCommissionerImpl() {
  const session = await auth();
  if (!session?.user) return false;
  const teamshort = (session.user as { id?: string }).id;
  if (!teamshort) return false;
  const leagueId = await getLeagueId();
  // upper() on both sides — some leagues have mixed-case teamshort seeds
  const result = await db.select({ isCommissioner: teams.isCommissioner })
    .from(teams)
    .where(and(
      sql`upper(${teams.teamshort}) = ${teamshort.toUpperCase()}`,
      eq(teams.leagueId, leagueId),
    ))
    .limit(1);
  return result[0]?.isCommissioner || false;
});

/**
 * Superuser, or DB-verified commissioner in the active league. Use this
 * instead of `await isAdmin() || await isCommissioner()` (redundant — two
 * sequential DB lookups) and instead of trusting the JWT role alone (stale
 * for up to 30 days after a demotion).
 */
export async function isPrivileged() {
  const session = await auth();
  if (session?.user?.role === "superuser") return true;
  return isCommissioner();
}
