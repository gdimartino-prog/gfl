import { db } from '@/lib/db';
import { teams } from '@/schema';
import { eq, and } from 'drizzle-orm';
import { logTransaction } from '@/lib/transactions';
import { upsertPickTransfer } from '@/lib/draftPicks';
import { notifyTransaction } from '@/lib/notify';
import { auth } from '@/auth';
import { isAdmin, isCommissioner } from '@/lib/auth';
import { getLeagueId } from '@/lib/getLeagueId';
import { revalidateTag } from 'next/cache';
import { logSystemEvent } from '@/lib/db-helpers';

export async function POST(req: Request) {
  const session = await auth();
  if (!session?.user) return Response.json({ message: 'Unauthorized' }, { status: 401 });

  try {
    const leagueId = await getLeagueId();
    const body = await req.json();
    const {
      fromTeam, toTeam, fromFull, toFull,
      playersFrom, playersTo,
      draftPicksFrom, draftPicksTo, rawPicksFrom, rawPicksTo,
    } = body;

    const callerTeamshort = (session.user as { id?: string }).id || '';
    const privileged = await isAdmin() || await isCommissioner();

    // Coaches can only submit trades involving their own team
    if (!privileged && callerTeamshort.toUpperCase() !== (fromTeam || '').toUpperCase()) {
      return Response.json({ message: 'Forbidden: you can only submit trades for your own team.' }, { status: 403 });
    }

    // Resolve team IDs for pick transfers
    const [fromTeamRow, toTeamRow] = await Promise.all([
      db.select({ id: teams.id }).from(teams)
        .where(and(eq(teams.leagueId, leagueId), eq(teams.teamshort, fromTeam))).limit(1),
      db.select({ id: teams.id }).from(teams)
        .where(and(eq(teams.leagueId, leagueId), eq(teams.teamshort, toTeam))).limit(1),
    ]);

    const fromTeamId = fromTeamRow[0]?.id;
    const toTeamId = toTeamRow[0]?.id;

    // Execute draft pick transfers immediately — picks are managed in the web app
    const transferUpserts: Promise<void>[] = [];
    if (rawPicksFrom?.length && fromTeamId && toTeamId) {
      for (const overall of rawPicksFrom as string[]) {
        transferUpserts.push(upsertPickTransfer({
          leagueId,
          pickOverall: parseInt(overall),
          toTeamId,
          touchId: callerTeamshort || 'trade',
        }));
      }
    }
    if (rawPicksTo?.length && fromTeamId && toTeamId) {
      for (const overall of rawPicksTo as string[]) {
        transferUpserts.push(upsertPickTransfer({
          leagueId,
          pickOverall: parseInt(overall),
          toTeamId: fromTeamId,
          touchId: callerTeamshort || 'trade',
        }));
      }
    }
    await Promise.all(transferUpserts);

    // Log transactions as Pending — player moves happen in the Action game
    const actorName = session.user.name || callerTeamshort || 'Coach';
    const proposerAssets = [...(playersFrom || []), ...(draftPicksFrom || [])].join(', ');
    const partnerAssets = [...(playersTo || []), ...(draftPicksTo || [])].join(', ');

    if (proposerAssets) {
      await logTransaction({
        type: 'TRADE',
        details: `Traded to ${toFull}: ${proposerAssets}`,
        fromTeam: fromFull, toTeam: toFull,
        coach: actorName, status: 'Pending',
        leagueId,
      });
    }
    if (partnerAssets) {
      await logTransaction({
        type: 'TRADE',
        details: `Traded to ${fromFull}: ${partnerAssets}`,
        fromTeam: toFull, toTeam: fromFull,
        coach: actorName, status: 'Pending',
        leagueId,
      });
    }

    revalidateTag('transactions', 'max');
    await logSystemEvent(actorName, fromTeam, 'TRADE', `${fromFull} ↔ ${toFull}`, leagueId);

    // Notify league
    const directions: Record<string, string[]> = {};
    if (proposerAssets) directions[`${fromFull} ➔ ${toFull}`] = (playersFrom || []).concat(draftPicksFrom || []);
    if (partnerAssets) directions[`${toFull} ➔ ${fromFull}`] = (playersTo || []).concat(draftPicksTo || []);
    if (Object.keys(directions).length > 0) {
      await notifyTransaction({ type: 'TRADE', directions, leagueId }).catch(e => console.error('Notify failed:', e));
    }

    return Response.json({ success: true });
  } catch (error: unknown) {
    console.error('Trade API Error:', error);
    return Response.json({ success: false, error: error instanceof Error ? error.message : 'Internal Server Error' }, { status: 500 });
  }
}
