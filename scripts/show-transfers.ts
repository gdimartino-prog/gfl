import { db } from '../lib/db';
import { pickTransfers, teams } from '../schema';
import { eq, and } from 'drizzle-orm';
import { alias } from 'drizzle-orm/pg-core';

const origTeam = alias(teams, 'orig');
const currTeam = alias(teams, 'curr');

const rows = await db.select({
  id: pickTransfers.id,
  year: pickTransfers.year,
  round: pickTransfers.round,
  draftType: pickTransfers.draftType,
  from: origTeam.name,
  to: currTeam.name,
  touch_dt: pickTransfers.touch_dt,
})
  .from(pickTransfers)
  .innerJoin(origTeam, eq(pickTransfers.originalTeamId, origTeam.id))
  .innerJoin(currTeam, eq(pickTransfers.currentTeamId, currTeam.id))
  .where(eq(pickTransfers.leagueId, 1))
  .orderBy(pickTransfers.touch_dt);

console.log('Current pick transfers:');
rows.forEach(r => console.log(`ID=${r.id}  ${r.year} Rd${r.round} (${r.draftType})  ${r.from} → ${r.to}  [${r.touch_dt?.toLocaleString()}]`));
process.exit(0);
