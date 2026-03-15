
import { db } from './db';
import { schedule, teams } from '@/schema';
import { and, eq } from 'drizzle-orm';
import { alias } from 'drizzle-orm/pg-core';
import { unstable_cache } from 'next/cache';

export type Schedule = {
    id: number;
    year?: number | null;
    week: string;
    homeTeamId: number;
    awayTeamId: number;
    home_score?: number | null;
    away_score?: number | null;
    is_bye?: boolean | null;
    touch_id?: string | null;
};

const _getSchedule = unstable_cache(
  async (leagueId: number, year: number | null) => {
    const homeTeams = alias(teams, 'homeTeams');
    const awayTeams = alias(teams, 'awayTeams');

    const conditions = year !== null
      ? and(eq(schedule.leagueId, leagueId), eq(schedule.year, year))
      : eq(schedule.leagueId, leagueId);

    const scheduleData = await db.select({
        id: schedule.id,
        year: schedule.year,
        week: schedule.week,
        home: homeTeams.name,
        visitor: awayTeams.name,
        hScore: schedule.home_score,
        vScore: schedule.away_score,
        isBye: schedule.is_bye,
    })
    .from(schedule)
    .leftJoin(homeTeams, eq(schedule.homeTeamId, homeTeams.id))
    .leftJoin(awayTeams, eq(schedule.awayTeamId, awayTeams.id))
    .where(conditions);

    return scheduleData.map(g => ({
      ...g,
      status: g.hScore !== null ? 'Final' : 'Scheduled',
    }));
  },
  ['schedule-data'],
  { revalidate: 60, tags: ['schedule'] }
);

export async function getSchedule(leagueId: number = 1, year: number | null = null) {
  try {
    return await _getSchedule(leagueId, year);
  } catch (err) {
    console.error("Schedule Fetch Error:", err);
    return [];
  }
}

export async function addSchedule(item: Omit<Schedule, 'id'>, coachName: string) {
    await db.insert(schedule).values({
        ...item,
        touch_id: coachName,
    });
}

export async function updateSchedule(id: number, item: Partial<Omit<Schedule, 'id'>>, coachName: string) {
    await db.update(schedule).set({
        ...item,
        touch_id: coachName,
    }).where(eq(schedule.id, id));
}

export async function deleteSchedule(id: number) {
    await db.delete(schedule).where(eq(schedule.id, id));
}