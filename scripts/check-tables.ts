import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';
import { createPool } from '@vercel/postgres';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const envPath = path.resolve(__dirname, '../.env.local');
dotenv.config({ path: envPath });

async function main() {
    try {
        const pool = createPool();
        const client = await pool.connect();
        
        console.log('Checking for resources table...');
        const result = await client.query(`
            SELECT tablename FROM pg_tables 
            WHERE schemaname = 'public' 
            AND tablename = 'resources';
        `);
        
        if (result.rows.length > 0) {
            console.log('✓ Resources table EXISTS');
            
            // Check the data
            const dataResult = await client.query('SELECT COUNT(*) as count FROM "resources";');
            console.log(`✓ Resources table has ${dataResult.rows[0].count} rows`);
        } else {
            console.log('✗ Resources table DOES NOT EXIST');
        }
        
        client.release();
    } catch (error) {
        console.error('Error:', error);
        process.exit(1);
    }
}

main();
