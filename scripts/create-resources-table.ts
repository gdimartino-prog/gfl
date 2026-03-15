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
        
        console.log('Creating resources table...');
        
        await client.query(`
            CREATE TABLE IF NOT EXISTS "resources" (
                "id" serial PRIMARY KEY NOT NULL,
                "group" varchar(256),
                "title" varchar(256) NOT NULL,
                "url" varchar(1024),
                "touch_dt" timestamp DEFAULT now() NOT NULL,
                "touch_id" varchar(256)
            );
        `);
        
        console.log('✓ Resources table created/verified');
        
        // Verify it exists
        const result = await client.query(`
            SELECT tablename FROM pg_tables 
            WHERE schemaname = 'public' AND tablename = 'resources';
        `);
        
        if (result.rows.length > 0) {
            console.log('✓ Resources table EXISTS in database');
        }
        
        client.release();
    } catch (error) {
        console.error('Error:', error);
        process.exit(1);
    }
}

main();
