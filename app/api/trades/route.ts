import { db } from '@/lib/db';
import { players, draftPicks, teams } from '@/schema';
import { eq, and } from 'drizzle-orm';
import { logTransaction } from '@/lib/transactions';
import { upsertPickTransfer } from '@/lib/draftPicks';
import { notifyTransaction } from '@/lib/notify';
import { auth } from '@/auth';
import { isAdmin, isCommissioner } from '@/lib/auth';
import { getLeagueId } from '@/lib/getLeagueId';

export async function POST(req: Request) {
  const session = await auth();
  if (!session?.user) return Response.json({ message: 'Unauthorized' }, { status: 401 });
  const authorized = await isAdmin() || await isCommissioner();
  if (!authorized) {
    return Response.json({ message: 'Unauthorized: Admin access required to process trades.' }, { status: 403 });
  }

  try {
    const leagueId = await getLeagueId();
    const body = await req.json();
    const {
      fromTeam, toTeam, fromFull, toFull, submittedBy,
      playersFrom, playersTo, rawIdentitiesFrom, rawIdentitiesTo,
      draftPicksFrom, draftPicksTo, rawPicksFrom, rawPicksTo, status,
    } = body;

    // Resolve team IDs
    const [fromTeamRow, toTeamRow] = await Promise.all([
      db.select({ id: teams.id }).from(teams)
        .where(and(eq(teams.leagueId, leagueId), eq(teams.teamshort, fromTeam))).limit(1),
      db.select({ id: teams.id }).from(teams)
        .where(and(eq(teams.leagueId, leagueId), eq(teams.teamshort, toTeam))).limit(1),
    ]);

    const fromTeamId = fromTeamRow[0]?.id;
    const toTeamId = toTeamRow[0]?.id;

    const updates: Promise<unknown>[] = [];

    // Move proposer's players → partner
    if (rawIdentitiesFrom?.length && toTeamId) {
      for (const identity of rawIdentitiesFrom as string[]) {
        updates.push(
          db.update(players)
            .set({ teamId: toTeamId, touch_id: submittedBy || 'trade' })
            .where(and(eq(players.identity, identity), eq(players.leagueId, leagueId)))
        );
      }
    }

    // Move partner's players → proposer
    if (rawIdentitiesTo?.length && fromTeamId) {
      for (const identity of rawIdentitiesTo as string[]) {
        updates.push(
          db.update(players)
            .set({ teamId: fromTeamId, touch_id: submittedBy || 'trade' })
            .where(and(eq(players.identity, identity), eq(players.leagueId, leagueId)))
        );
      }
    }

    // Move proposer's picks → partner
    if (rawPicksFrom?.length && toTeamId) {
      for (const overall of rawPicksFrom as string[]) {
        updates.push(
          db.update(draftPicks)
            .set({ currentTeamId: toTeamId, touch_id: submittedBy || 'trade' })
            .where(and(eq(draftPicks.pick, parseInt(overall)), eq(draftPicks.leagueId, leagueId)))
        );
      }
    }

    // Move partner's picks → proposer
    if (rawPicksTo?.length && fromTeamId) {
      for (const overall of rawPicksTo as string[]) {
        updates.push(
          db.update(draftPicks)
            .set({ currentTeamId: fromTeamId, touch_id: submittedBy || 'trade' })
            .where(and(eq(draftPicks.pick, parseInt(overall)), eq(draftPicks.leagueId, leagueId)))
        );
      }
    }

    await Promise.all(updates);

    // Record pick transfers so ownership survives draft regeneration
    const transferUpserts: Promise<void>[] = [];
    if (rawPicksFrom?.length && fromTeamId && toTeamId) {
      for (const overall of rawPicksFrom as string[]) {
        transferUpserts.push(upsertPickTransfer({
          leagueId,
          pickOverall: parseInt(overall),
          toTeamId,
          touchId: submittedBy || 'trade',
        }));
      }
    }
    if (rawPicksTo?.length && fromTeamId && toTeamId) {
      for (const overall of rawPicksTo as string[]) {
        transferUpserts.push(upsertPickTransfer({
          leagueId,
          pickOverall: parseInt(overall),
          toTeamId: fromTeamId,
          touchId: submittedBy || 'trade',
        }));
      }
    }
    await Promise.all(transferUpserts);

    // Log transactions
    const proposerAssets = [...(playersFrom || []), ...(draftPicksFrom || [])].join(', ');
    const partnerAssets = [...(playersTo || []), ...(draftPicksTo || [])].join(', ');

    if (proposerAssets) {
      await logTransaction({
        type: 'TRADE',
        details: `Traded to ${toFull}: ${proposerAssets}`,
        fromTeam: fromFull, toTeam: toFull,
        coach: submittedBy, status: status || 'COMPLETED',
        leagueId,
      });
    }
    if (partnerAssets) {
      await logTransaction({
        type: 'TRADE',
        details: `Traded to ${fromFull}: ${partnerAssets}`,
        fromTeam: toFull, toTeam: fromFull,
        coach: submittedBy, status: status || 'COMPLETED',
        leagueId,
      });
    }

    // Notify
    const directions: Record<string, string[]> = {};
    if (proposerAssets) directions[`${fromFull} ➔ ${toFull}`] = (playersFrom || []).concat(draftPicksFrom || []);
    if (partnerAssets) directions[`${toFull} ➔ ${fromFull}`] = (playersTo || []).concat(draftPicksTo || []);
    if (Object.keys(directions).length > 0) {
      await notifyTransaction({ type: 'TRADE', directions }).catch(e => console.error('Notify failed:', e));
    }

    return Response.json({ success: true });
  } catch (error: unknown) {
    console.error('Trade API Error:', error);
    return Response.json({ success: false, error: error instanceof Error ? error.message : 'Internal Server Error' }, { status: 500 });
  }
}
