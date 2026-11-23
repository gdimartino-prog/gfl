/**
 * Idempotently create the password_reset_tokens table and indexes.
 * Safe to run repeatedly; mirrors schema.ts exactly.
 * Run: node --env-file=.env.local --import tsx scripts/create-password-reset-table.ts
 * Follow immediately with: npx tsx scripts/enable-rls.ts
 */

import { config } from 'dotenv';
config({ path: '.env.local' });

const { db } = await import('../lib/db');
const { sql } = await import('drizzle-orm');

async function main() {
  console.log('Creating password_reset_tokens table and indexes...');

  await db.execute(sql`
    CREATE TABLE IF NOT EXISTS "password_reset_tokens" (
      "id" serial PRIMARY KEY NOT NULL,
      "league_id" integer NOT NULL REFERENCES "leagues"("id"),
      "team_id" integer NOT NULL REFERENCES "teams"("id") ON DELETE CASCADE,
      "token_hash" varchar(64) NOT NULL,
      "expires_at" timestamp NOT NULL,
      "used_at" timestamp,
      "created_at" timestamp DEFAULT now() NOT NULL,
      "touch_dt" timestamp DEFAULT now() NOT NULL,
      "touch_id" varchar(256)
    );
  `);

  await db.execute(sql`
    CREATE UNIQUE INDEX IF NOT EXISTS "password_reset_tokens_hash_unique"
      ON "password_reset_tokens" ("token_hash");
  `);

  await db.execute(sql`
    CREATE INDEX IF NOT EXISTS "password_reset_tokens_team_created_idx"
      ON "password_reset_tokens" ("league_id", "team_id", "created_at");
  `);

  await db.execute(sql`
    CREATE INDEX IF NOT EXISTS "password_reset_tokens_expires_idx"
      ON "password_reset_tokens" ("expires_at");
  `);

  console.log('✓ Created/verified password_reset_tokens table and indexes.');
  process.exit(0);
}

main().catch((e) => {
  console.error('Failed to create password_reset_tokens table:', e);
  process.exit(1);
});
