
import { db } from './db';
import { cuts, teams } from '@/schema';
import { eq } from 'drizzle-orm';

export type Cut = {
  id: number;
  teamId: number;
  touch_id?: string | null;
};

/**
 * Fetches all cuts from the database.
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export async function getCuts(): Promise<any[]> {
    return await db.select({
        id: cuts.id,
        firstName: cuts.firstName,
        lastName: cuts.lastName,
        teamName: teams.name,
    })
    .from(cuts)
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
