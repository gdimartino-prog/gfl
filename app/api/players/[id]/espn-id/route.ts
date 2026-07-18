import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/auth';
import { db } from '@/lib/db';
import { players } from '@/schema';
import { eq, and } from 'drizzle-orm';
import { logSystemEvent } from '@/lib/db-helpers';
import { getLeagueId } from '@/lib/getLeagueId';

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth();
  if (!session?.user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const role = (session.user as { role?: string }).role || '';
  if (role !== 'admin' && role !== 'superuser') {
    return NextResponse.json({ error: 'Commissioner only' }, { status: 403 });
  }

  const { id } = await params;
  const playerId = parseInt(id);
  if (!Number.isInteger(playerId) || playerId <= 0) {
    return NextResponse.json({ error: 'Invalid player id' }, { status: 400 });
  }

  let espnId: string | null;
  try {
    ({ espnId } = await req.json());
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 });
  }
  // Allow null to clear a bad link
  if (espnId !== null && (typeof espnId !== 'string' || !/^\d+$/.test(espnId))) {
    return NextResponse.json({ error: 'espnId must be a numeric string or null' }, { status: 400 });
  }

  const leagueId = await getLeagueId();
  const callerName = (session.user as { name?: string }).name || 'Commissioner';

  await db.update(players)
    .set({ espnId: espnId ?? null, touch_id: callerName, touch_dt: new Date() })
    .where(and(eq(players.id, playerId), eq(players.leagueId, leagueId)));

  await logSystemEvent(callerName, 'System', 'PLAYER_UPDATE', `Set ESPN ID for player #${playerId}: ${espnId ?? 'cleared'}`, leagueId);

  return NextResponse.json({ success: true });
}
