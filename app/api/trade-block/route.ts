import { NextRequest, NextResponse } from 'next/server';
import { auth } from "@/auth";
import { db } from '@/lib/db';
import { tradeBlock } from '@/schema';
import { and, eq } from 'drizzle-orm';
import { getLeagueId } from '@/lib/getLeagueId';

export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    const leagueId = await getLeagueId();
    const rows = await db.select().from(tradeBlock)
      .where(eq(tradeBlock.leagueId, leagueId))
      .orderBy(tradeBlock.touch_dt);
    return NextResponse.json(rows.map(r => ({
      playerId: r.playerId,
      playerName: r.playerName,
      team: r.team,
      position: r.position,
      asking: r.asking,
    })));
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
    const touchId = (session.user as { id?: string }).id || session.user.name || 'unknown';

    await db.insert(tradeBlock).values({
      leagueId,
      playerId,
      playerName,
      team,
      position: position || null,
      asking: asking || null,
      touch_id: touchId,
    }).onConflictDoUpdate({
      target: tradeBlock.playerId,
      set: { leagueId, playerName, team, position, asking, touch_id: touchId },
    });

    return NextResponse.json({ message: "Player added to trade block" });
  } catch (error) {
    console.error("Failed to add player to trade block:", error);
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
    await db.delete(tradeBlock).where(
      and(eq(tradeBlock.playerId, playerId), eq(tradeBlock.leagueId, leagueId))
    );
    return NextResponse.json({ message: "Player removed from trade block" });
  } catch (error) {
    console.error("Failed to remove player from trade block:", error);
    return NextResponse.json({ message: "Failed to remove player from trade block" }, { status: 500 });
  }
}
