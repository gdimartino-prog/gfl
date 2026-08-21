import { db } from '../lib/db';
import { draftPicks, rules } from '../schema';
import { and, eq, isNull, sql } from 'drizzle-orm';

const open = await db.select({ round: draftPicks.round, pick: draftPicks.pick })
  .from(draftPicks)
  .where(and(
    eq(draftPicks.leagueId, 1), eq(draftPicks.year, 2026),
    eq(draftPicks.draftType, 'free_agent'),
    eq(draftPicks.passed, false),
    isNull(draftPicks.playerId),
    isNull(draftPicks.selectedPlayerName),
  ));

const r = await db.select().from(rules)
  .where(and(eq(rules.leagueId, 1), eq(rules.rule, 'draft_cutoff_sent')));

const last = await db.execute(sql`
  SELECT dp.picked_at, t.teamshort, dp.round
  FROM draft_picks dp LEFT JOIN teams t ON dp.current_team_id = t.id
  WHERE dp.league_id = 1 AND dp.year = 2026 AND dp.draft_type = 'free_agent'
    AND dp.picked_at IS NOT NULL
  ORDER BY dp.picked_at DESC LIMIT 1
`);
const latest = last.rows[0] as any;
const ms = latest?.picked_at ? Date.now() - new Date(latest.picked_at).getTime() : null;

console.log('Open picks:', open.length);
console.log('Last pick:', latest?.teamshort, 'R' + latest?.round, '@', latest?.picked_at);
console.log('Hours since last pick:', ms ? (ms / 3600000).toFixed(1) : 'N/A');
console.log('Cutoff sent:', r[0]?.value ?? 'none', '| year:', r[0]?.year ?? 'none');

const skipped = await db.execute(sql`
  SELECT dp.round, dp.pick, t.teamshort, dp.selected_player_name
  FROM draft_picks dp LEFT JOIN teams t ON dp.current_team_id = t.id
  WHERE dp.league_id = 1 AND dp.year = 2026 AND dp.draft_type = 'free_agent'
    AND dp.player_id IS NULL AND dp.passed = false
    AND dp.selected_player_name LIKE 'SKIPPED%'
  ORDER BY dp.pick
`);
console.log('\nSkipped / late-selection eligible:', skipped.rows.length);
for (const p of skipped.rows as any[]) {
  console.log(' ', p.teamshort, 'R' + p.round, '#' + p.pick, '-', p.selected_player_name);
}
