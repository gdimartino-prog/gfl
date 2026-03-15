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
    const { resources } = await import('../schema.ts');

    try {
        console.log('Starting resources migration...');

        // 1. Clear the resources table
        console.log('Clearing existing resources data...');
        await db.delete(resources);

        // 2. Fetch data from Google Sheets
        console.log('Initializing Google Sheets...');
        const auth = getGoogleAuth();
        const sheets = google.sheets({ version: 'v4', auth });
        const SHEET_ID = process.env.GOOGLE_SHEET_ID;

        if (!SHEET_ID) {
            throw new Error('Missing GOOGLE_SHEET_ID environment variable');
        }

        console.log(`Fetching Resources data from sheet ${SHEET_ID}...`);
        const response = await sheets.spreadsheets.values.get({
            spreadsheetId: SHEET_ID,
            range: 'Resources!A:D',
        });

        const rows = response.data.values;
        if (!rows || rows.length < 2) {
            console.log('No data found in Resources sheet.');
            return;
        }

        const dataRows = rows.slice(1); // Skip header row

        // 3. Transform data
        const resourcesToInsert = dataRows.map((row) => {
            return {
                group: row[0] || null,
                title: row[1],
                url: row[2] || null,
                touch_id: 'migration-script',
            };
        });

        // 4. Insert data into the database
        console.log(`Found ${resourcesToInsert.length} resources to migrate.`);
        if (resourcesToInsert.length > 0) {
            await db.insert(resources).values(resourcesToInsert);
        }

        console.log('Resources migration completed successfully!');
    } catch (error) {
        console.error('Resources migration failed:', error);
        process.exit(1);
    }
}

main().catch(error => {
    console.error('Fatal error:', error);
    process.exit(1);
});
