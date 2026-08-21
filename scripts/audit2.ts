import 'dotenv/config';
import { db } from '../lib/db';
import { sql } from 'drizzle-orm';

const pick1 = await db.execute(sql`
  SELECT dp.id, dp.pick, dp.current_team_id, dp.original_team_id,
    ot.teamshort AS orig_team, ct.teamshort AS curr_team,
    dp.selected_player_name, p.name AS player_name, p.team_id AS player_team_id,
    pt.teamshort AS player_team
  FROM draft_picks dp
  JOIN teams ot ON ot.id = dp.original_team_id
  JOIN teams ct ON ct.id = dp.current_team_id
  LEFT JOIN players p ON p.id = dp.player_id
  LEFT JOIN teams pt ON pt.id = p.team_id
  WHERE dp.league_id = 1 AND dp.year = 2026 AND dp.pick = 1
`);
console.log('=== Pick #1 ===');
for (const r of pick1.rows as any[]) {
  console.log(`id=${r.id} orig=${r.orig_team} curr=${r.curr_team} player="${r.player_name}" player_team=${r.player_team} selected_name="${r.selected_player_name}"`);
}

const txns = await db.execute(sql`
  SELECT id, type, description, from_team, to_team, owner, status, date
  FROM transactions WHERE league_id = 1
  ORDER BY date DESC LIMIT 20
`);
console.log('\n=== Recent Transactions (all types) ===');
for (const r of txns.rows as any[]) {
  console.log(`id=${r.id} type=${r.type} from=${r.from_team} to=${r.to_team} desc="${r.description}" status=${r.status} date=${r.date}`);
}
