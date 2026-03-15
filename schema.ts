
import {
  pgTable,
  serial,
  varchar,
  integer,
  timestamp,
  text,
  boolean,
  jsonb,
  unique,
} from "drizzle-orm/pg-core";
import { relations } from "drizzle-orm";

// Leagues table (multi-league support)
export const leagues = pgTable("leagues", {
  id: serial("id").primaryKey(),
  name: varchar("name", { length: 256 }).notNull(),
  slug: varchar("slug", { length: 50 }).notNull().unique(),
  legacyUrl: varchar("legacy_url", { length: 512 }),
  touch_dt: timestamp("touch_dt").defaultNow().notNull(),
  touch_id: varchar("touch_id", { length: 256 }),
});

// Teams table (replaces Coaches/Teams)
export const teams = pgTable("teams", {
  id: serial("id").primaryKey(),
  leagueId: integer("league_id").references(() => leagues.id),
  name: varchar("name", { length: 256 }).notNull(),
  coach: varchar("coach", { length: 256 }),
  teamshort: varchar("teamshort", { length: 10 }),
  nickname: varchar("nickname", { length: 256 }),
  isCommissioner: boolean("is_commissioner").default(false),
  status: varchar("status", { length: 50 }),
  mobile: varchar("mobile", { length: 20 }),
  email: varchar("email", { length: 256 }),
  password: varchar("password", { length: 256 }),
  coa_last_sync: timestamp("coa_last_sync"),
  touch_dt: timestamp("touch_dt").defaultNow().notNull(),
  touch_id: varchar("touch_id", { length: 256 }),
});

// Players table
export const players = pgTable("players", {
  id: serial("id").primaryKey(),
  leagueId: integer("league_id").references(() => leagues.id),
  name: varchar("name", { length: 256 }).notNull(),
  first: varchar("first", { length: 128 }),
  last: varchar("last", { length: 128 }),
  age: integer("age"),
  position: varchar("position", { length: 50 }),
  offense: varchar("offense", { length: 50 }),
  defense: varchar("defense", { length: 50 }),
  special: varchar("special", { length: 50 }),
  identity: varchar("identity", { length: 512 }),
  isIR: boolean("is_ir").default(false),
  overall: varchar("overall", { length: 20 }),
  runBlock: varchar("run_block", { length: 20 }),
  passBlock: varchar("pass_block", { length: 20 }),
  rushYards: varchar("rush_yards", { length: 20 }),
  interceptionsVal: varchar("interceptions_val", { length: 20 }),
  sacksVal: varchar("sacks_val", { length: 20 }),
  durability: varchar("durability", { length: 20 }),
  scouting: jsonb("scouting").$type<Record<string, string>>(),
  teamId: integer("team_id").references(() => teams.id),
  touch_dt: timestamp("touch_dt").defaultNow().notNull(),
  touch_id: varchar("touch_id", { length: 256 }),
});

// Transactions table
export const transactions = pgTable("transactions", {
  id: serial("id").primaryKey(),
  leagueId: integer("league_id").references(() => leagues.id),
  date: timestamp("date").notNull(),
  type: varchar("type", { length: 100 }).notNull(),
  description: text("description"),
  fromTeam: varchar("from_team", { length: 256 }),
  toTeam: varchar("to_team", { length: 256 }),
  owner: varchar("owner", { length: 256 }),
  status: varchar("status", { length: 50 }),
  weekBack: integer("week_back"),
  emailStatus: varchar("email_status", { length: 50 }),
  touch_dt: timestamp("touch_dt").defaultNow().notNull(),
  touch_id: varchar("touch_id", { length: 256 }),
});

// Draft Picks table
export const draftPicks = pgTable("draft_picks", {
  id: serial("id").primaryKey(),
  leagueId: integer("league_id").references(() => leagues.id),
  year: integer("year").notNull(),
  round: integer("round").notNull(),
  pick: integer("pick").notNull(),
  originalTeamId: integer("original_team_id").references(() => teams.id),
  currentTeamId: integer("current_team_id").references(() => teams.id),
  playerId: integer("player_id").references(() => players.id),
  pickedAt: timestamp("picked_at"),
  warningSent: boolean("warning_sent").default(false).notNull(),
  selectedPlayerName: varchar("selected_player_name", { length: 256 }),
  touch_dt: timestamp("touch_dt").defaultNow().notNull(),
  touch_id: varchar("touch_id", { length: 256 }),
});

// Cuts table
export const cuts = pgTable("cuts", {
  id: serial("id").primaryKey(),
  leagueId: integer("league_id").references(() => leagues.id),
  year: integer("year"),
  teamId: integer("team_id").references(() => teams.id),
  firstName: varchar("first_name", { length: 256 }),
  lastName: varchar("last_name", { length: 256 }),
  age: integer("age"),
  offense: varchar("offense", { length: 50 }),
  defense: varchar("defense", { length: 50 }),
  special: varchar("special", { length: 50 }),
  status: varchar("status", { length: 50 }),
  datetime: timestamp("datetime"),
  touch_dt: timestamp("touch_dt").defaultNow().notNull(),
  touch_id: varchar("touch_id", { length: 256 }),
});

// Rules table
export const rules = pgTable("rules", {
  id: serial("id").primaryKey(),
  leagueId: integer("league_id").references(() => leagues.id),
  year: integer("year"),
  rule: varchar("rule", { length: 256 }).notNull(),
  value: varchar("value", { length: 256 }).notNull(),
  desc: text("desc"),
  touch_dt: timestamp("touch_dt").defaultNow().notNull(),
  touch_id: varchar("touch_id", { length: 256 }),
}, (table) => [
  unique('rules_league_year_rule_unique').on(table.leagueId, table.year, table.rule),
]);

// Resources table
export const resources = pgTable("resources", {
  id: serial("id").primaryKey(),
  leagueId: integer("league_id").references(() => leagues.id),
  group: varchar("group", { length: 256 }),
  title: varchar("title", { length: 256 }).notNull(),
  url: varchar("url", { length: 1024 }),
  touch_dt: timestamp("touch_dt").defaultNow().notNull(),
  touch_id: varchar("touch_id", { length: 256 }),
});

// Standings table
export const standings = pgTable("standings", {
  id: serial("id").primaryKey(),
  leagueId: integer("league_id").references(() => leagues.id),
  teamId: integer("team_id")
    .references(() => teams.id)
    .notNull(),
  year: integer("year").notNull(),
  wins: integer("wins").default(0).notNull(),
  losses: integer("losses").default(0).notNull(),
  ties: integer("ties").default(0).notNull(),
  division: varchar("division", { length: 50 }),
  offPts: integer("off_pts"),
  defPts: integer("def_pts"),
  isDivWinner: boolean("is_div_winner").default(false),
  isPlayoff: boolean("is_playoff").default(false),
  isSuperBowl: boolean("is_super_bowl").default(false),
  isChampion: boolean("is_champion").default(false),
  oldTeamName: varchar("old_team_name", { length: 256 }),
  touch_dt: timestamp("touch_dt").defaultNow().notNull(),
  touch_id: varchar("touch_id", { length: 256 }),
});

// Schedule table
export const schedule = pgTable("schedule", {
  id: serial("id").primaryKey(),
  leagueId: integer("league_id").references(() => leagues.id),
  year: integer("year"),
  week: varchar("week", { length: 10 }).notNull(),
  homeTeamId: integer("home_team_id")
    .references(() => teams.id)
    .notNull(),
  awayTeamId: integer("away_team_id")
    .references(() => teams.id)
    .notNull(),
  home_score: integer("home_score"),
  away_score: integer("away_score"),
  is_bye: boolean("is_bye").default(false),
  touch_dt: timestamp("touch_dt").defaultNow().notNull(),
  touch_id: varchar("touch_id", { length: 256 }),
});

// Trade Block table
export const tradeBlock = pgTable("trade_block", {
  id: serial("id").primaryKey(),
  leagueId: integer("league_id").references(() => leagues.id),
  playerId: varchar("player_id", { length: 512 }).notNull().unique(),
  playerName: varchar("player_name", { length: 256 }),
  team: varchar("team", { length: 50 }),
  position: varchar("position", { length: 50 }),
  asking: varchar("asking", { length: 512 }),
  touch_dt: timestamp("touch_dt").defaultNow().notNull(),
  touch_id: varchar("touch_id", { length: 256 }),
});

// Audit Log table
export const auditLog = pgTable("audit_log", {
  id: serial("id").primaryKey(),
  leagueId: integer("league_id").references(() => leagues.id),
  timestamp: timestamp("timestamp").defaultNow().notNull(),
  coach: varchar("coach", { length: 256 }),
  team: varchar("team", { length: 256 }),
  action: varchar("action", { length: 256 }),
  details: text("details"),
});

// Relationships

export const leaguesRelations = relations(leagues, ({ many }) => ({
  teams: many(teams),
  players: many(players),
  transactions: many(transactions),
  draftPicks: many(draftPicks),
  cuts: many(cuts),
  rules: many(rules),
  resources: many(resources),
  standings: many(standings),
  schedule: many(schedule),
  tradeBlock: many(tradeBlock),
  auditLog: many(auditLog),
}));

export const teamsRelations = relations(teams, ({ one }) => ({
  league: one(leagues, {
    fields: [teams.leagueId],
    references: [leagues.id],
  }),
}));

export const playersRelations = relations(players, ({ one }) => ({
  league: one(leagues, {
    fields: [players.leagueId],
    references: [leagues.id],
  }),
  team: one(teams, {
    fields: [players.teamId],
    references: [teams.id],
  }),
}));

export const draftPicksRelations = relations(draftPicks, ({ one }) => ({
  league: one(leagues, {
    fields: [draftPicks.leagueId],
    references: [leagues.id],
  }),
  originalTeam: one(teams, {
    fields: [draftPicks.originalTeamId],
    references: [teams.id],
    relationName: "original_team",
  }),
  currentTeam: one(teams, {
    fields: [draftPicks.currentTeamId],
    references: [teams.id],
    relationName: "current_team",
  }),
  player: one(players, {
    fields: [draftPicks.playerId],
    references: [players.id],
  }),
}));

export const cutsRelations = relations(cuts, ({ one }) => ({
  league: one(leagues, {
    fields: [cuts.leagueId],
    references: [leagues.id],
  }),
  team: one(teams, {
    fields: [cuts.teamId],
    references: [teams.id],
  }),
}));

export const standingsRelations = relations(standings, ({ one }) => ({
  league: one(leagues, {
    fields: [standings.leagueId],
    references: [leagues.id],
  }),
  team: one(teams, {
    fields: [standings.teamId],
    references: [teams.id],
  }),
}));

export const scheduleRelations = relations(schedule, ({ one }) => ({
  league: one(leagues, {
    fields: [schedule.leagueId],
    references: [leagues.id],
  }),
  homeTeam: one(teams, {
    fields: [schedule.homeTeamId],
    references: [teams.id],
    relationName: "home_team",
  }),
  awayTeam: one(teams, {
    fields: [schedule.awayTeamId],
    references: [teams.id],
    relationName: "away_team",
  }),
}));
