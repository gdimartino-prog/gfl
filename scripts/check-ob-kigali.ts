import { db } from '../lib/db';
import { teams, draftPicks } from '../schema';
import { eq, and } from 'drizzle-orm';

// Check team shortcodes for Old Bridge and Kigali
const allTeams = await db.select({ id: teams.id, name: teams.name, teamshort: teams.teamshort, leagueId: teams.leagueId })
  .from(teams).where(eq(teams.leagueId, 1));

const ob = allTeams.filter(t => t.name?.includes('Old Bridge') || t.teamshort?.includes('OB'));
const kg = allTeams.filter(t => t.name?.includes('Kigali') || t.teamshort?.includes('KG') || t.teamshort?.includes('KI'));
console.log('Old Bridge teams:', ob);
console.log('Kigali teams:', kg);

// Find the specific picks by overall number
const picks = await db.select({ id: draftPicks.id, year: draftPicks.year, round: draftPicks.round, pick: draftPicks.pick, currentTeamId: draftPicks.currentTeamId, originalTeamId: draftPicks.originalTeamId })
  .from(draftPicks)
  .where(and(eq(draftPicks.leagueId, 1), eq(draftPicks.year, 2026)));

const relevant = picks.filter(p => [22, 27, 43, 64].includes(p.pick ?? -1));
console.log('\n2026 picks with overall 22, 27, 43, 64:');
relevant.forEach(p => console.log(` id=${p.id} R${p.round} pick#${p.pick} currentTeamId=${p.currentTeamId} origTeamId=${p.originalTeamId}`));
process.exit(0);
