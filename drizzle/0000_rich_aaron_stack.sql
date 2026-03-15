CREATE TABLE "audit_log" (
	"id" serial PRIMARY KEY NOT NULL,
	"timestamp" timestamp DEFAULT now() NOT NULL,
	"coach" varchar(256),
	"team" varchar(256),
	"action" varchar(256),
	"details" text
);
--> statement-breakpoint
CREATE TABLE "cuts" (
	"id" serial PRIMARY KEY NOT NULL,
	"player_id" integer NOT NULL,
	"team_id" integer NOT NULL,
	"touch_dt" timestamp DEFAULT now() NOT NULL,
	"touch_id" varchar(256)
);
--> statement-breakpoint
CREATE TABLE "draft_picks" (
	"id" serial PRIMARY KEY NOT NULL,
	"year" integer NOT NULL,
	"round" integer NOT NULL,
	"pick" integer NOT NULL,
	"original_team_id" integer,
	"current_team_id" integer,
	"player_id" integer,
	"touch_dt" timestamp DEFAULT now() NOT NULL,
	"touch_id" varchar(256)
);
--> statement-breakpoint
CREATE TABLE "players" (
	"id" serial PRIMARY KEY NOT NULL,
	"name" varchar(256) NOT NULL,
	"position" varchar(50),
	"team_id" integer,
	"touch_dt" timestamp DEFAULT now() NOT NULL,
	"touch_id" varchar(256)
);
--> statement-breakpoint
CREATE TABLE "resources" (
	"id" serial PRIMARY KEY NOT NULL,
	"group" varchar(256),
	"title" varchar(256) NOT NULL,
	"url" varchar(1024),
	"touch_dt" timestamp DEFAULT now() NOT NULL,
	"touch_id" varchar(256)
);
--> statement-breakpoint
CREATE TABLE "rules" (
	"id" serial PRIMARY KEY NOT NULL,
	"rule" varchar(256) NOT NULL,
	"value" varchar(256) NOT NULL,
	"desc" text,
	"touch_dt" timestamp DEFAULT now() NOT NULL,
	"touch_id" varchar(256),
	CONSTRAINT "rules_rule_unique" UNIQUE("rule")
);
--> statement-breakpoint
CREATE TABLE "schedule" (
	"id" serial PRIMARY KEY NOT NULL,
	"week" integer NOT NULL,
	"home_team_id" integer NOT NULL,
	"away_team_id" integer NOT NULL,
	"home_score" integer,
	"away_score" integer,
	"is_bye" boolean DEFAULT false,
	"touch_dt" timestamp DEFAULT now() NOT NULL,
	"touch_id" varchar(256)
);
--> statement-breakpoint
CREATE TABLE "standings" (
	"id" serial PRIMARY KEY NOT NULL,
	"team_id" integer NOT NULL,
	"year" integer NOT NULL,
	"wins" integer DEFAULT 0 NOT NULL,
	"losses" integer DEFAULT 0 NOT NULL,
	"ties" integer DEFAULT 0 NOT NULL,
	"touch_dt" timestamp DEFAULT now() NOT NULL,
	"touch_id" varchar(256)
);
--> statement-breakpoint
CREATE TABLE "teams" (
	"id" serial PRIMARY KEY NOT NULL,
	"name" varchar(256) NOT NULL,
	"coach" varchar(256),
	"teamshort" varchar(10),
	"nickname" varchar(256),
	"is_commissioner" boolean DEFAULT false,
	"status" varchar(50),
	"mobile" varchar(20),
	"email" varchar(256),
	"password" varchar(256),
	"coa_last_sync" timestamp,
	"touch_dt" timestamp DEFAULT now() NOT NULL,
	"touch_id" varchar(256)
);
--> statement-breakpoint
CREATE TABLE "transactions" (
	"id" serial PRIMARY KEY NOT NULL,
	"type" varchar(100) NOT NULL,
	"details" text,
	"touch_dt" timestamp DEFAULT now() NOT NULL,
	"touch_id" varchar(256)
);
--> statement-breakpoint
ALTER TABLE "cuts" ADD CONSTRAINT "cuts_player_id_players_id_fk" FOREIGN KEY ("player_id") REFERENCES "public"."players"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "cuts" ADD CONSTRAINT "cuts_team_id_teams_id_fk" FOREIGN KEY ("team_id") REFERENCES "public"."teams"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "draft_picks" ADD CONSTRAINT "draft_picks_original_team_id_teams_id_fk" FOREIGN KEY ("original_team_id") REFERENCES "public"."teams"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "draft_picks" ADD CONSTRAINT "draft_picks_current_team_id_teams_id_fk" FOREIGN KEY ("current_team_id") REFERENCES "public"."teams"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "draft_picks" ADD CONSTRAINT "draft_picks_player_id_players_id_fk" FOREIGN KEY ("player_id") REFERENCES "public"."players"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "players" ADD CONSTRAINT "players_team_id_teams_id_fk" FOREIGN KEY ("team_id") REFERENCES "public"."teams"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "schedule" ADD CONSTRAINT "schedule_home_team_id_teams_id_fk" FOREIGN KEY ("home_team_id") REFERENCES "public"."teams"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "schedule" ADD CONSTRAINT "schedule_away_team_id_teams_id_fk" FOREIGN KEY ("away_team_id") REFERENCES "public"."teams"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "standings" ADD CONSTRAINT "standings_team_id_teams_id_fk" FOREIGN KEY ("team_id") REFERENCES "public"."teams"("id") ON DELETE no action ON UPDATE no action;