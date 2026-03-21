/**
 * Reset 2026 FA transfers and reapply correctly by overall pick number.
 * Also add 2027 FA transfers to draft_pick_transfers.
 */
import { db } from '../lib/db';
import { draftPicks, pickTransfers, teams } from '../schema';
import { and, eq, sql } from 'drizzle-orm';

const trades2026 = [
  { round: 1,  overall: 11,  from: 'UF',  to: 'LES' },
  { round: 1,  overall: 14,  from: 'TFT', to: 'LM'  },
  { round: 1,  overall: 15,  from: 'LBI', to: 'CK'  },
  { round: 1,  overall: 18,  from: 'FPR', to: 'SG'  },
  { round: 2,  overall: 28,  from: 'CT',  to: 'AFL' },
  { round: 2,  overall: 29,  from: 'UF',  to: 'LES' },
  { round: 2,  overall: 31,  from: 'TT',  to: 'CK'  },
  { round: 2,  overall: 32,  from: 'TFT', to: 'OBG' },
  { round: 2,  overall: 36,  from: 'FPR', to: 'SG'  },
  { round: 3,  overall: 38,  from: 'SG',  to: 'OBG' },
  { round: 3,  overall: 47,  from: 'UF',  to: 'OBG' },
  { round: 3,  overall: 53,  from: 'AFL', to: 'CK'  },
  { round: 3,  overall: 54,  from: 'FPR', to: 'CK'  },
  { round: 4,  overall: 58,  from: 'OBG', to: 'AFL' },
  { round: 4,  overall: 59,  from: 'CK',  to: 'AFL' },
  { round: 4,  overall: 64,  from: 'CT',  to: 'OBG' },
  { round: 4,  overall: 70,  from: 'DC',  to: 'AFL' },
  { round: 4,  overall: 72,  from: 'FPR', to: 'SG'  },
  { round: 5,  overall: 78,  from: 'CK',  to: 'LBI' },
  { round: 10, overall: 172, from: 'CT',  to: 'AFL' },
];

const trades2027 = [
  { round: 1, from: 'FPR', to: 'VV'  },
  { round: 2, from: 'FPR', to: 'OBG' },
  { round: 3, from: 'FPR', to: 'VV'  },
  { round: 1, from: 'UF',  to: 'LES' },
  { round: 2, from: 'UF',  to: 'LES' },
  { round: 9, from: 'DC',  to: 'AFL' },
];

const LEAGUE_ID = 1;
const TOUCH_ID = 'trade-migration';

async function main() {
  // Build team map (teams that have 2026 picks)
  const teamRows = await db.execute(sql`
    SELECT DISTINCT t.teamshort, t.id FROM teams t
    JOIN draft_picks dp ON dp.original_team_id = t.id
    WHERE dp.league_id = ${LEAGUE_ID} AND dp.year = 2026 AND dp.draft_type = 'free_agent'
  `);
  const teamMap = new Map<string, number>();
  (teamRows as any).rows.forEach((r: any) => teamMap.set(r.teamshort, r.id));

  // Also need VV for 2027
  const allTeams = await db.execute(sql`SELECT teamshort, id FROM teams WHERE league_id = ${LEAGUE_ID}`);
  (allTeams as any).rows.forEach((r: any) => { if (!teamMap.has(r.teamshort)) teamMap.set(r.teamshort, r.id); });

  // Step 1: Reset all 2026 FA picks to original owner
  await db.execute(sql`
    UPDATE draft_picks SET current_team_id = original_team_id, touch_id = ${TOUCH_ID}
    WHERE league_id = ${LEAGUE_ID} AND year = 2026 AND draft_type = 'free_agent'
  `);
  console.log('✓ Reset 2026 FA picks to original owner');

  // Step 2: Clear 2026 FA transfers
  await db.delete(pickTransfers).where(and(
    eq(pickTransfers.leagueId, LEAGUE_ID),
    eq(pickTransfers.year, 2026),
    eq(pickTransfers.draftType, 'free_agent'),
  ));
  console.log('✓ Cleared 2026 FA draft_pick_transfers\n');

  // Step 3: Apply 2026 trades by overall pick number
  let applied = 0;
  for (const t of trades2026) {
    const toId = teamMap.get(t.to);
    if (!toId) { console.warn(`  SKIP overall=${t.overall}: unknown team "${t.to}"`); continue; }

    // Find pick by overall number
    const pick = await db.select({ id: draftPicks.id, originalTeamId: draftPicks.originalTeamId })
      .from(draftPicks)
      .where(and(
        eq(draftPicks.leagueId, LEAGUE_ID),
        eq(draftPicks.year, 2026),
        eq(draftPicks.draftType, 'free_agent'),
        eq(draftPicks.pick, t.overall),
      ))
      .limit(1);

    if (!pick[0]?.originalTeamId) { console.warn(`  SKIP overall=${t.overall}: pick not found`); continue; }

    await db.update(draftPicks).set({ currentTeamId: toId, touch_id: TOUCH_ID }).where(eq(draftPicks.id, pick[0].id));
    await db.insert(pickTransfers).values({
      leagueId: LEAGUE_ID, year: 2026, draftType: 'free_agent',
      round: t.round, originalTeamId: pick[0].originalTeamId, currentTeamId: toId, touch_id: TOUCH_ID,
    });

    console.log(`  ✓ 2026 R${t.round} #${t.overall}: ${t.from} → ${t.to}`);
    applied++;
  }

  // Step 4: Insert 2027 transfers (no draft picks exist yet)
  console.log('');
  for (const t of trades2027) {
    const fromId = teamMap.get(t.from);
    const toId = teamMap.get(t.to);
    if (!fromId || !toId) { console.warn(`  SKIP 2027 R${t.round}: unknown team`); continue; }

    await db.insert(pickTransfers)
      .values({ leagueId: LEAGUE_ID, year: 2027, draftType: 'free_agent', round: t.round, originalTeamId: fromId, currentTeamId: toId, touch_id: TOUCH_ID })
      .onConflictDoUpdate({
        target: [pickTransfers.leagueId, pickTransfers.year, pickTransfers.draftType, pickTransfers.round, pickTransfers.originalTeamId],
        set: { currentTeamId: toId, touch_id: TOUCH_ID, touch_dt: sql`now()` },
      });

    console.log(`  ✓ 2027 R${t.round}: ${t.from} → ${t.to}`);
    applied++;
  }

  console.log(`\nDone: ${applied} total trades applied.`);
}
main().catch(console.error).finally(() => process.exit(0));
