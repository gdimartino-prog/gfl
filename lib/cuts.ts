
import { db } from './db';
import { cuts, players, teams } from '@/schema';
import { eq } from 'drizzle-orm';

export type Cut = {
  id: number;
  playerId: number;
  teamId: number;
  touch_id?: string | null;
};

/**
 * Fetches all cuts from the database.
 */
export async function getCuts(): Promise<unknown[]> {
    return await db.select({
        id: cuts.id,
        playerName: players.name,
        teamName: teams.name,
    })
    .from(cuts)
    .leftJoin(players, eq(cuts.playerId, players.id))
    .leftJoin(teams, eq(cuts.teamId, teams.id));
}

/**
 * Adds a new cut.
 */
export async function addCut(cut: Omit<Cut, 'id'>, coachName: string) {
    await db.insert(cuts).values({
        ...cut,
        touch_id: coachName,
    });
}

/**
 * Removes a cut.
 */
export async function removeCut(id: number) {
    await db.delete(cuts).where(eq(cuts.id, id));
}
