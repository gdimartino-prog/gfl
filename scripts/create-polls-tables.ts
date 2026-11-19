/**
 * Idempotently create polls, poll_options, and poll_votes tables and indexes.
 * Safe to run repeatedly; mirrors schema.ts exactly.
 * Run: node --env-file=.env.local --import tsx scripts/create-polls-tables.ts
 * Follow immediately with: npx tsx scripts/enable-rls.ts
 */

import { config } from 'dotenv';
config({ path: '.env.local' });

const { db } = await import('../lib/db');
const { sql } = await import('drizzle-orm');

async function main() {
  console.log('Creating poll tables and indexes...');

  await db.execute(sql`
    CREATE TABLE IF NOT EXISTS "polls" (
      "id" serial PRIMARY KEY NOT NULL,
      "league_id" integer NOT NULL REFERENCES "leagues"("id"),
      "title" varchar(256) NOT NULL,
      "description" text,
      "poll_type" varchar(30) DEFAULT 'rule_change' NOT NULL,
      "status" varchar(30) DEFAULT 'open' NOT NULL,
      "effective_season" integer,
      "constitution_ref" varchar(100),
      "parent_poll_id" integer REFERENCES "polls"("id") ON DELETE SET NULL,
      "winner_option_id" integer,
      "eligible_team_count" integer,
      "closes_at" timestamp NOT NULL,
      "closed_at" timestamp,
      "last_reminder_at" timestamp,
      "created_at" timestamp DEFAULT now() NOT NULL,
      "created_by" varchar(256) NOT NULL,
      "touch_dt" timestamp DEFAULT now() NOT NULL,
      "touch_id" varchar(256)
    );
  `);

  await db.execute(sql`
    CREATE INDEX IF NOT EXISTS "polls_league_status_closes_idx"
      ON "polls" ("league_id", "status", "closes_at");
  `);

  await db.execute(sql`
    CREATE INDEX IF NOT EXISTS "polls_parent_poll_idx"
      ON "polls" ("parent_poll_id");
  `);

  await db.execute(sql`
    CREATE TABLE IF NOT EXISTS "poll_options" (
      "id" serial PRIMARY KEY NOT NULL,
      "league_id" integer NOT NULL REFERENCES "leagues"("id"),
      "poll_id" integer NOT NULL REFERENCES "polls"("id") ON DELETE CASCADE,
      "label" varchar(256) NOT NULL,
      "sort_order" integer DEFAULT 0 NOT NULL,
      "touch_dt" timestamp DEFAULT now() NOT NULL,
      "touch_id" varchar(256)
    );
  `);

  await db.execute(sql`
    CREATE INDEX IF NOT EXISTS "poll_options_poll_idx"
      ON "poll_options" ("league_id", "poll_id", "sort_order");
  `);

  await db.execute(sql`
    CREATE TABLE IF NOT EXISTS "poll_votes" (
      "id" serial PRIMARY KEY NOT NULL,
      "league_id" integer NOT NULL REFERENCES "leagues"("id"),
      "poll_id" integer NOT NULL REFERENCES "polls"("id") ON DELETE CASCADE,
      "option_id" integer NOT NULL REFERENCES "poll_options"("id") ON DELETE CASCADE,
      "team_id" integer NOT NULL REFERENCES "teams"("id") ON DELETE CASCADE,
      "cast_by" varchar(256) NOT NULL,
      "is_proxy" boolean DEFAULT false NOT NULL,
      "voted_at" timestamp DEFAULT now() NOT NULL,
      "touch_dt" timestamp DEFAULT now() NOT NULL,
      "touch_id" varchar(256)
    );
  `);

  await db.execute(sql`
    CREATE UNIQUE INDEX IF NOT EXISTS "poll_votes_poll_team_unique"
      ON "poll_votes" ("poll_id", "team_id");
  `);

  await db.execute(sql`
    CREATE INDEX IF NOT EXISTS "poll_votes_league_poll_idx"
      ON "poll_votes" ("league_id", "poll_id");
  `);

  console.log('✓ Created/verified polls, poll_options, and poll_votes tables.');
  process.exit(0);
}

main().catch((e) => {
  console.error('Failed to create polls tables:', e);
  process.exit(1);
});
