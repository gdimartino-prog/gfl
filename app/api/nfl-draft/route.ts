import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/auth';
import { isAdmin } from '@/lib/auth';
import { db } from '@/lib/db';
import { nflDraft, draftPicks, rules } from '@/schema';
import { eq, and, asc, isNotNull, isNull } from 'drizzle-orm';
import { getLeagueId } from '@/lib/getLeagueId';

export const dynamic = 'force-dynamic';

function normalizeName(name: string): string {
  return name
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

    // Get all completed GFL draft picks (players actually selected)
    let gflDraftedNames: Set<string> = new Set();
    if (draftYear) {
      const gflPicks = await db.select({ selectedPlayerName: draftPicks.selectedPlayerName })
        .from(draftPicks)
        .where(and(
          eq(draftPicks.leagueId, leagueId),
          eq(draftPicks.year, draftYear),
          isNotNull(draftPicks.pickedAt),
          isNotNull(draftPicks.selectedPlayerName),
        ));

      for (const p of gflPicks) {
        if (p.selectedPlayerName && !p.selectedPlayerName.startsWith('SKIPPED')) {
          gflDraftedNames.add(normalizeName(p.selectedPlayerName));
        }
      }
    }

    // Annotate each NFL pick with whether they were GFL drafted
    const result = nflPicks.map(p => ({
      ...p,
      gflDrafted: gflDraftedNames.has(normalizeName(p.playerName)),
    }));

    return NextResponse.json({ picks: result, draftYear, gflDraftedCount: gflDraftedNames.size });
  } catch (err) {
    console.error('NFL draft API error:', err);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}
