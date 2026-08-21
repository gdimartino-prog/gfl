import 'dotenv/config';
import { db } from '../lib/db';
import { sql } from 'drizzle-orm';

// All finalized draft picks (2026 free agent draft)
const picks = await db.execute(sql`
  SELECT dp.id, dp.pick, dp.round, dp.year, dp.draft_type,
    ct.teamshort AS current_owner, ct.name AS owner_name,
    dp.selected_player_name, p.name AS player_name, p.first, p.last,
    dp.picked_at
  FROM draft_picks dp
  JOIN teams ct ON ct.id = dp.current_team_id
  LEFT JOIN players p ON p.id = dp.player_id
  WHERE dp.league_id = 1
    AND dp.year = 2026
    AND dp.draft_type = 'free_agent'
    AND (dp.player_id IS NOT NULL OR dp.selected_player_name IS NOT NULL)
    AND dp.selected_player_name NOT LIKE 'SKIPPED%'
  ORDER BY dp.pick
`);

// All draft-related transactions
const txns = await db.execute(sql`
  SELECT t.id, t.type, t.description, t.from_team, t.to_team, t.owner, t.status, t.date
  FROM transactions t
  WHERE t.league_id = 1
    AND t.type ILIKE '%draft%'
  ORDER BY t.date
`);

console.log('=== DRAFT PICKS (finalized) ===');
console.log('pick\towner\tplayer_name\tselected_player_name');
for (const r of picks.rows as any[]) {
  const playerName = r.player_name ?? `${r.first ?? ''} ${r.last ?? ''}`.trim();
  console.log(`${r.pick}\t${r.current_owner}\t${playerName || '—'}\t${r.selected_player_name ?? '—'}`);
}

console.log('\n=== DRAFT TRANSACTIONS ===');
console.log('id\ttype\tfrom_team\tto_team\tdescription\tstatus\tdate');
for (const r of txns.rows as any[]) {
  console.log(`${r.id}\t${r.type}\t${r.from_team ?? '—'}\t${r.to_team ?? '—'}\t${r.description ?? '—'}\t${r.status}\t${r.date}`);
}

// Cross-check: find picks where player_name doesn't match selected_player_name
console.log('\n=== MISMATCHES (player_id name vs selected_player_name) ===');
for (const r of picks.rows as any[]) {
  const playerName = r.player_name ?? `${r.first ?? ''} ${r.last ?? ''}`.trim();
  const selName = (r.selected_player_name ?? '').replace(/^[A-Z]+ - /, ''); // strip position prefix
  if (playerName && selName && !selName.toLowerCase().includes(playerName.toLowerCase()) && !playerName.toLowerCase().includes(selName.toLowerCase())) {
    console.log(`Pick #${r.pick} (${r.current_owner}): player_id→"${playerName}" vs selected_player_name→"${r.selected_player_name}"`);
  }
}
