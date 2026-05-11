import { NextRequest, NextResponse } from 'next/server';
import { getAllDraftPicks, upsertPickTransfer, findDraftPick, clearPickSelection, clearAllPickSelections, DraftPickRow } from '@/lib/draftPicks';
import { getLeagueId } from '@/lib/getLeagueId';
import { db } from '@/lib/db';
import { draftPicks, pickTransfers, teams } from '@/schema';
import { and, eq } from 'drizzle-orm';
import { auth } from '@/auth';
import { isAdmin, isCommissioner } from '@/lib/auth';
import { logSystemEvent } from '@/lib/db-helpers';
import { getDraftClockMinutes, getDraftStartDate, getDraftYear } from '@/lib/draftClock';
import { getTeamShortMap } from '@/lib/config';
import { revalidateTag } from 'next/cache';

export async function GET(req: NextRequest) {
  const session = await auth();
  if (!session?.user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  try {
    const leagueId = await getLeagueId();
    const typeFilter = req.nextUrl.searchParams.get('type'); // 'rookie' | 'free_agent' | null = all
    const [allPicks, draftYear] = await Promise.all([
      getAllDraftPicks(leagueId),
      getDraftYear(leagueId),
    ]);
    const filtered = typeFilter ? (allPicks as DraftPickRow[]).filter(p => p.draftType === typeFilter) : allPicks as DraftPickRow[];

    // Sort by overall pick number then find the first undrafted pick (on the clock)
    const sorted = [...filtered].sort((a, b) => (a.pick ?? 0) - (b.pick ?? 0));

    // Scope Active pick determination to the current draft year only.
    // getAllDraftPicks returns all years; mixing years causes wrong picks to be
    // marked Active because pick numbers repeat across years.
    const currentYearSorted = sorted.filter(p => p.year === draftYear);

    // Build set of pick numbers that already have a finalized entry (current year only)
    const draftedPickNums = new Set<number>(
      currentYearSorted
        .filter(p => !!p.selectedPlayer || !!p.selectedPlayerName)
        .map(p => p.pick ?? -1)
    );

    let onClockSet = false;
    let activeRound: number | null = null;
    for (const p of currentYearSorted) {
      const isSkipped = !p.selectedPlayer && !p.selectedPlayerName && !!p.pickedAt && !p.passed;
      const isDrafted = !!p.selectedPlayer || !!p.selectedPlayerName || isSkipped;
      if (!isDrafted && !p.passed && !draftedPickNums.has(p.pick ?? -1)) { activeRound = p.round; break; }
    }
    // Hold "Active" status until the official draft start date has passed.
    // Run start-date, clock-minutes, and team-short-map lookups in parallel since
    // each used to be its own sequential DB call.
    const [draftStartDate, clockMinutes, teamShortMap] = await Promise.all([
      getDraftStartDate(leagueId),
      activeRound !== null ? getDraftClockMinutes(leagueId, activeRound) : Promise.resolve(null),
      getTeamShortMap(leagueId),
    ]);
    const draftHasStarted = !draftStartDate || new Date() >= draftStartDate;
    const effectiveClockMinutes = draftHasStarted ? clockMinutes : null;

    // Build set of pick IDs that are in the current draft year — only these can be Active
    const currentYearPickIds = new Set(currentYearSorted.map(p => p.id));

    const formattedPicks = sorted.map(p => {
      const isSkipped = !p.selectedPlayer && !p.selectedPlayerName && !!p.pickedAt && !p.passed; // auto-expired, no player
      const isDrafted = !!p.selectedPlayer || !!p.selectedPlayerName || isSkipped;
      const isPassed = !isDrafted && p.passed;
      let status: string;
      if (isSkipped) {
        status = 'Skipped';
      } else if (isDrafted) {
        status = 'Drafted';
      } else if (isPassed) {
        status = 'Passed';
      } else if (!onClockSet && draftHasStarted && currentYearPickIds.has(p.id) && !draftedPickNums.has(p.pick ?? -1)) {
        status = 'Active';
        onClockSet = true;
      } else {
        status = 'Available';
      }
      return {
        id: p.id,
        year: String(p.year ?? ''),
        round: String(p.round ?? ''),
        overall: String(p.pick ?? ''),
        draftType: p.draftType ?? 'free_agent',
        originalTeam: p.originalTeam ?? '',
        currentOwner: p.currentOwner ?? '',
        via: (p.originalTeamShort && p.currentOwner && p.originalTeamShort !== p.currentOwner) ? p.originalTeam : null,
        status,
        draftedPlayer: p.selectedPlayer ?? p.selectedPlayerName ?? '',
        draftedPlayerPosition: p.selectedPlayerPosition ?? '',
        timestamp: p.pickedAt ? new Date(p.pickedAt).toISOString() : '',
        clockMinutes: status === 'Active' ? effectiveClockMinutes : null,
        scheduledAt: p.scheduledAt ? new Date(p.scheduledAt).toISOString() : null,
        processedBy: '',
        history: (p.transferHistory && p.transferHistory.length > 0)
          ? p.transferHistory.map(id => teamShortMap[id] ?? '').filter(Boolean).join(',')
          : '',
      };
    });

    return NextResponse.json(formattedPicks, {
      headers: { 'Cache-Control': 'private, max-age=15, stale-while-revalidate=30' },
    });
  } catch (error) {
    console.error('API /draft-picks GET failed:', error);
    return NextResponse.json({ error: 'Failed to load draft picks' }, { status: 500 });
  }
}

export async function POST(req: Request) {
  const session = await auth();
  if (!session?.user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  const authorized = await isAdmin() || await isCommissioner();
  if (!authorized) return NextResponse.json({ error: 'Commissioner access required' }, { status: 403 });
  try {
    const body = await req.json();
    const { fromTeam, toTeam, year, round, overall, coachName } = body;

    // Validation check
    if (!fromTeam || !toTeam || !year || !round) {
      return NextResponse.json(
        { error: 'Missing required fields' },
        { status: 400 }
      );
    }

    const leagueId = await getLeagueId();

    // Resolve team short codes to DB IDs
    const [fromTeamRows, toTeamRows] = await Promise.all([
      db.select({ id: teams.id }).from(teams).where(and(eq(teams.teamshort, fromTeam), eq(teams.leagueId, leagueId))).limit(1),
      db.select({ id: teams.id }).from(teams).where(and(eq(teams.teamshort, toTeam), eq(teams.leagueId, leagueId))).limit(1),
    ]);

    if (!fromTeamRows[0] || !toTeamRows[0]) {
      return NextResponse.json({ error: 'Team not found' }, { status: 404 });
    }

    // Find the specific pick by current owner, year, round
    const pick = await findDraftPick(
      fromTeamRows[0].id,
      Number(year),
      Number(round),
      overall ? Number(overall) : undefined
    );

    if (!pick) {
      return NextResponse.json({ error: 'Draft pick not found' }, { status: 404 });
    }

    await upsertPickTransfer({ leagueId, pickId: pick.id, toTeamId: toTeamRows[0].id, touchId: coachName || 'commissioner' });
    revalidateTag('draft-picks', 'max');

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('API /draft-picks POST failed:', error);
    return NextResponse.json(
      { error: 'Draft pick transfer failed' },
      { status: 500 }
    );
  }
}

export async function DELETE(req: Request) {
  const session = await auth();
  if (!session?.user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  const authorized = await isAdmin() || await isCommissioner();
  if (!authorized) return NextResponse.json({ error: 'Commissioner access required' }, { status: 403 });

  try {
    const { pickId, clearAll, year, draftType } = await req.json();
    const leagueId = await getLeagueId();
    const actor = session.user.name || 'Commissioner';

    if (clearAll) {
      if (!year) return NextResponse.json({ error: 'year required for clearAll' }, { status: 400 });
      await clearAllPickSelections(leagueId, Number(year), actor, draftType);
      logSystemEvent(actor, 'admin', 'DRAFT_CLEAR_ALL', `Cleared all picks for ${year}${draftType ? ` (${draftType})` : ''}`, leagueId);
      return NextResponse.json({ success: true });
    }

    if (!pickId) return NextResponse.json({ error: 'pickId required' }, { status: 400 });
    await clearPickSelection(Number(pickId), actor);
    logSystemEvent(actor, 'admin', 'DRAFT_DELETE_PICK', `Deleted pick #${pickId}`, leagueId);
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('API /draft-picks DELETE failed:', error);
    return NextResponse.json({ error: 'Failed to delete pick' }, { status: 500 });
  }
}

// Revert a traded pick back to its original owner
export async function PATCH(req: Request) {
  const session = await auth();
  if (!session?.user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  const authorized = await isAdmin() || await isCommissioner();
  if (!authorized) return NextResponse.json({ error: 'Commissioner access required' }, { status: 403 });

  try {
    const { pickId } = await req.json();
    if (!pickId) return NextResponse.json({ error: 'pickId required' }, { status: 400 });

    const leagueId = await getLeagueId();
    const actor = session.user.name || 'Commissioner';

    const pick = await db.select({
      originalTeamId: draftPicks.originalTeamId,
      year: draftPicks.year,
      round: draftPicks.round,
      draftType: draftPicks.draftType,
    }).from(draftPicks)
      .where(and(eq(draftPicks.id, pickId), eq(draftPicks.leagueId, leagueId)))
      .limit(1);

    if (!pick[0] || !pick[0].originalTeamId) {
      return NextResponse.json({ error: 'Pick not found' }, { status: 404 });
    }

    const { originalTeamId, year, round, draftType } = pick[0];

    await Promise.all([
      db.update(draftPicks)
        .set({ currentTeamId: originalTeamId })
        .where(and(eq(draftPicks.id, pickId), eq(draftPicks.leagueId, leagueId))),
      db.delete(pickTransfers)
        .where(and(
          eq(pickTransfers.leagueId, leagueId),
          eq(pickTransfers.year, year!),
          eq(pickTransfers.draftType, draftType!),
          eq(pickTransfers.round, round),
          eq(pickTransfers.originalTeamId, originalTeamId),
        )),
    ]);

    revalidateTag('draft-picks', 'max');
    logSystemEvent(actor, 'admin', 'DRAFT_REVERT_TRANSFER', `Reverted transfer for pick id=${pickId}`, leagueId);

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('API /draft-picks PATCH failed:', error);
    return NextResponse.json({ error: 'Failed to revert transfer' }, { status: 500 });
  }
}