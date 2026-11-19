import { db } from '@/lib/db';
import { players, teams, transactions, rules, tradeBlock } from '@/schema';
import { eq, and, isNull, inArray, sql } from 'drizzle-orm';
import { logTransaction, getTransactions, updateTransactionStatus, updateTransactionConditional, updateTransactionDetails } from '@/lib/transactions';
import { getLeagueId } from '@/lib/getLeagueId';
import { auth } from '@/auth';
import { isPrivileged } from '@/lib/auth';
import { notifyTransaction } from '@/lib/notify';
import { logSystemEvent } from '@/lib/db-helpers';
import { revalidateTag } from 'next/cache';
import { NextRequest } from 'next/server';
import { revertPickTransferByPickId } from '@/lib/draftPicks';
import { restoreIRFlags } from '@/lib/maintenance';
import { FA_DEADLINE_RULE, isFaDeadlinePassed, formatFaDeadlineET } from '@/lib/pickupRules';
import { IR_LIMIT_RULE, resolveIrLimit, isIrCapReached } from '@/lib/irRules';

export async function GET() {
  const session = await auth();
  if (!session?.user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

  try {
    const leagueId = await getLeagueId();
    const data = await getTransactions(leagueId);
    return Response.json(data.map(t => ({
      id: t.id,
      timestamp: t.date
        ? new Date(t.date).toLocaleString('en-US', { timeZone: 'America/New_York' })
        : '',
      type: t.type || '',
      details: t.description || '',
      fromFull: t.fromTeam || '',
      toFull: t.toTeam || '',
      coach: t.owner || '',
      status: t.status || '',
      weekBack: t.weekBack?.toString() || '',
      fee: t.fee ?? 0,
      season: t.season ?? null,
      pickIds: t.pickIds ?? null,
      conditionalDetails: t.conditionalDetails ?? null,
    })));
  } catch (error: unknown) {
    console.error('[Transactions GET]', error);
    return Response.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}

export async function PATCH(req: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user) return Response.json({ error: 'Unauthorized' }, { status: 401 });
    if (!(await isPrivileged())) {
      return Response.json({ error: 'Commissioner access required' }, { status: 403 });
    }

    const teamshort = (session.user as { id?: string }).id || '';
    const leagueId = await getLeagueId();

    const body = await req.json();
    const { id, status, conditionalDetails, details, weekBack, type, fromTeam, toTeam, fee } = body;
    if (!id) return Response.json({ error: 'id required' }, { status: 400 });

    if (conditionalDetails !== undefined) {
      if (typeof conditionalDetails === 'string' && conditionalDetails.length > 2000) {
        return Response.json({ error: 'Conditional details too long (max 2000 characters)' }, { status: 400 });
      }
      await updateTransactionConditional(Number(id), conditionalDetails || null, leagueId, teamshort || 'commissioner');
      revalidateTag('transactions', 'max');
      await logSystemEvent(session.user.name || 'Commissioner', teamshort, 'TRANSACTION_CONDITIONAL', `Transaction #${id} conditional details updated`, leagueId);
      return Response.json({ success: true });
    }

    if (details !== undefined || weekBack !== undefined || type !== undefined || fromTeam !== undefined || toTeam !== undefined || fee !== undefined) {
      const ALLOWED_TX_TYPES = ['ADD', 'DROP', 'TRADE', 'IR MOVE', 'INJURY PICKUP', 'CUT'];
      if (type !== undefined && (typeof type !== 'string' || !ALLOWED_TX_TYPES.includes(type))) {
        return Response.json({ error: `type must be one of: ${ALLOWED_TX_TYPES.join(', ')}` }, { status: 400 });
      }
      if (details !== undefined && (typeof details !== 'string' || !details.trim() || details.length > 500)) {
        return Response.json({ error: 'details must be a non-empty string ≤ 500 characters' }, { status: 400 });
      }
      let parsedWeekBack: number | null | undefined = undefined;
      if (weekBack !== undefined) {
        if (weekBack === null || weekBack === '') {
          parsedWeekBack = null;
        } else {
          // Strict integer check — parseInt alone would silently accept "12abc"
          if (!/^\d+$/.test(String(weekBack).trim())) {
            return Response.json({ error: 'weekBack must be a whole number between 0 and 30' }, { status: 400 });
          }
          const n = parseInt(String(weekBack), 10);
          if (n < 0 || n > 30) {
            return Response.json({ error: 'weekBack must be a number between 0 and 30' }, { status: 400 });
          }
          parsedWeekBack = n;
        }
      }
      // Optional ownership / fee overrides. Empty string = clear the field.
      let parsedFrom: string | null | undefined = undefined;
      if (fromTeam !== undefined) {
        const v = typeof fromTeam === 'string' ? fromTeam.trim() : null;
        if (v !== null && v.length > 256) {
          return Response.json({ error: 'fromTeam must be ≤ 256 characters' }, { status: 400 });
        }
        parsedFrom = v;
      }
      let parsedTo: string | null | undefined = undefined;
      if (toTeam !== undefined) {
        const v = typeof toTeam === 'string' ? toTeam.trim() : null;
        if (v !== null && v.length > 256) {
          return Response.json({ error: 'toTeam must be ≤ 256 characters' }, { status: 400 });
        }
        parsedTo = v;
      }
      let parsedFee: number | null | undefined = undefined;
      if (fee !== undefined) {
        if (fee === null || fee === '') {
          parsedFee = null;
        } else if (typeof fee !== 'number' || !Number.isInteger(fee) || fee < 0 || fee > 1000000) {
          return Response.json({ error: 'fee must be a whole number between 0 and 1,000,000' }, { status: 400 });
        } else {
          parsedFee = fee;
        }
      }
      await updateTransactionDetails(Number(id), { details: details?.trim(), weekBack: parsedWeekBack, type, fromTeam: parsedFrom, toTeam: parsedTo, fee: parsedFee }, leagueId, teamshort || 'commissioner');
      revalidateTag('transactions', 'max');
      await logSystemEvent(session.user.name || 'Commissioner', teamshort, 'TRANSACTION_EDIT', `Transaction #${id} updated`, leagueId);
      return Response.json({ success: true });
    }

    if (!status) return Response.json({ error: 'status, conditionalDetails, details, weekBack, or type required' }, { status: 400 });
    const validStatuses = ['Done', 'Pending', 'On Team'];
    if (!validStatuses.includes(status)) {
      return Response.json({ error: 'Invalid status value' }, { status: 400 });
    }

    await updateTransactionStatus(Number(id), status, leagueId, teamshort || 'commissioner');
    revalidateTag('transactions', 'max');
    await logSystemEvent(session.user.name || 'Commissioner', teamshort, 'TRANSACTION_STATUS', `Transaction #${id} marked ${status}`, leagueId);
    return Response.json({ success: true });
  } catch (error: unknown) {
    console.error('[Transactions PATCH]', error);
    return Response.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}

export async function DELETE(req: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user) return Response.json({ error: 'Unauthorized' }, { status: 401 });
    if (!(await isPrivileged())) {
      return Response.json({ error: 'Commissioner access required' }, { status: 403 });
    }

    const teamshort = (session.user as { id?: string }).id || '';
    const leagueId = await getLeagueId();

    const { id } = await req.json();
    if (!id) return Response.json({ error: 'id required' }, { status: 400 });

    // Revert any pick transfers associated with this transaction
    const txRow = await db.select({ pickIds: transactions.pickIds })
      .from(transactions)
      .where(and(eq(transactions.id, Number(id)), eq(transactions.leagueId, leagueId)))
      .limit(1);
    const pickIds = txRow[0]?.pickIds;
    if (pickIds?.length) {
      await Promise.all(pickIds.map(pickId => revertPickTransferByPickId(leagueId, pickId)));
      revalidateTag('draft-picks', 'max');
    }

    await db.delete(transactions).where(and(eq(transactions.id, Number(id)), eq(transactions.leagueId, leagueId)));
    revalidateTag('transactions', 'max');
    await logSystemEvent(session.user.name || 'Commissioner', teamshort, 'TRANSACTION_DELETE', `Transaction #${id} deleted${pickIds?.length ? ` (reverted ${pickIds.length} pick transfer(s))` : ''}`, leagueId);
    return Response.json({ success: true });
  } catch (error: unknown) {
    console.error('[Transactions DELETE]', error);
    return Response.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}

export async function POST(req: Request) {
  const session = await auth();
  if (!session?.user) return Response.json({ error: 'Unauthorized' }, { status: 401 });
  try {
    const body = await req.json();
    const { type, identity, toTeam, details, fromTeam } = body;

    const callerTeamshort = (session.user as { id?: string }).id || '';
    const privileged = await isPrivileged();
    const actorName = session.user.name || callerTeamshort || 'Commissioner';

    const leagueId = await getLeagueId();

    const ALLOWED_TYPES = ['ADD', 'INJURY PICKUP', 'DROP', 'WAIVE', 'IR', 'IR MOVE', 'CONDITIONAL TRADE'];
    if (!type || !ALLOWED_TYPES.includes(type)) {
      return Response.json({ error: 'Invalid transaction type' }, { status: 400 });
    }
    if (details !== undefined && (typeof details !== 'string' || details.length > 2000)) {
      return Response.json({ error: 'details must be a string ≤ 2000 characters' }, { status: 400 });
    }
    if (type === 'INJURY PICKUP' && (typeof details !== 'string' || !details.trim())) {
      return Response.json({ error: 'Injury pickup details are required.' }, { status: 400 });
    }

    let validatedWeekBack: number | undefined = undefined;
    const hasWeekBack = body.weekBack !== undefined && body.weekBack !== '' && body.weekBack !== null;
    if (type === 'INJURY PICKUP') {
      const rawWb = hasWeekBack && (typeof body.weekBack === 'string' || typeof body.weekBack === 'number')
        ? String(body.weekBack).trim()
        : '';
      const n = /^\d+$/.test(rawWb) ? parseInt(rawWb, 10) : NaN;
      if (!Number.isInteger(n) || n < 1 || n > 30) {
        return Response.json(
          { error: 'Injury pickup requires a valid return week between 1 and 30.' },
          { status: 400 },
        );
      }
      validatedWeekBack = n;
    } else if (hasWeekBack) {
      const rawWb = typeof body.weekBack === 'string' || typeof body.weekBack === 'number'
        ? String(body.weekBack).trim()
        : '';
      const n = /^\d+$/.test(rawWb) ? parseInt(rawWb, 10) : NaN;
      if (!Number.isInteger(n) || n < 0 || n > 30) {
        return Response.json(
          { error: 'weekBack must be a whole number between 0 and 30.' },
          { status: 400 },
        );
      }
      validatedWeekBack = n;
    }

    // CONDITIONAL TRADE is a record-keeping entry only — no player moves, no
    // team-id update, no trade-block cleanup. The standard player-lookup path
    // 404s for this type because the request body has no `identity`. Branch
    // early so the audit/transaction row gets written.
    if (type === 'CONDITIONAL TRADE') {
      if (!details || typeof details !== 'string' || !details.trim()) {
        return Response.json({ error: 'Conditional trade details required' }, { status: 400 });
      }
      if (details.length > 2000) {
        return Response.json({ error: 'Conditional trade details too long (max 2000 characters)' }, { status: 400 });
      }
      if (!fromTeam || !toTeam) {
        return Response.json({ error: 'fromTeam and toTeam required' }, { status: 400 });
      }
      if (typeof fromTeam !== 'string' || typeof toTeam !== 'string' || fromTeam.length > 100 || toTeam.length > 100) {
        return Response.json({ error: 'fromTeam/toTeam must be strings ≤ 100 chars' }, { status: 400 });
      }
      const seasonRule = await db.select({ value: rules.value }).from(rules)
        .where(and(eq(rules.leagueId, leagueId), eq(rules.rule, 'cuts_year'), isNull(rules.year))).limit(1);
      const seasonNum = seasonRule[0] ? parseInt(seasonRule[0].value) : NaN;
      const season = Number.isFinite(seasonNum) ? seasonNum : undefined;
      await logTransaction({ type, details, fromTeam, toTeam, coach: actorName, leagueId, season });
      revalidateTag('transactions', 'max');
      await logSystemEvent(actorName, fromTeam, 'CONDITIONAL_TRADE', `${fromTeam} → ${toTeam}: ${details.slice(0, 240)}`, leagueId);
      // Send notification so coaches see the conditional in their inbox /
      // WhatsApp the same way they'd see a regular trade. The details string
      // (capped at 2000 chars above) is the asset/condition description.
      const directionKey = `${fromTeam} ➔ ${toTeam}`;
      await notifyTransaction({
        type,
        directions: { [directionKey]: [details] },
        leagueId,
      }).catch(e => console.error('Conditional trade notify failed:', e));
      return Response.json({ success: true });
    }

    // Find player by identity (required for all non-CONDITIONAL types) alongside global rules
    if (!identity) {
      return Response.json({ error: 'identity required' }, { status: 400 });
    }
    const [playerRows, globalRuleRows] = await Promise.all([
      db.select({
        id: players.id,
        identity: players.identity,
        teamId: players.teamId,
        teamshort: teams.teamshort,
        teamName: teams.name,
        durability: players.durability,
        isIR: players.isIR,
      })
      .from(players)
      .leftJoin(teams, eq(players.teamId, teams.id))
      .where(and(eq(players.identity, identity), eq(players.leagueId, leagueId)))
      .limit(1),
      db.select({ rule: rules.rule, value: rules.value })
        .from(rules)
        .where(and(
          eq(rules.leagueId, leagueId),
          isNull(rules.year),
          inArray(rules.rule, [FA_DEADLINE_RULE, IR_LIMIT_RULE, 'cuts_year', 'current_nfl_week']),
        )),
    ]);

    if (!playerRows[0]) return Response.json({ error: 'Player not found' }, { status: 404 });
    const player = playerRows[0];
    const globalRulesMap = new Map(globalRuleRows.map(r => [r.rule, r.value]));

    // Resolve new team ownership
    let newTeamId: number | null = player.teamId ?? null;
    let resolvedToTeamshort: string | null = null;
    const resolvedFromTeam = fromTeam || player.teamName || player.teamshort || '';

    if (type === 'ADD' || type === 'INJURY PICKUP') {
      const toTeamRow = await db.select({ id: teams.id, teamshort: teams.teamshort })
        .from(teams)
        .where(and(eq(teams.leagueId, leagueId), eq(teams.name, toTeam)))
        .limit(1);
      // Also try by teamshort if name didn't match
      if (!toTeamRow[0]) {
        const byShort = await db.select({ id: teams.id, teamshort: teams.teamshort })
          .from(teams)
          .where(and(eq(teams.leagueId, leagueId), eq(teams.teamshort, (toTeam || '').toUpperCase())))
          .limit(1);
        newTeamId = byShort[0]?.id ?? null;
        resolvedToTeamshort = byShort[0]?.teamshort ?? null;
      } else {
        newTeamId = toTeamRow[0].id;
        resolvedToTeamshort = toTeamRow[0].teamshort ?? null;
      }
    }

    // Ownership check: coaches can only transact their own players.
    // Compare callerTeamshort against the resolved teamshort of the target
    // team (not the raw toTeam string, which may be a full name).
    if (!privileged) {
      if ((type === 'ADD' || type === 'INJURY PICKUP') &&
          callerTeamshort.toLowerCase() !== (resolvedToTeamshort || '').toLowerCase()) {
        return Response.json({ error: 'Forbidden: you can only add players to your own team' }, { status: 403 });
      }
      // Player must be a free agent — prevents stealing a rostered player
      if ((type === 'ADD' || type === 'INJURY PICKUP') && player.teamId !== null) {
        return Response.json({ error: 'Forbidden: player is already on a roster' }, { status: 403 });
      }
      if (['DROP', 'WAIVE', 'IR', 'IR MOVE'].includes(type) &&
          callerTeamshort.toLowerCase() !== (player.teamshort || '').toLowerCase()) {
        return Response.json({ error: 'Forbidden: you can only drop or IR your own players' }, { status: 403 });
      }
      if (type === 'ADD') {
        const rawDeadline = globalRulesMap.get(FA_DEADLINE_RULE);
        if (isFaDeadlinePassed(rawDeadline)) {
          const formatted = formatFaDeadlineET(rawDeadline);
          return Response.json({
            error: `Free agent pickups closed after the deadline${formatted ? ` (${formatted})` : ''}. Use Injury Pickup for injury replacements.`,
          }, { status: 403 });
        }
      }
    }

    // IR restriction: cannot place a free agent or already-IR player on IR;
    // during draft season, only players who haven't played any NFL games
    // (durability = 0) may be placed on IR.
    if (type === 'IR' || type === 'IR MOVE') {
      if (player.teamId === null) {
        return Response.json({
          error: 'Cannot place a free agent on Injured Reserve (IR).',
        }, { status: 400 });
      }
      if (player.isIR) {
        return Response.json({
          error: 'Player is already on Injured Reserve (IR).',
        }, { status: 400 });
      }
      const currentNflWeek = parseInt(globalRulesMap.get('current_nfl_week') ?? '0') || 0;
      if (currentNflWeek === 0 && Number(player.durability ?? 0) !== 0) {
        return Response.json({
          error: 'During the draft, only players who have not played any NFL games (durability 0) can be placed on IR.',
        }, { status: 400 });
      }
    }

    const irLimit = resolveIrLimit(leagueId, globalRulesMap.get(IR_LIMIT_RULE));
    let irOverrideNote = '';

    // Resolve current season from rules
    const seasonRaw = globalRulesMap.get('cuts_year');
    const season = seasonRaw ? parseInt(seasonRaw) || null : null;

    // Atomically execute roster update, trade block cleanup, and transaction logging
    await db.transaction(async (tx) => {
      if (type === 'DROP' || type === 'WAIVE') {
        newTeamId = null; // FA
        if (player.isIR) {
          await tx.update(players).set({ isIR: false, touch_id: 'transaction', touch_dt: new Date() })
            .where(and(eq(players.id, player.id), eq(players.leagueId, leagueId)));
        }
      } else if (type === 'IR' || type === 'IR MOVE') {
        // Lock the team's row to serialize concurrent IR placements for that team
        await tx.select({ id: teams.id })
          .from(teams)
          .where(and(eq(teams.id, player.teamId!), eq(teams.leagueId, leagueId)))
          .for('update');

        const [freshPlayer, irCountRows] = await Promise.all([
          tx.select({ isIR: players.isIR })
            .from(players)
            .where(and(eq(players.id, player.id), eq(players.leagueId, leagueId)))
            .limit(1),
          tx.select({ count: sql<number>`cast(count(*) as int)` })
            .from(players)
            .where(and(
              eq(players.leagueId, leagueId),
              eq(players.teamId, player.teamId!),
              eq(players.isIR, true),
            )),
        ]);

        if (freshPlayer[0]?.isIR) {
          throw Object.assign(new Error('Player is already on Injured Reserve (IR).'), { status: 400 });
        }

        const currentIrCount = Number(irCountRows[0]?.count ?? 0);
        if (isIrCapReached(currentIrCount, irLimit)) {
          if (!privileged) {
            throw Object.assign(
              new Error(`Injured Reserve limit reached (${currentIrCount}/${irLimit}). Maximum ${irLimit} players allowed on IR per team.`),
              { status: 403 },
            );
          }
          irOverrideNote = ` [Commissioner IR cap override: ${currentIrCount + 1}/${irLimit}]`;
        }

        newTeamId = player.teamId ?? null; // stays on same team, isIR flag would be set
        await tx.update(players).set({ isIR: true, touch_id: 'transaction', touch_dt: new Date() })
          .where(and(eq(players.id, player.id), eq(players.leagueId, leagueId)));
      }

      if (type !== 'IR' && type !== 'IR MOVE') {
        await tx.update(players)
          .set({ teamId: newTeamId, touch_id: 'transaction', touch_dt: new Date() })
          .where(and(eq(players.id, player.id), eq(players.leagueId, leagueId)));
      }

      // Remove from trade block if present. tradeBlock.playerId stores the
      // player identity string (first|last|age|...), NOT the numeric PK.
      if (player.identity) {
        await tx.delete(tradeBlock)
          .where(and(eq(tradeBlock.playerId, player.identity), eq(tradeBlock.leagueId, leagueId)));
      }

      await logTransaction({
        type,
        details,
        fromTeam: resolvedFromTeam,
        toTeam,
        coach: actorName,
        weekBack: validatedWeekBack,
        leagueId,
        season: season ?? undefined,
      }, tx);
    });
    revalidateTag('transactions', 'max');
    revalidateTag('players', 'max');
    revalidateTag('trade-block', 'max'); // player may have been delisted above
    await logSystemEvent(actorName, resolvedFromTeam, type, `${details || identity}${irOverrideNote}`, leagueId);

    if (type === 'IR' || type === 'IR MOVE') {
      await restoreIRFlags(leagueId);
    }

    // Send notification
    const directionKey = `${resolvedFromTeam} ➔ ${toTeam || 'Free Agent'}`;
    await notifyTransaction({
      type,
      directions: { [directionKey]: [details || identity] },
      leagueId,
    }).catch(e => console.error('Notify failed:', e));

    return Response.json({ success: true });
  } catch (err: unknown) {
    const errStatus = typeof (err as { status?: unknown })?.status === 'number'
      ? (err as { status: number }).status
      : null;
    if (errStatus === 400 || errStatus === 403) {
      return Response.json(
        { error: err instanceof Error ? err.message : 'Request rejected' },
        { status: errStatus },
      );
    }
    console.error('[Transactions POST]', err);
    return Response.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}
