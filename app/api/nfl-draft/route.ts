import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/auth';
import { isAdmin } from '@/lib/auth';
import { db } from '@/lib/db';
import { nflDraft, draftPicks, rules, teams } from '@/schema';
import { eq, and, asc, isNotNull, isNull } from 'drizzle-orm';
import { alias } from 'drizzle-orm/pg-core';
import { getLeagueId } from '@/lib/getLeagueId';
import { getPlayers } from '@/lib/players';

export const dynamic = 'force-dynamic';

function normalizeName(name: string): string {
  // Strip GFL position prefix: "QB - Cam Ward" → "Cam Ward"
  const stripped = name.includes(' - ') ? name.split(' - ').slice(1).join(' - ') : name;
  return stripped
    .toLowerCase()
    .replace(/[^a-z\s]/g, '')
    .replace(/\s+/g, ' ')
    .trim();
}

export async function GET(req: NextRequest) {
  const session = await auth();
  if (!session?.user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  if (!(await isAdmin())) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

  const { searchParams } = new URL(req.url);
  const yearParam = searchParams.get('year');
  const year = yearParam ? parseInt(yearParam) : 2025;

  try {
    const leagueId = await getLeagueId();

    // Get draft year for this league
    const draftYearRow = await db.select({ value: rules.value })
      .from(rules)
      .where(and(eq(rules.rule, 'draft_year'), eq(rules.leagueId, leagueId), isNull(rules.year)))
      .limit(1);
    const draftYear = parseInt(draftYearRow[0]?.value || '0');

    // Get all NFL draft picks for requested year
    const nflPicks = await db.select()
      .from(nflDraft)
      .where(eq(nflDraft.year, year))
      .orderBy(asc(nflDraft.pick));

    // Get all completed GFL draft picks with team name
    const gflDraftedNames: Set<string> = new Set();
    const gflPickedBy: Map<string, string> = new Map(); // normalizedName → team name
    if (draftYear) {
      const currentTeams = alias(teams, 'currentTeams');
      const gflPicks = await db
        .select({ selectedPlayerName: draftPicks.selectedPlayerName, teamName: currentTeams.name })
        .from(draftPicks)
        .leftJoin(currentTeams, eq(draftPicks.currentTeamId, currentTeams.id))
        .where(and(
          eq(draftPicks.leagueId, leagueId),
          eq(draftPicks.year, draftYear),
          isNotNull(draftPicks.pickedAt),
          isNotNull(draftPicks.selectedPlayerName),
        ));

      for (const p of gflPicks) {
        if (p.selectedPlayerName && !p.selectedPlayerName.startsWith('SKIPPED')) {
          const key = normalizeName(p.selectedPlayerName);
          gflDraftedNames.add(key);
          if (p.teamName) gflPickedBy.set(key, p.teamName);
        }
      }
    }

    // Build name → identity map from GFL players
    const gflPlayers = await getPlayers(leagueId);
    const gflIdentityMap = new Map<string, string>(); // normalizedName → identity
    for (const p of gflPlayers) {
      const fullName = `${p.first} ${p.last}`.trim();
      gflIdentityMap.set(normalizeName(fullName), p.identity);
    }

    // Annotate each NFL pick with GFL draft info + identity for ratings lookup
    const result = nflPicks.map(p => {
      const key = normalizeName(p.playerName);
      return {
        ...p,
        gflDrafted: gflDraftedNames.has(key),
        gflTeam: gflPickedBy.get(key) ?? null,
        gflIdentity: gflIdentityMap.get(key) ?? null,
      };
    });

    return NextResponse.json({ picks: result, draftYear, gflDraftedCount: gflDraftedNames.size });
  } catch (err) {
    console.error('NFL draft API error:', err);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}
