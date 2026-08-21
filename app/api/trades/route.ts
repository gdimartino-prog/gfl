import { db } from '@/lib/db';
import { teams, players, draftPicks } from '@/schema';
import { eq, and, sql, inArray } from 'drizzle-orm';
import { logTransaction } from '@/lib/transactions';
import { upsertPickTransfer } from '@/lib/draftPicks';
import { notifyTransaction } from '@/lib/notify';
import { auth } from '@/auth';
import { isPrivileged } from '@/lib/auth';
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
      rawIdentitiesFrom, rawIdentitiesTo,
    } = body;

    const callerTeamshort = (session.user as { id?: string }).id || '';
    const privileged = await isPrivileged();

    // Coaches can only submit trades involving their own team
    if (!privileged && callerTeamshort.toUpperCase() !== (fromTeam || '').toUpperCase()) {
      return Response.json({ message: 'Forbidden: you can only submit trades for your own team.' }, { status: 403 });
    }

    // Resolve team IDs for pick transfers
    const [fromTeamRow, toTeamRow] = await Promise.all([
      db.select({ id: teams.id }).from(teams)
        .where(and(eq(teams.leagueId, leagueId), sql`lower(${teams.teamshort}) = lower(${fromTeam})`)).limit(1),
      db.select({ id: teams.id }).from(teams)
        .where(and(eq(teams.leagueId, leagueId), sql`lower(${teams.teamshort}) = lower(${toTeam})`)).limit(1),
    ]);

    const fromTeamId = fromTeamRow[0]?.id;
    const toTeamId = toTeamRow[0]?.id;

    // Both teams must resolve — a nonexistent toTeam would otherwise skip
    // the ownership block below while the player moves still execute
    // (fail-open: a coach could move arbitrary players onto their roster).
    if (!fromTeamId || !toTeamId) {
      return Response.json({ message: 'One or both teams not found in this league.' }, { status: 404 });
    }

    // Verify asset ownership before moving anything — prevents a coach from
    // including players or picks they don't own in a trade submission.
    // Privileged users (admin/commissioner) are exempt to allow corrections.
    if (!privileged) {
      if (Array.isArray(rawIdentitiesFrom) && rawIdentitiesFrom.length > 0) {
        const owned = await db.select({ identity: players.identity }).from(players)
          .where(and(eq(players.leagueId, leagueId), eq(players.teamId, fromTeamId), inArray(players.identity, rawIdentitiesFrom as string[])));
        if (owned.length !== rawIdentitiesFrom.length) {
          return Response.json({ message: 'One or more players do not belong to the sending team.' }, { status: 403 });
        }
      }
      if (Array.isArray(rawIdentitiesTo) && rawIdentitiesTo.length > 0) {
        const owned = await db.select({ identity: players.identity }).from(players)
          .where(and(eq(players.leagueId, leagueId), eq(players.teamId, toTeamId), inArray(players.identity, rawIdentitiesTo as string[])));
        if (owned.length !== rawIdentitiesTo.length) {
          return Response.json({ message: 'One or more players do not belong to the sending team.' }, { status: 403 });
        }
      }
      if (rawPicksFrom?.length) {
        const ids = (rawPicksFrom as string[]).map(Number);
        const owned = await db.select({ id: draftPicks.id }).from(draftPicks)
          .where(and(eq(draftPicks.leagueId, leagueId), eq(draftPicks.currentTeamId, fromTeamId), inArray(draftPicks.id, ids)));
        if (owned.length !== ids.length) {
          return Response.json({ message: 'One or more picks do not belong to the sending team.' }, { status: 403 });
        }
      }
      if (rawPicksTo?.length) {
        const ids = (rawPicksTo as string[]).map(Number);
        const owned = await db.select({ id: draftPicks.id }).from(draftPicks)
          .where(and(eq(draftPicks.leagueId, leagueId), eq(draftPicks.currentTeamId, toTeamId), inArray(draftPicks.id, ids)));
        if (owned.length !== ids.length) {
          return Response.json({ message: 'One or more picks do not belong to the sending team.' }, { status: 403 });
        }
      }
    }

    // Execute draft pick transfers immediately — picks are managed in the web app
    const transferUpserts: Promise<void>[] = [];
    if (rawPicksFrom?.length && fromTeamId && toTeamId) {
      for (const id of rawPicksFrom as string[]) {
        transferUpserts.push(upsertPickTransfer({
          leagueId,
          pickId: parseInt(id),
          toTeamId,
          touchId: callerTeamshort || 'trade',
        }));
      }
    }
    if (rawPicksTo?.length && fromTeamId && toTeamId) {
      for (const id of rawPicksTo as string[]) {
        transferUpserts.push(upsertPickTransfer({
          leagueId,
          pickId: parseInt(id),
          toTeamId: fromTeamId,
          touchId: callerTeamshort || 'trade',
        }));
      }
    }
    await Promise.all(transferUpserts);

    // TRUST MODEL (intentional, same philosophy as the permissive late-pick
    // auth on /api/draft-selection): trades are agreed between coaches
    // offline, then one coach enters them, and assets move immediately with
    // no in-app acceptance step. Guardrails are the audit log, the
    // league-wide transaction notification both parties receive, and
    // commissioner undo. Reverting a disputed trade requires the
    // commissioner to manually correct rosters (or re-sync from the Action
    // game file).
    const touchId = callerTeamshort || 'trade';
    const playerMoves: Promise<unknown>[] = [];
    if (Array.isArray(rawIdentitiesFrom) && rawIdentitiesFrom.length > 0 && toTeamId) {
      playerMoves.push(
        db.update(players)
          .set({ teamId: toTeamId, touch_id: touchId })
          .where(and(
            eq(players.leagueId, leagueId),
            inArray(players.identity, rawIdentitiesFrom as string[]),
          ))
      );
    }
    if (Array.isArray(rawIdentitiesTo) && rawIdentitiesTo.length > 0 && fromTeamId) {
      playerMoves.push(
        db.update(players)
          .set({ teamId: fromTeamId, touch_id: touchId })
          .where(and(
            eq(players.leagueId, leagueId),
            inArray(players.identity, rawIdentitiesTo as string[]),
          ))
      );
    }
    await Promise.all(playerMoves);

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
        pickIds: rawPicksFrom?.length ? (rawPicksFrom as string[]).map(Number) : undefined,
      });
    }
    if (partnerAssets) {
      await logTransaction({
        type: 'TRADE',
        details: `Traded to ${fromFull}: ${partnerAssets}`,
        fromTeam: toFull, toTeam: fromFull,
        coach: actorName, status: 'Pending',
        leagueId,
        pickIds: rawPicksTo?.length ? (rawPicksTo as string[]).map(Number) : undefined,
      });
    }

    revalidateTag('transactions', 'max');
    revalidateTag('draft-picks', 'max');
    revalidateTag('players', 'max');
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
    return Response.json({ success: false, error: 'Internal Server Error' }, { status: 500 });
  }
}
