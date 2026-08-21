import { NextRequest, NextResponse } from 'next/server';
import { auth } from "@/auth";
import { db } from '@/lib/db';
import { tradeBlock, teams, players } from '@/schema';
import { and, eq, sql } from 'drizzle-orm';
import { getLeagueId } from '@/lib/getLeagueId';
import { notifyTradeBlock } from '@/lib/notify';
import { isPrivileged } from '@/lib/auth';
import { unstable_cache, revalidateTag } from 'next/cache';

// Tiny, rarely-mutated table fetched on every rosters-page visit — cache it.
// POST/DELETE bust the 'trade-block' tag below.
const _getTradeBlock = unstable_cache(
  async (leagueId: number) => {
    return db
      .select({
        playerId: tradeBlock.playerId,
        playerName: tradeBlock.playerName,
        team: tradeBlock.team,
        position: tradeBlock.position,
        asking: tradeBlock.asking,
        espnId: players.espnId,
      })
      .from(tradeBlock)
      .leftJoin(players, and(eq(players.identity, tradeBlock.playerId), eq(players.leagueId, leagueId)))
      .where(eq(tradeBlock.leagueId, leagueId))
      .orderBy(tradeBlock.touch_dt);
  },
  ['trade-block-v1'],
  { revalidate: 300, tags: ['trade-block'] },
);

export async function GET() {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
  }
  try {
    const leagueId = await getLeagueId();
    const rows = await _getTradeBlock(leagueId);
    return NextResponse.json(
      rows.map(r => ({
        playerId: r.playerId,
        playerName: r.playerName,
        team: r.team,
        position: r.position,
        asking: r.asking,
        espnId: r.espnId ?? null,
      })),
      { headers: { 'Cache-Control': 'private, max-age=60, stale-while-revalidate=120' } },
    );
  } catch (error) {
    console.error("Failed to retrieve trade block:", error);
    return NextResponse.json({ message: "Failed to retrieve trade block" }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
  }

  try {
    const { playerId, playerName, team, position, asking } = await req.json();

    if (!playerId || !playerName || !team) {
      return NextResponse.json({ message: "Missing required player information" }, { status: 400 });
    }

    const leagueId = await getLeagueId();
    const callerTeamshort = (session.user as { id?: string }).id || '';
    const privileged = await isPrivileged();
    if (!privileged && callerTeamshort.toLowerCase() !== (team || '').toLowerCase()) {
      return NextResponse.json({ message: "Forbidden: you can only list players from your own team" }, { status: 403 });
    }

    // Verify the player actually belongs to the declaring team.
    // playerId is the player's identity string (first|last|age|...), not a numeric DB id.
    if (!privileged) {
      const [playerRow, callerTeamRow] = await Promise.all([
        db.select({ teamId: players.teamId })
          .from(players)
          .where(and(eq(players.identity, String(playerId)), eq(players.leagueId, leagueId)))
          .limit(1),
        db.select({ id: teams.id })
          .from(teams)
          .where(and(sql`upper(${teams.teamshort}) = ${callerTeamshort.toUpperCase()}`, eq(teams.leagueId, leagueId)))
          .limit(1),
      ]);
      if (!playerRow[0] || !callerTeamRow[0] || playerRow[0].teamId !== callerTeamRow[0].id) {
        return NextResponse.json({ message: "Forbidden: player does not belong to your team" }, { status: 403 });
      }
    }

    const touchId = callerTeamshort || session.user.name || 'unknown';

    await db.insert(tradeBlock).values({
      leagueId,
      playerId,
      playerName,
      team,
      position: position || null,
      asking: asking || null,
      touch_id: touchId,
    }).onConflictDoUpdate({
      target: [tradeBlock.leagueId, tradeBlock.playerId],
      set: { playerName, team, position, asking, touch_id: touchId },
    });

    const fullBlock = await db.select({
      playerName: tradeBlock.playerName,
      team: tradeBlock.team,
      position: tradeBlock.position,
      asking: tradeBlock.asking,
    }).from(tradeBlock).where(eq(tradeBlock.leagueId, leagueId)).orderBy(tradeBlock.touch_dt);
    revalidateTag('trade-block', 'max');

    await notifyTradeBlock({
      newPlayer: { playerName, team, position: position || null, asking: asking || null },
      block: fullBlock.map(p => ({ ...p, playerName: p.playerName ?? '', team: p.team ?? '' })),
      leagueId,
    }).catch(e => console.error('Trade block notify failed:', e));

    return NextResponse.json({ message: "Player added to trade block" });
  } catch (error) {
    const msg = error instanceof Error ? error.message : String(error);
    const stack = error instanceof Error ? error.stack : undefined;
    console.error("[trade-block POST]", JSON.stringify({ msg, stack }));
    return NextResponse.json({ message: "Failed to add player to trade block" }, { status: 500 });
  }
}

export async function DELETE(req: NextRequest) {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
  }

  const { searchParams } = new URL(req.url);
  const playerId = searchParams.get('playerId');

  if (!playerId) {
    return NextResponse.json({ message: "Player ID is required" }, { status: 400 });
  }

  try {
    const leagueId = await getLeagueId();
    const teamCode = (session.user as { id?: string }).id || '';
    const privileged = await isPrivileged();

    // Verify ownership unless admin or commissioner
    if (!privileged) {
      const existing = await db.select({ team: tradeBlock.team }).from(tradeBlock)
        .where(and(eq(tradeBlock.playerId, playerId), eq(tradeBlock.leagueId, leagueId)))
        .limit(1);
      if (!existing[0] || existing[0].team?.toUpperCase() !== teamCode.toUpperCase()) {
        return NextResponse.json({ message: "Forbidden" }, { status: 403 });
      }
    }

    await db.delete(tradeBlock).where(
      and(eq(tradeBlock.playerId, playerId), eq(tradeBlock.leagueId, leagueId))
    );
    revalidateTag('trade-block', 'max');
    return NextResponse.json({ message: "Player removed from trade block" });
  } catch (error) {
    const msg = error instanceof Error ? error.message : String(error);
    const stack = error instanceof Error ? error.stack : undefined;
    console.error("[trade-block DELETE]", JSON.stringify({ msg, stack }));
    return NextResponse.json({ message: "Failed to remove player from trade block" }, { status: 500 });
  }
}
