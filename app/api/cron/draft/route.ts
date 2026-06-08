import { NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { draftPicks, teams, rules } from '@/schema';
import { eq, and, asc, isNull } from 'drizzle-orm';
import { notifyDraftPick, notifyDraftComplete } from '@/lib/notify';
import { alias } from 'drizzle-orm/pg-core';
import { getDraftClockMinutes, getWarningThresholdMinutes, getDraftStartDate, computePickTimings } from '@/lib/draftClock';

function isAuthorized(req: Request) {
  const auth = req.headers.get('authorization');
  return auth === `Bearer ${process.env.CRON_SECRET}`;
}

export async function GET(req: Request) {
  if (!isAuthorized(req)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    // Get all leagues that have a draft_year configured
    const draftYearRules = await db
      .select({ leagueId: rules.leagueId, value: rules.value })
      .from(rules)
      .where(and(eq(rules.rule, 'draft_year'), isNull(rules.year)));

    const results = [];

    for (const draftYearRule of draftYearRules) {
      const leagueId = draftYearRule.leagueId;
      if (!leagueId) continue;
      const draftYear = parseInt(draftYearRule.value || '0');
      if (!draftYear) continue;
      if (draftYear > new Date().getFullYear()) {
        results.push({ leagueId, skipped: `draft_year ${draftYear} is in the future` });
        continue;
      }

      // Fast-skip checks BEFORE the heavy picks query, in parallel:
      //   1. draft_complete_<year> marker — set once when draft finishes
      //   2. draft_start_date rule — if absent, the league hasn't set up a
      //      draft, so no clock work is possible. Previously this was checked
      //      AFTER loading all picks, costing ~150ms/tick per misconfigured
      //      league (e.g. AFL with 540 picks + joins for nothing).
      const completeRuleKey = `draft_complete_${draftYear}`;
      const [completeRow, draftStartDate] = await Promise.all([
        db.select({ value: rules.value })
          .from(rules)
          .where(and(eq(rules.leagueId, leagueId), eq(rules.rule, completeRuleKey), isNull(rules.year)))
          .limit(1),
        getDraftStartDate(leagueId),
      ]);
      if (completeRow[0]?.value === '1') {
        results.push({ leagueId, skipped: 'draft already complete' });
        continue;
      }
      if (!draftStartDate) {
        results.push({ leagueId, skipped: 'draft_start_date not configured' });
        continue;
      }

      const originalTeams = alias(teams, 'originalTeams');
      const currentTeams = alias(teams, 'currentTeams');

      const allPicks = await db.select({
        id: draftPicks.id,
        round: draftPicks.round,
        pick: draftPicks.pick,
        currentTeamId: draftPicks.currentTeamId,
        playerId: draftPicks.playerId,
        passed: draftPicks.passed,
        selectedPlayerName: draftPicks.selectedPlayerName,
        scheduledAt: draftPicks.scheduledAt,
        pickedAt: draftPicks.pickedAt,
        warningSent: draftPicks.warningSent,
        currentOwner: currentTeams.name,
        originalTeam: originalTeams.name,
      })
      .from(draftPicks)
      .leftJoin(originalTeams, eq(draftPicks.originalTeamId, originalTeams.id))
      .leftJoin(currentTeams, eq(draftPicks.currentTeamId, currentTeams.id))
      .where(and(eq(draftPicks.leagueId, leagueId), eq(draftPicks.year, draftYear)))
      .orderBy(asc(draftPicks.pick));

      // Active pick: first pick with no player, no pickedAt, and not passed
      const activeIdx = allPicks.findIndex(p => !p.playerId && !p.pickedAt && !p.passed);
      if (activeIdx === -1) {
        // All picks are resolved (skipped or passed). Wait 24 hours since the
        // last real player selection before declaring the draft complete —
        // gives coaches time to submit late selections for open skipped picks.
        const draftStarted = allPicks.some(p => !!p.pickedAt);
        if (!draftStarted) {
          results.push({ leagueId, skipped: 'draft not started (no picks yet)' });
          continue;
        }
        const lastRealPick = allPicks
          .filter(p => !!p.playerId && !!p.pickedAt)
          .sort((a, b) => new Date(b.pickedAt!).getTime() - new Date(a.pickedAt!).getTime())[0];
        const now24 = new Date();
        const msSinceLastPick = lastRealPick?.pickedAt
          ? now24.getTime() - new Date(lastRealPick.pickedAt).getTime()
          : Infinity;
        if (msSinceLastPick <= 24 * 60 * 60 * 1000) {
          const hoursRemaining = ((24 * 60 * 60 * 1000 - msSinceLastPick) / 3600000).toFixed(1);
          results.push({ leagueId, action: 'none', waitingForClose: true, hoursRemaining });
          continue;
        }
        // 24h have passed since the last real pick — mark the draft complete.
        await db.insert(rules)
          .values({
            leagueId,
            rule: completeRuleKey,
            value: '1',
            desc: `Draft year ${draftYear} marked complete by cron at ${now24.toISOString()}`,
          })
          .onConflictDoNothing();
        try {
          await notifyDraftComplete({ leagueId, draftYear, totalPicks: allPicks.length });
        } catch (e) {
          console.error('[cron/draft] notifyDraftComplete failed (rule still written, will not re-fire):', e);
        }
        results.push({ leagueId, action: 'draft_complete', totalPicks: allPicks.length });
        continue;
      }

      const activePick = allPicks[activeIdx];

      // draftStartDate was already loaded above and is known non-null here.
      const now = new Date();
      if (now < draftStartDate) {
        results.push({ leagueId, skipped: 'before draft start date', draftStartDate });
        continue;
      }

      // If the pick has a scheduled start time that hasn't arrived yet, skip
      if (activePick.scheduledAt && new Date(activePick.scheduledAt) > now) {
        results.push({ leagueId, skipped: 'pick not yet scheduled', scheduledAt: activePick.scheduledAt });
        continue;
      }

      // FAST PATH: most ticks fire no action. computePickTimings + strikes
      // computation runs over all draft picks (~450 rows for GFL) and
      // dominates per-tick CPU. We can safely skip both when:
      //   1. We can determine cheaply that no warning/expiration will fire
      //      this tick (deadline far enough away, warningSent state ok)
      //   2. The active pick hasn't changed since last tick — meaning no
      //      strike state has changed and the 3-strike check we did on the
      //      last transition is still valid
      const prevPick = activeIdx > 0 ? allPicks[activeIdx - 1] : null;
      const rawClockStart = prevPick?.pickedAt
        ? new Date(prevPick.pickedAt)
        : activePick.scheduledAt ? new Date(activePick.scheduledAt) : null;
      if (!rawClockStart) {
        results.push({ leagueId, skipped: 'no clock start time' });
        continue;
      }
      const cheapClockStart = rawClockStart < draftStartDate ? draftStartDate : rawClockStart;
      const cheapClockMinutes = await getDraftClockMinutes(leagueId, activePick.round);
      const cheapWarningMinutes = getWarningThresholdMinutes(cheapClockMinutes);
      const cheapDeadlineMs = cheapClockStart.getTime() + cheapClockMinutes * 60 * 1000;
      const cheapDiffMs = cheapDeadlineMs - now.getTime();
      const cheapDiffMinutes = cheapDiffMs / 60000;

      // Track the last active pick id we ran the full path on, per draft year
      const lastIdRuleKey = `cron_last_active_pick_${draftYear}`;
      const lastIdRow = await db
        .select({ id: rules.id, value: rules.value })
        .from(rules)
        .where(and(eq(rules.leagueId, leagueId), eq(rules.rule, lastIdRuleKey), isNull(rules.year)))
        .limit(1);
      const lastSeenPickId = lastIdRow[0]?.value ? parseInt(lastIdRow[0].value) : null;
      const activePickTransition = lastSeenPickId !== activePick.id;

      const wontExpireThisTick = cheapDiffMs > 0;
      // The cheap deadline uses prevPick.pickedAt directly, which can be a few
      // minutes off when prevPick was selected late (the accurate deadline math
      // would use prevPick's own deadline as clockStart). A 30-minute buffer
      // over the warning threshold means we only fast-path when the deadline
      // is clearly far away — preserving correctness around late picks at the
      // cost of running the full path for the last ~30 min before warning.
      const wontWarnThisTick = activePick.warningSent || cheapDiffMinutes > cheapWarningMinutes + 30;

      if (wontExpireThisTick && wontWarnThisTick && !activePickTransition) {
        results.push({ leagueId, action: 'none', minutesRemaining: cheapDiffMinutes.toFixed(1), fast: true });
        continue;
      }

      // FULL PATH: persist the active pick id on each transition so subsequent
      // ticks on the same pick can take the fast path above.
      if (activePickTransition) {
        if (lastIdRow[0]) {
          await db.update(rules).set({ value: String(activePick.id) }).where(eq(rules.id, lastIdRow[0].id));
        } else {
          await db.insert(rules).values({ leagueId, rule: lastIdRuleKey, value: String(activePick.id) });
        }
      }

      const timings = await computePickTimings(
        allPicks.map(p => ({
          id: p.id, round: p.round, pick: p.pick,
          scheduledAt: p.scheduledAt ? new Date(p.scheduledAt) : null,
          pickedAt: p.pickedAt ? new Date(p.pickedAt) : null,
        })),
        leagueId,
        draftStartDate,
      );
      const activeTiming = timings.get(activePick.id);
      if (!activeTiming) {
        results.push({ leagueId, skipped: 'no clock start time' });
        continue;
      }
      const clockMinutes = await getDraftClockMinutes(leagueId, activePick.round);
      const warningMinutes = getWarningThresholdMinutes(clockMinutes);
      const expiryTime = activeTiming.deadline;
      const diffMs = expiryTime.getTime() - now.getTime();
      const diffMinutes = diffMs / (1000 * 60);

      const recentPicks = allPicks
        .slice(Math.max(0, activeIdx - 5), activeIdx)
        .reverse()
        .map(p => ({ round: p.round, pick: p.pick, player: p.selectedPlayerName || 'Skipped', owner: p.currentOwner || '' }));

      // Pre-compute strikes per team for this draft year — used for both the
      // active team's 3-strike check AND each on-deck team's heads-up in the
      // notification (so coaches see "⚠ 3 strikes — auto-skip when up" next
      // to a team about to be force-skipped).
      const strikesByTeamId = new Map<number, number>();
      for (const p of allPicks) {
        if (p.currentTeamId == null) continue;
        // Consequence-skips don't count as strikes — only true time expirations do.
        const isSkippedRow = p.selectedPlayerName === 'SKIPPED (Time Expired)';
        const wasLate = timings.get(p.id)?.wasLate ?? false;
        if (isSkippedRow || wasLate) {
          strikesByTeamId.set(p.currentTeamId, (strikesByTeamId.get(p.currentTeamId) ?? 0) + 1);
        }
      }

      const onDeck = allPicks
        .slice(activeIdx + 1, activeIdx + 4)
        .filter(p => !p.playerId && !p.passed)
        .map(p => ({
          round: p.round,
          pick: p.pick,
          owner: p.currentOwner || '',
          originalOwner: p.originalTeam || '',
          strikes: p.currentTeamId != null ? (strikesByTeamId.get(p.currentTeamId) ?? 0) : 0,
        }));

      // Picks that were auto-skipped and still have no player attached —
      // coaches can still submit a late selection for any of these. Surfaced
      // in every notification so coaches see open opportunities.
      const skippedOpen = allPicks
        .filter(p => typeof p.selectedPlayerName === 'string' && p.selectedPlayerName.startsWith('SKIPPED') && !p.playerId)
        .map(p => ({
          round: p.round,
          pick: p.pick,
          owner: p.currentOwner || '',
          skippedAt: p.pickedAt ? new Date(p.pickedAt) : null,
        }));

      // 3-strike rule: if this team has had time expire 3+ times earlier in
      // this draft year (auto-skip OR late submission), immediately skip
      // without waiting for the clock. Subtract 1 if the active pick itself
      // was already counted (e.g. mid-pick state shouldn't count itself).
      const activeIsCountedAsStrike = activePick.currentTeamId != null && (() => {
        const isSkippedRow = typeof activePick.selectedPlayerName === 'string' && activePick.selectedPlayerName.startsWith('SKIPPED');
        const wasLate = timings.get(activePick.id)?.wasLate ?? false;
        return isSkippedRow || wasLate;
      })();
      const teamStrikes = activePick.currentTeamId == null
        ? 0
        : (strikesByTeamId.get(activePick.currentTeamId) ?? 0) - (activeIsCountedAsStrike ? 1 : 0);

      if (teamStrikes >= 3) {
        await db.update(draftPicks)
          .set({ selectedPlayerName: 'SKIPPED (3-strike rule)', pickedAt: now, touch_id: 'cron-3strike' })
          .where(eq(draftPicks.id, activePick.id));

        await notifyDraftPick({
          round: activePick.round,
          overallPick: activePick.pick,
          currentOwner: activePick.currentOwner || '',
          originalOwner: activePick.originalTeam || '',
          recentPicks, onDeck, skippedOpen,
          type: 'EXPIRATION',
          leagueId,
        });

        results.push({ leagueId, action: 'auto_skip_3strike', pick: activePick.pick, strikes: teamStrikes });
        continue;
      }

      // Open-pick rule: if this team still has an unfilled skipped pick from a
      // prior round, immediately skip their current turn until they submit a
      // late selection for the open pick.
      const teamHasOpenSkip = skippedOpen.some(p => p.owner === activePick.currentOwner);
      if (teamHasOpenSkip) {
        await db.update(draftPicks)
          .set({ selectedPlayerName: 'SKIPPED (open pick pending)', pickedAt: now, touch_id: 'cron-open-pick' })
          .where(eq(draftPicks.id, activePick.id));

        await notifyDraftPick({
          round: activePick.round,
          overallPick: activePick.pick,
          currentOwner: activePick.currentOwner || '',
          originalOwner: activePick.originalTeam || '',
          recentPicks, onDeck, skippedOpen,
          type: 'EXPIRATION',
          leagueId,
        });

        results.push({ leagueId, action: 'auto_skip_open_pick', pick: activePick.pick });
        continue;
      }

      if (diffMs <= 0) {
        // Use the actual deadline as pickedAt (not "now") so the display and
        // downstream-clock math both reflect when the pick truly expired,
        // not when the cron happened to tick.
        await db.update(draftPicks)
          .set({ selectedPlayerName: 'SKIPPED (Time Expired)', pickedAt: expiryTime, touch_id: 'cron-auto-skip' })
          .where(eq(draftPicks.id, activePick.id));

        await notifyDraftPick({
          round: activePick.round,
          overallPick: activePick.pick,
          currentOwner: activePick.currentOwner || '',
          originalOwner: activePick.originalTeam || '',
          recentPicks, onDeck, skippedOpen,
          type: 'EXPIRATION',
          leagueId,
        });

        results.push({ leagueId, action: 'expired', pick: activePick.pick });
        continue;
      }

      if (diffMinutes <= warningMinutes && !activePick.warningSent) {
        // Send notification FIRST; only flip the flag if it succeeds so a
        // transient SMTP/WhatsApp failure can retry on the next tick instead
        // of being silently lost.
        try {
          await notifyDraftPick({
            round: activePick.round,
            overallPick: activePick.pick,
            currentOwner: activePick.currentOwner || '',
            originalOwner: activePick.originalTeam || '',
            recentPicks, onDeck, skippedOpen,
            type: 'WARNING',
            leagueId,
          });
          await db.update(draftPicks)
            .set({ warningSent: true })
            .where(eq(draftPicks.id, activePick.id));
          results.push({ leagueId, action: 'warning', pick: activePick.pick, minutesRemaining: diffMinutes.toFixed(1) });
        } catch (e) {
          console.error('[cron/draft] warning notify failed, leaving warning_sent=false to retry:', e);
          results.push({ leagueId, action: 'warning_failed', pick: activePick.pick, error: String(e) });
        }
        continue;
      }

      results.push({ leagueId, action: 'none', minutesRemaining: diffMinutes.toFixed(1) });
    }

    return NextResponse.json({ results });
  } catch (error: unknown) {
    console.error('Draft cron error:', error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}
