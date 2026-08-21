import 'dotenv/config';
import { db } from '../lib/db';
import { sql } from 'drizzle-orm';

// All draft pick transactions (trades involving picks)
const txns = await db.execute(sql`
  SELECT id, type, description, from_team, to_team, date, status
  FROM transactions
  WHERE league_id = 1
    AND description ILIKE '%draft pick%' OR description ILIKE '%round pick%' OR description ILIKE '%rd pick%'
    OR description ILIKE '%1st round%' OR description ILIKE '%2nd round%' OR description ILIKE '%3rd round%'
    OR description ILIKE '%4th round%' OR description ILIKE '%5th round%'
  ORDER BY date
`);

// Current state of all 2026 draft picks with owners
const picks2026 = await db.execute(sql`
  SELECT dp.pick, dp.round, dp.year, dp.draft_type,
    ot.teamshort AS orig_team, ot.name AS orig_name,
    ct.teamshort AS curr_team, ct.name AS curr_name,
    dp.selected_player_name
  FROM draft_picks dp
  JOIN teams ot ON ot.id = dp.original_team_id
  JOIN teams ct ON ct.id = dp.current_team_id
  WHERE dp.league_id = 1 AND dp.year = 2026 AND dp.draft_type = 'free_agent'
    AND dp.original_team_id != dp.current_team_id
  ORDER BY dp.round, dp.pick
`);

// Current state of all 2027 draft picks with owners
const picks2027 = await db.execute(sql`
  SELECT dp.pick, dp.round, dp.year, dp.draft_type,
    ot.teamshort AS orig_team, ot.name AS orig_name,
    ct.teamshort AS curr_team, ct.name AS curr_name,
    dp.selected_player_name
  FROM draft_picks dp
  JOIN teams ot ON ot.id = dp.original_team_id
  JOIN teams ct ON ct.id = dp.current_team_id
  WHERE dp.league_id = 1 AND dp.year = 2027 AND dp.draft_type = 'free_agent'
    AND dp.original_team_id != dp.current_team_id
  ORDER BY dp.round, dp.pick
`);

// Full draft pick transfer history
const transfers = await db.execute(sql`
  SELECT pt.year, pt.round, pt.draft_type,
    ot.teamshort AS orig_team, ct.teamshort AS curr_team,
    pt.history
  FROM draft_pick_transfers pt
  JOIN teams ot ON ot.id = pt.original_team_id
  JOIN teams ct ON ct.id = pt.current_team_id
  WHERE pt.league_id = 1
  ORDER BY pt.year, pt.round, pt.original_team_id
`);

console.log('=== TRANSACTIONS WITH DRAFT PICKS ===');
for (const r of txns.rows as any[]) {
  console.log(`[${r.date?.toISOString?.()?.slice(0,10) ?? r.date}] #${r.id} ${r.from_team} → ${r.to_team}: ${r.description}`);
}

console.log('\n=== DRAFT BOARD: 2026 TRADED PICKS (orig ≠ current) ===');
console.log('pick\tround\torig_team\tcurr_team\tplayer');
for (const r of picks2026.rows as any[]) {
  console.log(`${r.pick}\t${r.round}\t${r.orig_team}\t${r.curr_team}\t${r.selected_player_name ?? '—'}`);
}

console.log('\n=== DRAFT BOARD: 2027 TRADED PICKS (orig ≠ current) ===');
console.log('pick\tround\torig_team\tcurr_team');
for (const r of picks2027.rows as any[]) {
  console.log(`${r.pick}\t${r.round}\t${r.orig_team}\t${r.curr_team}`);
}

console.log('\n=== TRANSFER TABLE (all recorded transfers) ===');
console.log('year\tround\tdraft_type\torig_team\tcurr_team\thistory');
for (const r of transfers.rows as any[]) {
  console.log(`${r.year}\t${r.round}\t${r.draft_type}\t${r.orig_team}\t${r.curr_team}\t${JSON.stringify(r.history)}`);
}
