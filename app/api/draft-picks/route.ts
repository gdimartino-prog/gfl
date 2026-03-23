import { NextRequest, NextResponse } from 'next/server';
import { getAllDraftPicks, transferDraftPick, findDraftPick, clearPickSelection, clearAllPickSelections, DraftPickRow } from '@/lib/draftPicks';
import { getLeagueId } from '@/lib/getLeagueId';
import { db } from '@/lib/db';
import { teams } from '@/schema';
import { and, eq } from 'drizzle-orm';
import { auth } from '@/auth';
import { isAdmin, isCommissioner } from '@/lib/auth';
import { logSystemEvent } from '@/lib/db-helpers';
import { getDraftClockMinutes } from '@/lib/draftClock';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

export async function GET(req: NextRequest) {
  try {
    const leagueId = await getLeagueId();
    const typeFilter = req.nextUrl.searchParams.get('type'); // 'rookie' | 'free_agent' | null = all
    const allPicks = await getAllDraftPicks(leagueId);
    const filtered = typeFilter ? (allPicks as DraftPickRow[]).filter(p => p.draftType === typeFilter) : allPicks as DraftPickRow[];

    // Sort by overall pick number then find the first undrafted pick (on the clock)
    const sorted = [...filtered].sort((a, b) => (a.pick ?? 0) - (b.pick ?? 0));
    let onClockSet = false;
    let activeRound: number | null = null;
    for (const p of sorted) {
      const isSkipped = !p.selectedPlayer && !!p.pickedAt && !p.passed;
      const isDrafted = !!p.selectedPlayer || isSkipped;
      if (!isDrafted && !p.passed) { activeRound = p.round; break; }
    }
    const clockMinutes = activeRound !== null ? await getDraftClockMinutes(leagueId, activeRound) : null;

    const formattedPicks = sorted.map(p => {
      const isSkipped = !p.selectedPlayer && !!p.pickedAt && !p.passed; // auto-expired, no player
      const isDrafted = !!p.selectedPlayer || isSkipped;
      const isPassed = !isDrafted && p.passed;
      let status: string;
      if (isSkipped) {
        status = 'Skipped';
      } else if (isDrafted) {
        status = 'Drafted';
      } else if (isPassed) {
        status = 'Passed';
      } else if (!onClockSet) {
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
        via: (p.originalTeam && p.currentOwner && p.originalTeam !== p.currentOwner) ? p.originalTeam : null,
        status,
        draftedPlayer: p.selectedPlayer ?? p.selectedPlayerName ?? '',
        draftedPlayerPosition: p.selectedPlayerPosition ?? '',
        timestamp: p.pickedAt ? p.pickedAt.toISOString() : '',
        clockMinutes: status === 'Active' ? clockMinutes : null,
        scheduledAt: p.scheduledAt ? p.scheduledAt.toISOString() : null,
        processedBy: '',
        history: '',
      };
    });

    return NextResponse.json(formattedPicks);
  } catch (error) {
    console.error('API /draft-picks GET failed:', error);
    return NextResponse.json({ error: 'Failed to load draft picks' }, { status: 500 });
  }
}

export async function POST(req: Request) {
  const session = await auth();
  if (!session?.user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
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

    await transferDraftPick(pick.id, toTeamRows[0].id, coachName);

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