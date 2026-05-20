import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/auth';
import { db } from '@/lib/db';
import { draftPicks, players, rules, teams } from '@/schema';
import { and, asc, eq, isNull, sql } from 'drizzle-orm';
import { alias } from 'drizzle-orm/pg-core';
import { getLeagueId } from '@/lib/getLeagueId';
import { getDraftScoutRecommendations, type ScoutContext } from '@/lib/gemini';

export const maxDuration = 60;

export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session?.user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  try {
    const body = await req.json();
    const needsText: string = (body.needs || '').toString().slice(0, 4000);
    const teamShortIn: string | null = body.teamShort ? String(body.teamShort).toUpperCase() : null;

    const leagueId = await getLeagueId();

    // Resolve which team to scout for: explicit request, else the caller's own team
    const callerTeamshort = (session.user as { id?: string }).id?.toUpperCase() || '';
    const targetTeamshort = teamShortIn || callerTeamshort;
    if (!targetTeamshort) {
      return NextResponse.json({ error: 'No team to scout for' }, { status: 400 });
    }

    const teamRow = await db
      .select({ id: teams.id, name: teams.name, teamshort: teams.teamshort })
      .from(teams)
      .where(and(eq(teams.leagueId, leagueId), sql`upper(${teams.teamshort}) = ${targetTeamshort}`))
      .limit(1);
    if (!teamRow[0]) return NextResponse.json({ error: `Team ${targetTeamshort} not found` }, { status: 404 });
    const team = teamRow[0];

    // Resolve current draft year
    const draftYearRow = await db.select({ value: rules.value })
      .from(rules)
      .where(and(eq(rules.leagueId, leagueId), eq(rules.rule, 'draft_year'), isNull(rules.year)))
      .limit(1);
    const draftYear = parseInt(draftYearRow[0]?.value || '0') || new Date().getFullYear();

    // Roster: players currently on this team
    const roster = await db
      .select({ name: players.name, position: players.position, overall: players.overall, age: players.age })
      .from(players)
      .where(and(eq(players.leagueId, leagueId), eq(players.teamId, team.id)));

    // Undrafted pool: players not on any team
    const pool = await db
      .select({
        name: players.name, position: players.position, age: players.age,
        overall: players.overall, runBlock: players.runBlock, passBlock: players.passBlock,
        rushYards: players.rushYards, interceptionsVal: players.interceptionsVal,
        sacksVal: players.sacksVal, durability: players.durability, scouting: players.scouting,
      })
      .from(players)
      .where(and(eq(players.leagueId, leagueId), isNull(players.teamId)))
      .orderBy(sql`COALESCE(NULLIF(${players.overall}, '')::numeric, 0) DESC`)
      .limit(200);

    // Active-draft context: current round, next pick for this team
    const originalTeams = alias(teams, 'originalTeams');
    const currentTeams = alias(teams, 'currentTeams');
    const allPicks = await db.select({
      id: draftPicks.id,
      round: draftPicks.round,
      pick: draftPicks.pick,
      currentTeamId: draftPicks.currentTeamId,
      pickedAt: draftPicks.pickedAt,
      playerId: draftPicks.playerId,
      passed: draftPicks.passed,
      selectedPlayerName: draftPicks.selectedPlayerName,
      currentOwner: currentTeams.teamshort,
    })
    .from(draftPicks)
    .leftJoin(originalTeams, eq(draftPicks.originalTeamId, originalTeams.id))
    .leftJoin(currentTeams, eq(draftPicks.currentTeamId, currentTeams.id))
    .where(and(eq(draftPicks.leagueId, leagueId), eq(draftPicks.year, draftYear), eq(draftPicks.draftType, 'free_agent')))
    .orderBy(asc(draftPicks.pick));

    const activeIdx = allPicks.findIndex(p => !p.playerId && !p.pickedAt && !p.passed);
    const nextPickIdx = allPicks.findIndex((p, i) => i >= activeIdx && p.currentTeamId === team.id && !p.playerId && !p.pickedAt && !p.passed);
    const currentRound = activeIdx >= 0 ? allPicks[activeIdx].round : null;
    const picksUntilNext = nextPickIdx >= 0 && activeIdx >= 0 ? nextPickIdx - activeIdx : null;

    const recentPicks = allPicks
      .slice(Math.max(0, activeIdx - 8), activeIdx)
      .reverse()
      .map(p => ({ round: p.round, pick: p.pick, team: p.currentOwner ?? '', player: p.selectedPlayerName ?? '(skipped)' }));

    // Rules summary: include scoring and roster rules
    const allRules = await db
      .select({ rule: rules.rule, value: rules.value, desc: rules.desc })
      .from(rules)
      .where(eq(rules.leagueId, leagueId));
    const rulesSummary = allRules
      .filter(r => /score|scoring|roster|cap|salary|draft_clock|positional|active_roster/i.test(r.rule))
      .map(r => `${r.rule}: ${r.value}${r.desc ? ` (${r.desc})` : ''}`)
      .join('\n');

    const ctx: ScoutContext = {
      teamName: team.name ?? targetTeamshort,
      teamShort: targetTeamshort,
      draftYear,
      currentRound,
      picksUntilNext,
      recentPicks,
      roster: roster.map(r => ({ name: r.name, position: r.position, overall: r.overall, age: r.age })),
      pool: pool.map(p => ({ ...p, scouting: p.scouting ?? null })),
      rulesSummary,
      needsText,
    };

    const recommendations = await getDraftScoutRecommendations(ctx);
    return NextResponse.json({
      recommendations,
      meta: { teamName: ctx.teamName, currentRound, picksUntilNext, poolSize: pool.length, rosterSize: roster.length },
    });
  } catch (error) {
    const msg = error instanceof Error ? error.message : String(error);
    console.error('[scout/recommend]', msg);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
