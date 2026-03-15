import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';
import { createPool } from '@vercel/postgres';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const envPath = path.resolve(__dirname, '../.env.local');
console.log('Loading .env from:', envPath);
const result = dotenv.config({ path: envPath });
console.log('dotenv config result:', result.error ? result.error.message : 'Success');

async function main() {
    try {
        console.log('Setting up database...');
        const pool = createPool();
        const client = await pool.connect();
        
        console.log('Connected to database. Dropping old resources table if exists...');
        await client.query('DROP TABLE IF EXISTS "resources" CASCADE;');
        
        console.log('Creating resources table...');
        await client.query(`
            CREATE TABLE "resources" (
                "id" serial PRIMARY KEY NOT NULL,
                "group" varchar(256),
                "title" varchar(256) NOT NULL,
                "url" varchar(1024),
                "touch_dt" timestamp DEFAULT now() NOT NULL,
                "touch_id" varchar(256)
            );
        `);
        
        console.log('✓ Resources table created successfully!');
        client.release();
    } catch (error) {
        console.error('Setup failed:', error);
        process.exit(1);
    }
}

main().catch(error => {
    console.error('Fatal error:', error);
    process.exit(1);
});
