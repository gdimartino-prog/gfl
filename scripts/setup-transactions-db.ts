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
        
        console.log('Dropping old transactions table if exists...');
        await client.query('DROP TABLE IF EXISTS "transactions" CASCADE;');
        
        console.log('Creating transactions table...');
        await client.query(`
            CREATE TABLE "transactions" (
                "id" serial PRIMARY KEY NOT NULL,
                "date" timestamp NOT NULL,
                "type" varchar(100) NOT NULL,
                "description" text,
                "from_team" varchar(256),
                "to_team" varchar(256),
                "owner" varchar(256),
                "status" varchar(50),
                "week_back" integer,
                "email_status" varchar(50),
                "touch_dt" timestamp DEFAULT now() NOT NULL,
                "touch_id" varchar(256)
            );
        `);
        
        console.log('✓ Transactions table created successfully!');
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
