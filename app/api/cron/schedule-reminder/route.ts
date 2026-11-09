import { NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { leagues } from '@/schema';
import { isAuthorizedCron } from '@/lib/cronAuth';
import { runScheduleReminderForLeague } from '@/lib/scheduleReminder';

export async function GET(req: Request) {
  if (!isAuthorizedCron(req)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const allLeagues = await db.select({ id: leagues.id }).from(leagues);
    const results = [];

    for (const { id: leagueId } of allLeagues) {
      results.push(await runScheduleReminderForLeague(leagueId));
    }

    return NextResponse.json({ results });
  } catch (error: unknown) {
    console.error('Schedule reminder cron error:', error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}
