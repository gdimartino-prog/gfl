import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/auth';
import { db } from '@/lib/db';
import { players, rules } from '@/schema';
import { eq, and } from 'drizzle-orm';
import { getLeagueId } from '@/lib/getLeagueId';
import {
  getAutoPickQueue,
  addToAutoPickQueue,
  removeFromAutoPickQueue,
  resolveTeamId,
} from '@/lib/autoPickQueue';

const VALID_DRAFT_TYPES = ['free_agent', 'rookie'] as const;
type DraftType = typeof VALID_DRAFT_TYPES[number];

function validateDraftType(value: unknown): DraftType {
  if (typeof value === 'string' && (VALID_DRAFT_TYPES as readonly string[]).includes(value)) {
    return value as DraftType;
  }
  return 'free_agent';
}

function getDraftTypeParam(req: NextRequest): DraftType {
  return validateDraftType(new URL(req.url).searchParams.get('draftType'));
}

async function getDraftYear(leagueId: number): Promise<number> {
  const row = await db.select({ value: rules.value })
    .from(rules)
    .where(and(eq(rules.rule, 'draft_year'), eq(rules.leagueId, leagueId)))
    .limit(1);
  return parseInt(row[0]?.value || '0') || new Date().getFullYear();
}

export async function GET(req: NextRequest) {
  const session = await auth();
  if (!session?.user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const callerShort = (session.user as { id?: string }).id ?? '';
  const role = (session.user as { role?: string }).role ?? '';
  const admin = role === 'superuser' || role === 'admin';

  const leagueId = await getLeagueId();
  const year = await getDraftYear(leagueId);
  const draftType = getDraftTypeParam(req);

  const url = new URL(req.url);
  const targetShort = (admin && url.searchParams.get('teamshort'))
    ? url.searchParams.get('teamshort')!
    : callerShort;

  const teamId = await resolveTeamId(leagueId, targetShort);
  if (!teamId) return NextResponse.json({ error: 'Team not found' }, { status: 404 });

  const queue = await getAutoPickQueue(leagueId, teamId, year, draftType);
  return NextResponse.json(queue, {
    headers: { 'Cache-Control': 'private, no-store' },
  });
}

export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session?.user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  try {
    const { playerId, draftType: bodyDraftType } = await req.json();
    if (!playerId || typeof playerId !== 'number') {
      return NextResponse.json({ error: 'playerId (number) required' }, { status: 400 });
    }

    const callerShort = (session.user as { id?: string }).id ?? '';
    const leagueId = await getLeagueId();
    const year = await getDraftYear(leagueId);
    const draftType = validateDraftType(bodyDraftType);

    const teamId = await resolveTeamId(leagueId, callerShort);
    if (!teamId) return NextResponse.json({ error: 'Team not found' }, { status: 404 });

    const playerRow = await db.select({ id: players.id, teamId: players.teamId })
      .from(players)
      .where(and(eq(players.id, playerId), eq(players.leagueId, leagueId)))
      .limit(1);

    if (!playerRow[0]) return NextResponse.json({ error: 'Player not found' }, { status: 404 });
    if (playerRow[0].teamId !== null) {
      return NextResponse.json({ error: 'Player is already on a roster' }, { status: 400 });
    }

    await addToAutoPickQueue(leagueId, teamId, playerId, year, draftType, callerShort);
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('draft-queue POST error:', error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}

export async function DELETE(req: NextRequest) {
  const session = await auth();
  if (!session?.user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  try {
    const { playerId, draftType: bodyDraftType } = await req.json();
    if (!playerId || typeof playerId !== 'number') {
      return NextResponse.json({ error: 'playerId (number) required' }, { status: 400 });
    }

    const callerShort = (session.user as { id?: string }).id ?? '';
    const leagueId = await getLeagueId();
    const year = await getDraftYear(leagueId);
    const draftType = validateDraftType(bodyDraftType);

    const teamId = await resolveTeamId(leagueId, callerShort);
    if (!teamId) return NextResponse.json({ error: 'Team not found' }, { status: 404 });

    await removeFromAutoPickQueue(leagueId, teamId, playerId, year, draftType);
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('draft-queue DELETE error:', error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}
