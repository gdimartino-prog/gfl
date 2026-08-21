import { cookies } from 'next/headers';
import { auth } from '@/auth';
import { db } from './db';
import { teams } from '@/schema';
import { eq, and, sql } from 'drizzle-orm';
import { unstable_cache } from 'next/cache';
import { cache } from 'react';

const DEFAULT_LEAGUE_ID = 1;

/**
 * Leagues this user may act in. Membership is keyed on the login team's
 * email — the same rule /api/leagues uses to build the league switcher.
 * teamshort alone is NOT a valid cross-league identity: shortcodes repeat
 * across leagues for different people, so honouring the cookie on a bare
 * shortcode match would let a coach impersonate another league's team.
 */
const _getAllowedLeagueIds = unstable_cache(
  async (teamshortUpper: string, homeLeagueId: number): Promise<number[]> => {
    const homeTeam = await db
      .select({ email: teams.email })
      .from(teams)
      .where(and(
        eq(teams.leagueId, homeLeagueId),
        sql`upper(${teams.teamshort}) = ${teamshortUpper}`,
      ))
      .limit(1);

    const email = homeTeam[0]?.email?.trim().toLowerCase();
    if (!email) return [homeLeagueId];

    const rows = await db
      .selectDistinct({ leagueId: teams.leagueId })
      .from(teams)
      .where(and(
        sql`lower(${teams.email}) = ${email}`,
        sql`${teams.password} IS NOT NULL`,
      ));
    const ids = rows.map(r => r.leagueId).filter((id): id is number => id != null);
    return ids.includes(homeLeagueId) ? ids : [homeLeagueId, ...ids];
  },
  ['allowed-leagues'],
  { revalidate: 300, tags: ['team-leagues'] },
);

/**
 * Server-side helper: resolves the active leagueId for the current request.
 *
 * Priority:
 *  1. Superuser: always use the cookie
 *  2. Demo: locked to league 2
 *  3. Authenticated coach: use the cookie if it names a league where this
 *     person (matched by email) has a credentialed team, otherwise their
 *     login league from the session
 *  4. Unauthenticated: cookie → default 1
 *
 * Wrapped in React's cache() so layout/metadata/footer/page all share one
 * resolution per request instead of each running auth + cookies + DB.
 */
export const getLeagueId = cache(async function getLeagueIdImpl(): Promise<number> {
  const session = await auth();
  const user = session?.user as { id?: string; role?: string; leagueId?: number } | undefined;
  const teamshort = user?.id;
  const role = user?.role;

  const cookieStore = await cookies();
  const cookieVal = cookieStore.get('gfl-league-id')?.value;
  const cookieLeagueId = cookieVal ? parseInt(cookieVal, 10) : null;

  // Superuser can access any league via cookie
  if (role === 'superuser') {
    if (cookieLeagueId && !isNaN(cookieLeagueId)) return cookieLeagueId;
    return DEFAULT_LEAGUE_ID;
  }

  // Demo users are locked to the demo league regardless of cookie
  if (role === 'demo') return 2;

  if (teamshort) {
    const homeLeagueId = user?.leagueId ?? DEFAULT_LEAGUE_ID;
    if (cookieLeagueId && !isNaN(cookieLeagueId) && cookieLeagueId !== homeLeagueId) {
      const allowed = await _getAllowedLeagueIds(teamshort.toUpperCase(), homeLeagueId);
      if (allowed.includes(cookieLeagueId)) return cookieLeagueId;
    }
    return homeLeagueId;
  }

  // Unauthenticated: cookie → default
  if (cookieLeagueId && !isNaN(cookieLeagueId)) return cookieLeagueId;
  return DEFAULT_LEAGUE_ID;
});
