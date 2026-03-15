import { db } from './db';
import { players, teams } from '@/schema';
import { eq, and } from 'drizzle-orm';

/**
 * Execute a free agent pickup + waive transaction
 */
export async function executeFreeAgentMove(
  teamshort: string,
  addIdentity: string,
  dropIdentity: string,
  leagueId: number = 1,
) {
  // Find the team record
  const teamRow = await db.select({ id: teams.id })
    .from(teams)
    .where(and(eq(teams.teamshort, teamshort), eq(teams.leagueId, leagueId)))
    .limit(1);

  if (!teamRow[0]) throw new Error(`Team not found: ${teamshort}`);
  const teamId = teamRow[0].id;

  // Find the player to add (must be FA = no teamId)
  const addPlayer = await db.select({ id: players.id, teamId: players.teamId })
    .from(players)
    .where(and(eq(players.identity, addIdentity), eq(players.leagueId, leagueId)))
    .limit(1);

  if (!addPlayer[0]) throw new Error('Free agent not found');
  if (addPlayer[0].teamId !== null) throw new Error('Selected player is not a free agent');

  // Find the player to drop (must belong to this team)
  const dropPlayer = await db.select({ id: players.id, teamId: players.teamId })
    .from(players)
    .where(and(eq(players.identity, dropIdentity), eq(players.leagueId, leagueId)))
    .limit(1);

  if (!dropPlayer[0]) throw new Error('Player to waive not found');
  if (dropPlayer[0].teamId !== teamId) throw new Error('Player to waive does not belong to this team');

  // Execute both updates
  await Promise.all([
    db.update(players).set({ teamId, touch_id: teamshort }).where(eq(players.id, addPlayer[0].id)),
    db.update(players).set({ teamId: null, touch_id: 'FA' }).where(eq(players.id, dropPlayer[0].id)),
  ]);

  return { success: true };
}
