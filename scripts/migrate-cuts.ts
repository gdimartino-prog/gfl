import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const envPath = path.resolve(__dirname, '../.env.local');
console.log('Loading .env from:', envPath);
const result = dotenv.config({ path: envPath });
console.log('dotenv config result:', result.error ? result.error.message : 'Success');

async function main() {
    console.log('POSTGRES_URL:', process.env.POSTGRES_URL ? 'SET' : 'NOT SET');

    const { google } = await import('googleapis');
    const { getGoogleAuth } = await import('../lib/google-cloud.ts');
    const { db } = await import('../lib/db.ts');
    const { cuts, teams } = await import('../schema.ts');
    const { eq } = await import('drizzle-orm');

    try {
        console.log('Starting cuts migration...');

        // 1. Clear the cuts table
        console.log('Clearing existing cuts data...');
        await db.delete(cuts);

        // 2. Fetch team data for lookup
        console.log('Fetching teams for ID mapping...');
        const allTeams = await db.select().from(teams);
        const teamMap: Record<string, number> = {};
        allTeams.forEach(team => {
            if (team.name) {
                teamMap[team.name.toLowerCase()] = team.id;
            }
            if (team.teamshort) {
                teamMap[team.teamshort.toLowerCase()] = team.id;
            }
        });

        // 3. Fetch data from Google Sheets
        console.log('Initializing Google Sheets...');
        const auth = getGoogleAuth();
        const sheets = google.sheets({ version: 'v4', auth });
        const SHEET_ID = process.env.GOOGLE_SHEET_ID;

        if (!SHEET_ID) {
            throw new Error('Missing GOOGLE_SHEET_ID environment variable');
        }

        console.log(`Fetching Cuts data from sheet ${SHEET_ID}...`);
        const response = await sheets.spreadsheets.values.get({
            spreadsheetId: SHEET_ID,
            range: 'Cuts!A:J',
        });

        const rows = response.data.values;
        if (!rows || rows.length < 2) {
            console.log('No data found in Cuts sheet.');
            return;
        }

        const dataRows = rows.slice(1); // Skip header row

        // 4. Transform data
        const cutsToInsert = dataRows.map((row) => {
            const teamName = row[1]?.toLowerCase() || '';
            const teamId = teamMap[teamName] || null;

            let dateValue: Date | null = null;
            if (row[9]) {
                try {
                    dateValue = new Date(row[9]);
                } catch {
                    dateValue = null;
                }
            }

            const age = row[4] ? parseInt(row[4]) : null;

            return {
                year: row[0] ? parseInt(row[0]) : null,
                teamId: teamId,
                firstName: row[2] || null,
                lastName: row[3] || null,
                age: isNaN(age) ? null : age,
                offense: row[5] || null,
                defense: row[6] || null,
                special: row[7] || null,
                status: row[8] || null,
                datetime: dateValue,
                touch_id: 'migration-script',
            };
        });

        // 5. Insert data into the database
        console.log(`Found ${cutsToInsert.length} cuts to migrate.`);
        if (cutsToInsert.length > 0) {
            await db.insert(cuts).values(cutsToInsert);
        }

        console.log('Cuts migration completed successfully!');
    } catch (error) {
        console.error('Cuts migration failed:', error);
        process.exit(1);
    }
}

main().catch(error => {
    console.error('Fatal error:', error);
    process.exit(1);
});
