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
    const { rules } = await import('../schema.ts');

    try {
        console.log('Starting rules migration...');

        // 1. Clear the rules table
        console.log('Clearing existing rules data...');
        await db.delete(rules);

        // 2. Fetch data from Google Sheets
        console.log('Initializing Google Sheets...');
        const auth = getGoogleAuth();
        const sheets = google.sheets({ version: 'v4', auth });
        const SHEET_ID = process.env.GOOGLE_SHEET_ID;

        if (!SHEET_ID) {
            throw new Error('Missing GOOGLE_SHEET_ID environment variable');
        }

        console.log(`Fetching Rules data from sheet ${SHEET_ID}...`);
        const response = await sheets.spreadsheets.values.get({
            spreadsheetId: SHEET_ID,
            range: 'Rules!A:C',
        });

        const rows = response.data.values;
        if (!rows || rows.length < 2) {
            console.log('No data found in Rules sheet.');
            return;
        }

        const dataRows = rows.slice(1); // Skip header row

        // 3. Transform data
        const rulesToInsert = dataRows.map((row) => {
            return {
                rule: row[0],
                value: row[1],
                desc: row[2] || null,
                touch_id: 'migration-script',
            };
        });

        // 4. Insert data into the database
        console.log(`Found ${rulesToInsert.length} rules to migrate.`);
        if (rulesToInsert.length > 0) {
            await db.insert(rules).values(rulesToInsert);
        }

        console.log('Rules migration completed successfully!');
    } catch (error) {
        console.error('Rules migration failed:', error);
        process.exit(1);
    }
}

main().catch(error => {
    console.error('Fatal error:', error);
    process.exit(1);
});
