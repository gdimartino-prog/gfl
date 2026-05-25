import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/auth';
import { db } from '@/lib/db';
import { draftPicks, nflDraft, players, rules, teams } from '@/schema';
import { and, asc, eq, inArray, isNull, lte, or, sql } from 'drizzle-orm';
import { alias } from 'drizzle-orm/pg-core';
import { getLeagueId } from '@/lib/getLeagueId';
import { getDraftScoutRecommendations, buildScoutPrompt, type ScoutContext } from '@/lib/gemini';
import { expandPositionGroups } from '@/lib/positionGroups';
import { tokenBucket } from '@/lib/rateLimit';
import { buildDepthChartIndex, depthRankLabel } from '@/lib/ourlads';
import { logSystemEvent } from '@/lib/db-helpers';
import { remark } from 'remark';
import remarkHtml from 'remark-html';
import remarkGfm from 'remark-gfm';

export const maxDuration = 60;

function normalizeName(name: string): string {
  const stripped = name.includes(' - ') ? name.split(' - ').slice(1).join(' - ') : name;
  return stripped
    .toLowerCase()
    .replace(/[^a-z\s]/g, '')
    .replace(/\s+/g, ' ')
    .trim();
}

export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session?.user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  // Per-user rate limit: 10 submits / hour. Scout is expensive (Gemini + DB +
  // up to 60s function time), so cap abuse / accidental loops.
  const rateKey = `scout:${(session.user as { id?: string }).id || session.user.email || 'anon'}`;
  const rl = tokenBucket(rateKey, 10, 3600);
  if (!rl.ok) {
    return NextResponse.json(
      { error: `Rate limit exceeded. Try again in ${rl.retryAfterSec}s.` },
      { status: 429, headers: { 'Retry-After': String(rl.retryAfterSec) } },
    );
  }

  try {
    const body = await req.json();
    const needsText: string = (body.needs || '').toString().slice(0, 4000);
    const teamShortIn: string | null = body.teamShort ? String(body.teamShort).toUpperCase() : null;
    const positionGroupsIn: string[] = Array.isArray(body.positionGroups)
      ? body.positionGroups.map((s: unknown) => String(s)).slice(0, 20)
      : [];
    const positionsFilter = expandPositionGroups(positionGroupsIn);
    const maxAgeRaw = Number(body.maxAge);
    const maxAge = Number.isFinite(maxAgeRaw) && maxAgeRaw > 0 && maxAgeRaw < 100 ? Math.floor(maxAgeRaw) : null;
    const rookiesOnly = body.rookiesOnly === true;
    // Mode: fast (no Search grounding, ~$0.02/call), full (with Search, ~$0.30/call),
    // copy (return assembled prompt only, $0/call — user pastes into Gemini chat).
    const modeIn = typeof body.mode === 'string' ? body.mode : 'fast';
    const mode: 'fast' | 'full' | 'copy' =
      modeIn === 'full' ? 'full' : modeIn === 'copy' ? 'copy' : 'fast';

    const leagueId = await getLeagueId();

    // Resolve which team to scout for: explicit request, else the caller's own team
    const callerTeamshort = (session.user as { id?: string }).id?.toUpperCase() || '';
    const targetTeamshort = teamShortIn || callerTeamshort;
    if (!targetTeamshort) {
      return NextResponse.json({ error: 'No team to scout for' }, { status: 400 });
    }

    // Batch 1: queries with no dependency on each other (team, draft_year, rules)
    const [teamRow, draftYearRow, allRules] = await Promise.all([
      db
        .select({ id: teams.id, name: teams.name, teamshort: teams.teamshort })
        .from(teams)
        .where(and(eq(teams.leagueId, leagueId), sql`upper(${teams.teamshort}) = ${targetTeamshort}`))
        .limit(1),
      db.select({ value: rules.value })
        .from(rules)
        .where(and(eq(rules.leagueId, leagueId), eq(rules.rule, 'draft_year'), isNull(rules.year)))
        .limit(1),
      db
        .select({ rule: rules.rule, value: rules.value, desc: rules.desc })
        .from(rules)
        .where(eq(rules.leagueId, leagueId)),
    ]);
    if (!teamRow[0]) return NextResponse.json({ error: `Team ${targetTeamshort} not found` }, { status: 404 });
    const team = teamRow[0];
    const draftYear = parseInt(draftYearRow[0]?.value || '0') || new Date().getFullYear();

    // Optional rookie filter: pull the most recent NFL draft class and build
    // a SQL expression that filters the pool to those names directly.
    let rookieSqlFilter: ReturnType<typeof inArray> | undefined;
    if (rookiesOnly) {
      const maxYearRow = await db
        .select({ y: sql<number>`MAX(${nflDraft.year})` })
        .from(nflDraft);
      const rookieYear = maxYearRow[0]?.y;
      let rookieNamesArr: string[] = [];
      if (rookieYear) {
        const rookies = await db
          .select({ name: nflDraft.playerName })
          .from(nflDraft)
          .where(eq(nflDraft.year, rookieYear));
        rookieNamesArr = Array.from(new Set(rookies.map(r => normalizeName(r.name))));
      }
      // Normalize player first+last in SQL to match JS normalizeName():
      //   lower → strip non-letter / non-space → collapse whitespace → trim
      const normalizedFullName = sql<string>`trim(regexp_replace(regexp_replace(lower(coalesce(${players.first}, '') || ' ' || coalesce(${players.last}, '')), '[^a-z[:space:]]', '', 'g'), '\s+', ' ', 'g'))`;
      rookieSqlFilter = rookieNamesArr.length > 0
        ? inArray(normalizedFullName, rookieNamesArr)
        : inArray(normalizedFullName, ['__no_rookies__']);
    }

    // Build pool/roster/picks queries in parallel (Batch 2).
    const positionFilter = positionsFilter.length > 0
      ? or(
          inArray(players.position, positionsFilter),
          inArray(players.offense, positionsFilter),
          inArray(players.defense, positionsFilter),
          inArray(players.special, positionsFilter),
        )
      : undefined;
    const ageFilter = maxAge != null ? lte(players.age, maxAge) : undefined;
    const originalTeams = alias(teams, 'originalTeams');
    const currentTeams = alias(teams, 'currentTeams');

    const [roster, pool, allPicks] = await Promise.all([
      // Roster: players currently on this team (full rating set — same as the pool)
      db
        .select({
          name: players.name, position: players.position, age: players.age,
          overall: players.overall, runBlock: players.runBlock, passBlock: players.passBlock,
          rushYards: players.rushYards, interceptionsVal: players.interceptionsVal,
          sacksVal: players.sacksVal, durability: players.durability, scouting: players.scouting,
        })
        .from(players)
        .where(and(eq(players.leagueId, leagueId), eq(players.teamId, team.id))),
      // Pool: undrafted players, optionally filtered by position group / age / rookies
      db
        .select({
          name: players.name, position: players.position, age: players.age,
          overall: players.overall, runBlock: players.runBlock, passBlock: players.passBlock,
          rushYards: players.rushYards, interceptionsVal: players.interceptionsVal,
          sacksVal: players.sacksVal, durability: players.durability, scouting: players.scouting,
        })
        .from(players)
        .where(and(eq(players.leagueId, leagueId), isNull(players.teamId), positionFilter, ageFilter, rookieSqlFilter))
        .orderBy(sql`COALESCE(NULLIF(${players.overall}, '')::numeric, 0) DESC`)
        .limit(400),
      // Active-draft context: all picks for the current draft year + current owner
      db.select({
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
      .orderBy(asc(draftPicks.pick)),
    ]);

    const activeIdx = allPicks.findIndex(p => !p.playerId && !p.pickedAt && !p.passed);
    const nextPickIdx = allPicks.findIndex((p, i) => i >= activeIdx && p.currentTeamId === team.id && !p.playerId && !p.pickedAt && !p.passed);
    const currentRound = activeIdx >= 0 ? allPicks[activeIdx].round : null;
    const picksUntilNext = nextPickIdx >= 0 && activeIdx >= 0 ? nextPickIdx - activeIdx : null;

    const recentPicks = allPicks
      .slice(Math.max(0, activeIdx - 8), activeIdx)
      .reverse()
      .map(p => ({ round: p.round, pick: p.pick, team: p.currentOwner ?? '', player: p.selectedPlayerName ?? '(skipped)' }));

    const rulesSummary = allRules
      .filter(r => /score|scoring|roster|cap|salary|draft_clock|positional|active_roster/i.test(r.rule))
      .map(r => `${r.rule}: ${r.value}${r.desc ? ` (${r.desc})` : ''}`)
      .join('\n');

    // Annotate the pool with cached Ourlads depth-chart info so Gemini can
    // skip the Google Search round-trips that were timing the function out.
    // If the cache miss takes too long (cold start), fall back gracefully.
    let depthIdx: Awaited<ReturnType<typeof buildDepthChartIndex>> | null = null;
    try {
      const timeout = new Promise<null>(resolve => setTimeout(() => resolve(null), 12000));
      depthIdx = await Promise.race([buildDepthChartIndex(), timeout]);
    } catch {
      depthIdx = null;
    }
    const annotatedPool = pool.map(p => {
      const scouting = p.scouting ?? null;
      if (!depthIdx) return { ...p, scouting };
      const key = (`${p.name ?? ''}`).toLowerCase().replace(/[^a-z\s]/g, '').replace(/\s+/g, ' ').trim();
      const dc = depthIdx.get(key);
      if (!dc) return { ...p, scouting };
      return {
        ...p,
        scouting,
        nflTeam: dc.teamName,
        nflPosition: dc.position,
        nflDepthRank: dc.depthRank,
        nflRoleLabel: depthRankLabel(dc.position, dc.depthRank),
      };
    });

    const ctx: ScoutContext = {
      teamName: team.name ?? targetTeamshort,
      teamShort: targetTeamshort,
      draftYear,
      currentRound,
      picksUntilNext,
      recentPicks,
      roster: roster.map(r => ({ ...r, scouting: r.scouting ?? null })),
      pool: annotatedPool,
      rulesSummary,
      needsText,
    };

    const callerCoachName = session.user.name || 'Unknown Coach';
    const callerTeamshortForLog = (session.user as { id?: string }).id || '';
    const auditDetails = `team=${targetTeamshort} pool=${pool.length} positions=${positionGroupsIn.length ? positionGroupsIn.join(',') : 'all'} rookiesOnly=${rookiesOnly} maxAge=${maxAge ?? 'none'} needsChars=${needsText.length} mode=${mode}`;

    if (mode === 'copy') {
      // Free path: assemble the prompt server-side, return it as text, and
      // skip the Gemini call entirely. User pastes into gemini.google.com.
      const promptText = buildScoutPrompt(ctx, { useSearch: false });
      await logSystemEvent(callerCoachName, callerTeamshortForLog, 'SCOUT_COPY_PROMPT', auditDetails, leagueId);
      return NextResponse.json({
        mode,
        promptText,
        meta: {
          teamName: ctx.teamName, currentRound, picksUntilNext,
          poolSize: pool.length, rosterSize: roster.length,
          maxAge, rookiesOnly, mode,
        },
      });
    }

    const recommendations = await getDraftScoutRecommendations(ctx, { useSearch: mode === 'full' });

    // Audit log Gemini usage so per-user costs can be reconciled against
    // Google Cloud billing. Captures filter context + which mode was used.
    await logSystemEvent(callerCoachName, callerTeamshortForLog, 'SCOUT_RECOMMEND', auditDetails, leagueId);
    // sanitize: true strips raw HTML / javascript: URLs from Gemini output.
    // Markdown links/headings/bold etc still render — only inline HTML is removed.
    const processed = await remark().use(remarkGfm).use(remarkHtml, { sanitize: true }).process(recommendations);
    const recommendationsHtml = String(processed);
    return NextResponse.json({
      mode,
      recommendations,
      recommendationsHtml,
      meta: {
        teamName: ctx.teamName, currentRound, picksUntilNext,
        poolSize: pool.length, rosterSize: roster.length,
        maxAge, rookiesOnly, mode,
      },
    });
  } catch (error) {
    const msg = error instanceof Error ? error.message : String(error);
    console.error('[scout/recommend]', msg);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
