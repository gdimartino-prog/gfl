import { NextResponse } from 'next/server';
import { isAdmin } from '@/lib/auth';
import { db } from '@/lib/db';
import { schedule, teams } from '@/schema';
import { and, eq, sql } from 'drizzle-orm';
import { getLeagueId } from '@/lib/getLeagueId';
import { alias } from 'drizzle-orm/pg-core';
import { revalidateTag } from 'next/cache';

export const dynamic = 'force-dynamic';

export async function GET(req: Request) {
  const admin = await isAdmin();
  if (!admin) return NextResponse.json({ error: 'Unauthorized' }, { status: 403 });

  const leagueId = await getLeagueId();
  const { searchParams } = new URL(req.url);
  const year = searchParams.get('year');

  const homeTeams = alias(teams, 'homeTeams');
  const awayTeams = alias(teams, 'awayTeams');

  const rows = await db.select({
    id: schedule.id,
    year: schedule.year,
    week: schedule.week,
    homeTeamId: schedule.homeTeamId,
    awayTeamId: schedule.awayTeamId,
    home: homeTeams.name,
    visitor: awayTeams.name,
    hScore: schedule.home_score,
    vScore: schedule.away_score,
  })
  .from(schedule)
  .leftJoin(homeTeams, eq(schedule.homeTeamId, homeTeams.id))
  .leftJoin(awayTeams, eq(schedule.awayTeamId, awayTeams.id))
  .where(
    year
      ? and(eq(schedule.leagueId, leagueId), eq(schedule.year, parseInt(year)))
      : eq(schedule.leagueId, leagueId)
  )
  .orderBy(schedule.year, sql`CAST(${schedule.week} AS INTEGER)`);

  return NextResponse.json(rows);
}

export async function POST(req: Request) {
  const admin = await isAdmin();
  if (!admin) return NextResponse.json({ error: 'Unauthorized' }, { status: 403 });

  const leagueId = await getLeagueId();
  const { year, week, homeTeamId, awayTeamId, hScore, vScore } = await req.json();

  if (!week || !homeTeamId || !awayTeamId) {
    return NextResponse.json({ error: 'week, homeTeamId, and awayTeamId are required' }, { status: 400 });
  }

  const [row] = await db.insert(schedule).values({
    leagueId,
    year: year || null,
    week: String(week).trim(),
    homeTeamId: parseInt(homeTeamId),
    awayTeamId: parseInt(awayTeamId),
    home_score: hScore !== '' && hScore != null ? parseInt(hScore) : null,
    away_score: vScore !== '' && vScore != null ? parseInt(vScore) : null,
    is_bye: false,
    touch_id: 'commissioner',
  }).returning();

  revalidateTag('schedule', 'max');
  return NextResponse.json(row, { status: 201 });
}

export async function PATCH(req: Request) {
  const admin = await isAdmin();
  if (!admin) return NextResponse.json({ error: 'Unauthorized' }, { status: 403 });

  const leagueId = await getLeagueId();
  const { id, week, homeTeamId, awayTeamId, hScore, vScore, year } = await req.json();

  if (!id) return NextResponse.json({ error: 'id is required' }, { status: 400 });

  await db.update(schedule).set({
    year: year != null ? parseInt(year) : undefined,
    week: week != null ? String(week).trim() : undefined,
    homeTeamId: homeTeamId != null ? parseInt(homeTeamId) : undefined,
    awayTeamId: awayTeamId != null ? parseInt(awayTeamId) : undefined,
    home_score: hScore !== '' && hScore != null ? parseInt(hScore) : null,
    away_score: vScore !== '' && vScore != null ? parseInt(vScore) : null,
    touch_id: 'commissioner',
  }).where(and(eq(schedule.id, id), eq(schedule.leagueId, leagueId)));

  revalidateTag('schedule', 'max');
  return NextResponse.json({ success: true });
}

export async function DELETE(req: Request) {
  const admin = await isAdmin();
  if (!admin) return NextResponse.json({ error: 'Unauthorized' }, { status: 403 });

  const leagueId = await getLeagueId();
  const { id } = await req.json();
  if (!id) return NextResponse.json({ error: 'id is required' }, { status: 400 });

  await db.delete(schedule).where(and(eq(schedule.id, id), eq(schedule.leagueId, leagueId)));
  revalidateTag('schedule', 'max');
  return NextResponse.json({ success: true });
}
