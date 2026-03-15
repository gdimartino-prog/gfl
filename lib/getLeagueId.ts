import { cookies } from 'next/headers';
import { auth } from '@/auth';
import { db } from './db';
import { teams } from '@/schema';
import { eq } from 'drizzle-orm';

const DEFAULT_LEAGUE_ID = 1;

/**
 * Server-side helper: resolves the active leagueId for the current request.
 *
 * Priority:
 *  1. Superuser: always use the cookie
 *  2. Authenticated user: use the cookie if it matches one of their leagues,
 *     otherwise fall back to their natural (first) league from DB
 *  3. Unauthenticated: cookie → default 1
 */
export async function getLeagueId(): Promise<number> {
  const session = await auth();
  const user = session?.user as { id?: string; role?: string } | undefined;
  const teamshort = user?.id;
  const role = user?.role;
  const isSuperuser = role === 'superuser';

  const cookieStore = await cookies();
  const cookieVal = cookieStore.get('gfl-league-id')?.value;
  const cookieLeagueId = cookieVal ? parseInt(cookieVal, 10) : null;

  // Superuser can access any league via cookie
  if (isSuperuser) {
    if (cookieLeagueId && !isNaN(cookieLeagueId)) return cookieLeagueId;
  }

  // For authenticated users, look up all leagues they belong to
  if (teamshort) {
    const rows = await db
      .select({ leagueId: teams.leagueId })
      .from(teams)
      .where(eq(teams.teamshort, teamshort.toUpperCase()));

    const leagueIds = rows.map(r => r.leagueId).filter(Boolean) as number[];

    if (leagueIds.length > 0) {
      // If cookie points to a valid league for this user, honour it
      if (cookieLeagueId && !isNaN(cookieLeagueId) && leagueIds.includes(cookieLeagueId)) {
        return cookieLeagueId;
      }
      // Otherwise use their natural (first) league
      return leagueIds[0];
    }
  }

  // Unauthenticated: cookie → default
  if (cookieLeagueId && !isNaN(cookieLeagueId)) return cookieLeagueId;
  return DEFAULT_LEAGUE_ID;
}
