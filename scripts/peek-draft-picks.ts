import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: path.resolve(__dirname, '../.env.local') });

async function main() {
  const { getGoogleAuth } = await import('../lib/google-cloud.ts');
  const { google } = await import('googleapis');
  const { db } = await import('../lib/db.ts');
  const { teams } = await import('../schema.ts');
  const { eq } = await import('drizzle-orm');

  // Get all unique teamshorts from the sheet
  const auth = getGoogleAuth();
  const sheets = google.sheets({ version: 'v4', auth });
  const res = await sheets.spreadsheets.values.get({
    spreadsheetId: process.env.GOOGLE_SHEET_ID!,
    range: 'DraftPicks!A:E',
  });
  const rows = (res.data.values ?? []).slice(1);
  const sheetTeams = [...new Set([...rows.map(r => r[3]), ...rows.map(r => r[4])].filter(Boolean))].sort();
  console.log('Teamshorts in sheet:', sheetTeams);

  // Get GFL teams from DB
  const dbTeams = await db.select({ id: teams.id, teamshort: teams.teamshort }).from(teams).where(eq(teams.leagueId, 1));
  const dbShorts = dbTeams.map(t => t.teamshort);
  console.log('GFL teams in DB:', dbShorts.sort());

  // Find any missing
  const missing = sheetTeams.filter(s => !dbShorts.includes(s));
  console.log('Missing from DB:', missing.length ? missing : 'NONE — all good!');

  process.exit(0);
}
main().catch(e => { console.error(e); process.exit(1); });
