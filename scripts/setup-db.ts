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
        
        console.log('Connected to database. Dropping old rules table if exists...');
        await client.query('DROP TABLE IF EXISTS "rules" CASCADE;');
        
        console.log('Creating rules table...');
        await client.query(`
            CREATE TABLE "rules" (
                "id" serial PRIMARY KEY NOT NULL,
                "rule" varchar(256) NOT NULL,
                "value" varchar(256) NOT NULL,
                "desc" text,
                "touch_dt" timestamp DEFAULT now() NOT NULL,
                "touch_id" varchar(256),
                CONSTRAINT "rules_rule_unique" UNIQUE("rule")
            );
        `);
        
        console.log('✓ Rules table created successfully!');
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
