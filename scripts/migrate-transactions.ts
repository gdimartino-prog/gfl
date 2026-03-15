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
    const { transactions } = await import('../schema.ts');

    try {
        console.log('Starting transactions migration...');

        // 1. Clear the transactions table
        console.log('Clearing existing transactions data...');
        await db.delete(transactions);

        // 2. Fetch data from Google Sheets
        console.log('Initializing Google Sheets...');
        const auth = getGoogleAuth();
        const sheets = google.sheets({ version: 'v4', auth });
        const SHEET_ID = process.env.GOOGLE_SHEET_ID;

        if (!SHEET_ID) {
            throw new Error('Missing GOOGLE_SHEET_ID environment variable');
        }

        console.log(`Fetching Transactions data from sheet ${SHEET_ID}...`);
        const response = await sheets.spreadsheets.values.get({
            spreadsheetId: SHEET_ID,
            range: 'Transactions!A:I',
        });

        const rows = response.data.values;
        if (!rows || rows.length < 2) {
            console.log('No data found in Transactions sheet.');
            return;
        }

        const dataRows = rows.slice(1); // Skip header row

        // 3. Transform data
        const transactionsToInsert = dataRows.map((row) => {
            // Parse date - Google Sheets date format or string
            let dateValue;
            try {
                dateValue = new Date(row[0]);
            } catch {
                dateValue = new Date();
            }

            // Parse week back as integer or null
            const weekBack = row[7] ? parseInt(row[7]) : null;

            return {
                date: dateValue,
                type: row[1] || 'UNKNOWN',
                description: row[2] || null,
                fromTeam: row[3] || null,
                toTeam: row[4] || null,
                owner: row[5] || null,
                status: row[6] || null,
                weekBack: isNaN(weekBack) ? null : weekBack,
                emailStatus: row[8] || null,
                touch_id: 'migration-script',
            };
        });

        // 4. Insert data into the database
        console.log(`Found ${transactionsToInsert.length} transactions to migrate.`);
        if (transactionsToInsert.length > 0) {
            await db.insert(transactions).values(transactionsToInsert);
        }

        console.log('Transactions migration completed successfully!');
    } catch (error) {
        console.error('Transactions migration failed:', error);
        process.exit(1);
    }
}

main().catch(error => {
    console.error('Fatal error:', error);
    process.exit(1);
});
