/**
 * Migrates DraftPicks from GFL Google Sheet → Postgres for both leagues.
 * - League 1 (GFL): all 456 rows, using GFL team IDs
 * - League 2 (AFL): same picks, remapped to AFL team IDs by teamshort (skips picks where either team doesn't exist in AFL)
 *
 * Run: npx tsx scripts/migrate-draft-picks.ts
 */
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: path.resolve(__dirname, '../.env.local') });

async function main() {
  const { getGoogleAuth } = await import('../lib/google-cloud.ts');
  const { google } = await import('googleapis');
  const { db } = await import('../lib/db.ts');
  const { draftPicks, teams, players } = await import('../schema.ts');
  const { eq, and, ilike } = await import('drizzle-orm');

  // ── 1. Fetch sheet data ──────────────────────────────────────────────────
  const auth = getGoogleAuth();
  const sheets = google.sheets({ version: 'v4', auth });
  const res = await sheets.spreadsheets.values.get({
    spreadsheetId: process.env.GOOGLE_SHEET_ID!,
    range: 'DraftPicks!A:K',
  });
  const rows = (res.data.values ?? []).slice(1).filter(r => r[0] && r[1] && r[2]);
  console.log(`Fetched ${rows.length} rows from DraftPicks sheet`);

  // ── 2. Build team lookup maps ─────────────────────────────────────────────
  const gflTeams = await db.select({ id: teams.id, teamshort: teams.teamshort })
    .from(teams).where(eq(teams.leagueId, 1));
  const aflTeams = await db.select({ id: teams.id, teamshort: teams.teamshort })
    .from(teams).where(eq(teams.leagueId, 2));

  const gflMap = new Map(gflTeams.map(t => [t.teamshort!, t.id]));
  const aflMap = new Map(aflTeams.map(t => [t.teamshort!, t.id]));

  console.log(`GFL teams in DB: ${gflTeams.length}, AFL teams in DB: ${aflTeams.length}`);

  // ── 3. Build player lookup (GFL) for drafted picks ────────────────────────
  const gflPlayers = await db.select({ id: players.id, name: players.name })
    .from(players).where(eq(players.leagueId, 1));
  const playerMap = new Map(gflPlayers.map(p => [p.name!.toLowerCase(), p.id]));

  // ── 4. Clear existing picks for both leagues ──────────────────────────────
  await db.delete(draftPicks).where(eq(draftPicks.leagueId, 1));
  await db.delete(draftPicks).where(eq(draftPicks.leagueId, 2));
  console.log('Cleared existing draft picks for both leagues');

  // ── 5. Build GFL insert rows ──────────────────────────────────────────────
  let gflSkipped = 0;
  const gflRows: typeof draftPicks.$inferInsert[] = [];

  for (const row of rows) {
    const year = parseInt(row[0]);
    const round = parseInt(row[1]);
    const pick = parseInt(row[2]);
    const origShort = row[3]?.trim();
    const currShort = row[4]?.trim();
    const playerName = row[6]?.trim() || null;

    const originalTeamId = gflMap.get(origShort);
    const currentTeamId = gflMap.get(currShort);

    if (!originalTeamId || !currentTeamId) {
      console.warn(`GFL: skipping row — team not found: orig="${origShort}" curr="${currShort}"`);
      gflSkipped++;
      continue;
    }

    const playerId = playerName ? (playerMap.get(playerName.toLowerCase()) ?? null) : null;

    gflRows.push({
      leagueId: 1,
      year,
      round,
      pick,
      originalTeamId,
      currentTeamId,
      playerId,
      touch_id: 'migrate-draft-picks',
    });
  }

  // ── 6. Build AFL insert rows (remap by teamshort) ─────────────────────────
  let aflSkipped = 0;
  const aflRows: typeof draftPicks.$inferInsert[] = [];

  for (const row of rows) {
    const year = parseInt(row[0]);
    const round = parseInt(row[1]);
    const pick = parseInt(row[2]);
    const origShort = row[3]?.trim();
    const currShort = row[4]?.trim();

    const originalTeamId = aflMap.get(origShort);
    const currentTeamId = aflMap.get(currShort);

    if (!originalTeamId || !currentTeamId) {
      // This team doesn't exist in AFL — skip silently
      aflSkipped++;
      continue;
    }

    aflRows.push({
      leagueId: 2,
      year,
      round,
      pick,
      originalTeamId,
      currentTeamId,
      playerId: null,
      touch_id: 'migrate-draft-picks',
    });
  }

  // ── 7. Insert in batches of 100 ───────────────────────────────────────────
  const BATCH = 100;

  for (let i = 0; i < gflRows.length; i += BATCH) {
    await db.insert(draftPicks).values(gflRows.slice(i, i + BATCH));
  }
  console.log(`GFL: inserted ${gflRows.length} picks (skipped ${gflSkipped})`);

  for (let i = 0; i < aflRows.length; i += BATCH) {
    await db.insert(draftPicks).values(aflRows.slice(i, i + BATCH));
  }
  console.log(`AFL: inserted ${aflRows.length} picks (skipped ${aflSkipped} — teams not in AFL)`);

  console.log('Done!');
  process.exit(0);
}
main().catch(e => { console.error(e); process.exit(1); });
