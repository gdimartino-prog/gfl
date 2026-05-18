import { NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { rules, leagues } from '@/schema';
import { and, eq } from 'drizzle-orm';

function isAuthorized(req: Request) {
  return req.headers.get('authorization') === `Bearer ${process.env.CRON_SECRET}`;
}

export async function GET(req: Request) {
  if (!isAuthorized(req)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const res = await fetch('https://site.api.espn.com/apis/site/v2/sports/football/nfl/scoreboard');
    const data = await res.json();

    // ESPN seasonType: 1=preseason, 2=regular, 3=postseason, 4=off-season
    const seasonType: number = data.season.type;
    let currentWeek: number = data.week.number;
    const REGULAR_SEASON_WEEKS = 18;

    if (seasonType === 1 || seasonType === 4) {
      // Pre-season or off-season: regular season hasn't started, so any
      // GFL week-based logic that depends on this value should treat it
      // as "not yet in season". Store 0 to make that explicit.
      currentWeek = 0;
    } else if (seasonType === 3) {
      currentWeek = REGULAR_SEASON_WEEKS + currentWeek;
    }
    // seasonType === 2: regular season — use ESPN's week number as-is

    // Update all leagues
    const allLeagues = await db.select({ id: leagues.id }).from(leagues);
    for (const { id: leagueId } of allLeagues) {
      const existing = await db.select({ id: rules.id })
        .from(rules)
        .where(and(eq(rules.rule, 'current_nfl_week'), eq(rules.leagueId, leagueId)))
        .limit(1);

      if (existing[0]) {
        await db.update(rules)
          .set({ value: String(currentWeek), touch_id: 'cron-nfl-week' })
          .where(and(eq(rules.rule, 'current_nfl_week'), eq(rules.leagueId, leagueId)));
      } else {
        await db.insert(rules).values({
          leagueId, rule: 'current_nfl_week', value: String(currentWeek), touch_id: 'cron-nfl-week',
        });
      }
    }

    return NextResponse.json({ week: currentWeek, seasonType });
  } catch (error: unknown) {
    console.error('NFL week cron error:', error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}
