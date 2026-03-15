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
        
        console.log('Dropping old cuts table if exists...');
        await client.query('DROP TABLE IF EXISTS "cuts" CASCADE;');
        
        console.log('Creating cuts table...');
        await client.query(`
            CREATE TABLE "cuts" (
                "id" serial PRIMARY KEY NOT NULL,
                "year" integer,
                "team_id" integer REFERENCES "teams"("id"),
                "first_name" varchar(256),
                "last_name" varchar(256),
                "age" integer,
                "offense" varchar(50),
                "defense" varchar(50),
                "special" varchar(50),
                "status" varchar(50),
                "datetime" timestamp,
                "touch_dt" timestamp DEFAULT now() NOT NULL,
                "touch_id" varchar(256)
            );
        `);
        
        console.log('✓ Cuts table created successfully!');
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
