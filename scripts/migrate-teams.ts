import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const envPath = path.resolve(__dirname, '../.env.local');
console.log('Loading .env from:', envPath);
const result = dotenv.config({ path: envPath });
console.log('dotenv config result:', result.error ? result.error.message : 'Success');

const SALT_ROUNDS = 10;

async function main() {
    console.log('POSTGRES_URL:', process.env.POSTGRES_URL ? 'SET' : 'NOT SET');

    const { google } = await import('googleapis');
    const bcrypt = (await import('bcrypt')).default;
    const { getGoogleAuth } = await import('../lib/google-cloud.ts');
    const { db } = await import('../lib/db.ts');
    const { teams } = await import('../schema.ts');

    try {
        console.log('Starting team migration...');

        // 1. Clear the teams table
        console.log('Clearing existing teams data...');
        await db.delete(teams);

        // 2. Fetch data from Google Sheets
        const auth = getGoogleAuth();
        const sheets = google.sheets({ version: 'v4', auth });
        const SHEET_ID = process.env.GOOGLE_SHEET_ID;

        if (!SHEET_ID) {
            throw new Error('Missing GOOGLE_SHEET_ID environment variable');
        }

        const response = await sheets.spreadsheets.values.get({
            spreadsheetId: SHEET_ID,
            range: 'Coaches!A:J',
        });

        const rows = response.data.values;
        if (!rows || rows.length < 2) {
            console.log('No data found in Coaches sheet.');
            return;
        }

        const headers = rows[0];
        const dataRows = rows.slice(1);

        // 3. Transform data
        const teamsToInsert = await Promise.all(dataRows.map(async (row) => {
            const password = row[7];
            const hashedPassword = password ? await bcrypt.hash(password, SALT_ROUNDS) : null;
            const coaLastSync = row[8] ? new Date(row[8]) : null;

            return {
                name: row[0],
                teamshort: row[1],
                coach: row[2],
                isCommissioner: row[3] === 'TRUE',
                mobile: row[4],
                status: row[5],
                nickname: row[6],
                password: hashedPassword,
                coa_last_sync: coaLastSync,
                email: row[9],
            };
        }));

        // 4. Insert data into the database
        console.log(`Found ${teamsToInsert.length} teams to migrate.`);
        await db.insert(teams).values(teamsToInsert);

        console.log('Team migration completed successfully!');
    } catch (error) {
        console.error('Team migration failed:', error);
        process.exit(1);
    }
}

main().catch(error => {
    console.error('Fatal error:', error);
    process.exit(1);
});
