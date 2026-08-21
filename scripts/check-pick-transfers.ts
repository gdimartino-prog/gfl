import { db } from '../lib/db';
import { draftPicks, pickTransfers, teams } from '../schema';
import { eq, desc } from 'drizzle-orm';
import { alias } from 'drizzle-orm/pg-core';

const recent = await db.select({
  id: pickTransfers.id, year: pickTransfers.year, round: pickTransfers.round,
  currentTeamId: pickTransfers.currentTeamId, touch_dt: pickTransfers.touch_dt, touch_id: pickTransfers.touch_id,
}).from(pickTransfers).where(eq(pickTransfers.leagueId, 1)).orderBy(desc(pickTransfers.touch_dt)).limit(10);

console.log('Recent pickTransfers:');
recent.forEach(r => console.log(` year=${r.year} R${r.round} → teamId=${r.currentTeamId} at=${r.touch_dt} by=${r.touch_id}`));

const originalTeams = alias(teams, 'originalTeams');
const currentTeams = alias(teams, 'currentTeams');
const all = await db.select({
  id: draftPicks.id, year: draftPicks.year, round: draftPicks.round,
  originalTeam: originalTeams.name, currentOwner: currentTeams.name,
}).from(draftPicks)
  .leftJoin(originalTeams, eq(draftPicks.originalTeamId, originalTeams.id))
  .leftJoin(currentTeams, eq(draftPicks.currentTeamId, currentTeams.id))
  .where(eq(draftPicks.leagueId, 1));

const relevant = all.filter(p =>
  p.originalTeam?.includes('Old Bridge') || p.originalTeam?.includes('Kigali') ||
  p.currentOwner?.includes('Old Bridge') || p.currentOwner?.includes('Kigali')
);
console.log('\nOld Bridge / Kigali picks:');
relevant.forEach(p => console.log(` id=${p.id} year=${p.year} R${p.round} orig="${p.originalTeam}" → currentOwner="${p.currentOwner}"`));
process.exit(0);
