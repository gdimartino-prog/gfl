
import { db } from './db';
import { teams } from '@/schema';
import { eq } from 'drizzle-orm';

export type Coach = {
  coach: string;
  team: string;
  teamshort: string;
  nickname: string;
  isCommissioner: boolean;
  status: string;
  mobile: string;
  email: string;
  lastSync: string;
};

// Reads teams table and returns coaches, optionally filtered by league
export async function getCoaches(leagueId: number = 1): Promise<Coach[]> {
  const allTeams = await db.select().from(teams).where(eq(teams.leagueId, leagueId));
  return allTeams.map(t => ({
      team: t.name,
      coach: t.coach || '',
      teamshort: t.teamshort || '',
      nickname: t.nickname || '',
      isCommissioner: t.isCommissioner || false,
      status: t.status || 'active',
      mobile: t.mobile || '',
      email: t.email || '',
      lastSync: t.touch_dt?.toString() || '',
  }));
}

export async function getCoachByTeamCode(teamCode: string) {
    const team = await db.select().from(teams).where(eq(teams.id, parseInt(teamCode)));
    if (team.length === 0) return null;
    const t = team[0];
    return {
        team: t.name,
        coach: t.coach || '',
        teamshort: t.teamshort || '',
        nickname: t.nickname || '',
        isCommissioner: t.isCommissioner || false,
        status: t.status || 'active',
        mobile: t.mobile || '',
        email: t.email || '',
        lastSync: t.touch_dt?.toString() || '',
    }
}

/**
 * Updates coach contact information in the Coaches tab
 */
export async function updateCoachContact(
    teamCode: string,
    mobile: string,
    email: string,
    coach?: string,
    nickname?: string,
    team?: string,
) {
    try {
        const fields: Record<string, unknown> = { mobile, email };
        if (coach !== undefined) fields.coach = coach;
        if (nickname !== undefined) fields.nickname = nickname;
        if (team !== undefined) fields.name = team;
        await db.update(teams).set(fields).where(eq(teams.teamshort, teamCode.toUpperCase()));
        return { success: true };
    } catch (error) {
        console.error("❌ Failed to update coach contact:", error);
        return { success: false };
    }
}

/**
 * Updates the last_sync timestamp for a specific coach in the Coaches tab (Column I)
 */
export async function updateCoachSync(teamCode: string) {
    try {
        await db.update(teams).set({ touch_dt: new Date() }).where(eq(teams.teamshort, teamCode.toUpperCase()));
        return { success: true, timestamp: new Date() };
    } catch (error) {
        console.error("❌ Failed to update coach sync timestamp:", error);
        return { success: false };
    }
}
