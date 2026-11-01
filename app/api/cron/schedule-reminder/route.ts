import { NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { schedule, standings, teams, rules, leagues } from '@/schema';
import { eq, and } from 'drizzle-orm';
import { sendEmail, sendWhatsApp, escapeHtml } from '@/lib/notify';
import { alias } from 'drizzle-orm/pg-core';
import { isAuthorizedCron } from '@/lib/cronAuth';

export async function GET(req: Request) {
  if (!isAuthorizedCron(req)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const allLeagues = await db.select({ id: leagues.id }).from(leagues);
    const results = [];

    for (const { id: leagueId } of allLeagues) {
    // Only GFL (leagueId 1) has email and WhatsApp configured
    if (leagueId !== 1) {
      results.push({ leagueId, skipped: 'Notifications not configured for this league' });
      continue;
    }

    // Get config from rules
    const rulesRows = await db.select({ rule: rules.rule, value: rules.value })
      .from(rules).where(eq(rules.leagueId, leagueId));
    const cfg: Record<string, string> = {};
    rulesRows.forEach(r => { cfg[r.rule] = r.value; });

    const currentSeasonYear = parseInt(cfg.cuts_year || '2025');
    const rawNflWeek = cfg.current_nfl_week || '';
    const offset = parseInt(cfg.schedule_due || '0');
    const currentLeagueWeek = isNaN(parseInt(rawNflWeek))
      ? rawNflWeek
      : String(parseInt(rawNflWeek) - offset);

    const parsedLeagueWeek = parseInt(currentLeagueWeek);

    // Preseason window: send a heads-up email during the 4 weeks before the
    // regular-season emails kick in (gflWeek = -3 through 0). Before that,
    // skip entirely to avoid noise.
    if (!isNaN(parsedLeagueWeek) && parsedLeagueWeek <= 0) {
      if (parsedLeagueWeek < -3) {
        results.push({ leagueId, skipped: 'Too early for preseason email', currentLeagueWeek });
        continue;
      }

      // Fetch Week 1 matchups so members can see their opener
      const homeTeamsPs = alias(teams, 'homeTeams');
      const awayTeamsPs = alias(teams, 'awayTeams');
      const week1Games = await db.select({
        home: homeTeamsPs.name,
        away: awayTeamsPs.name,
        homeScore: schedule.home_score,
        awayScore: schedule.away_score,
      })
        .from(schedule)
        .leftJoin(homeTeamsPs, eq(schedule.homeTeamId, homeTeamsPs.id))
        .leftJoin(awayTeamsPs, eq(schedule.awayTeamId, awayTeamsPs.id))
        .where(and(
          eq(schedule.leagueId, leagueId),
          eq(schedule.year, currentSeasonYear),
          eq(schedule.week, '1'),
        ));

      // NFL kickoff = Thursday after Labor Day (first Monday of September)
      const sep1 = new Date(currentSeasonYear, 8, 1);
      const laborDayOffset = (8 - sep1.getDay()) % 7;
      const laborDay = new Date(currentSeasonYear, 8, 1 + laborDayOffset);
      const nflKickoff = new Date(laborDay.getTime() + 3 * 24 * 60 * 60 * 1000);
      const kickoffStr = nflKickoff.toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' });

      const esc = (s: string | null) =>
        (s ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

      let psRows = '';
      let psWa = '';
      for (const g of week1Games) {
        const isFinal = g.homeScore !== null && g.awayScore !== null;
        const scoreStr = isFinal ? `<strong>${g.awayScore}–${g.homeScore}</strong> Final` : 'Upcoming';
        const rowStyle = isFinal ? 'background:#f0fdf4;' : '';
        psRows += `<tr style="${rowStyle}">
          <td style="padding:8px;border:1px solid #ddd;">${esc(g.away)} @ ${esc(g.home)}</td>
          <td style="padding:8px;border:1px solid #ddd;text-align:right;white-space:nowrap;">${scoreStr}</td>
        </tr>`;
        psWa += isFinal
          ? `✅ ${g.away} @ ${g.home} — Final: ${g.awayScore}-${g.homeScore}\n`
          : `🏈 ${g.away} @ ${g.home}\n`;
      }

      const psHtml = `<div style="max-width:600px;border:1px solid #eee;padding:20px;font-family:sans-serif;">
        <h2 style="color:#0047AB;">GFL ${currentSeasonYear} Season — Coming Soon</h2>
        <div style="background:#eff6ff;padding:10px;border-left:5px solid #1E56A0;margin-bottom:20px;">
          <strong>📅 The NFL ${currentSeasonYear} season opens ${kickoffStr}.</strong><br>
          GFL Week 1 scores will open on that date — due each Sunday by 1:00 PM EST.
        </div>
        <h3 style="color:#0047AB;border-bottom:2px solid #eee;padding-bottom:8px;">Week 1 Matchups</h3>
        <table style="border-collapse:collapse;width:100%;font-size:13px;">
          <tr style="background:#333;color:white;"><th style="padding:8px;border:1px solid #ddd;">Matchup</th><th style="padding:8px;border:1px solid #ddd;text-align:right;">Result</th></tr>
          ${psRows}
        </table>
        <p style="margin-top:20px;font-size:12px;color:#666;">
          You will receive your first weekly game update once Week 1 is underway.<br>
          Scores are entered at gfl.vercel.app
        </p>
      </div>`;

      const psWaFull = `📅 *GFL ${currentSeasonYear} Season — Coming Soon*\nNFL season opens ${kickoffStr}. GFL Week 1 scores open on that date.\n\n*WEEK 1 MATCHUPS*\n${psWa}`;

      await sendEmail({ subject: `GFL ${currentSeasonYear} Season — Coming Soon`, html: psHtml });
      await sendWhatsApp(psWaFull);
      results.push({ leagueId, preseason: true });
      continue;
    }

    const playoffOrder = ['WC', 'CONF', 'SB'];

    // Get schedule with team names
    const homeTeams = alias(teams, 'homeTeams');
    const awayTeams = alias(teams, 'awayTeams');

    const games = await db.select({
      week: schedule.week,
      homeScore: schedule.home_score,
      awayScore: schedule.away_score,
      home: homeTeams.name,
      away: awayTeams.name,
    })
    .from(schedule)
    .leftJoin(homeTeams, eq(schedule.homeTeamId, homeTeams.id))
    .leftJoin(awayTeams, eq(schedule.awayTeamId, awayTeams.id))
    .where(and(eq(schedule.leagueId, leagueId), eq(schedule.year, currentSeasonYear)));

    // Determine which weeks to show
    const isFinal = (g: typeof games[0]) => g.homeScore !== null;
    // "Due" = the current GFL week or earlier — used to decide whether we're
    // still catching up on the regular season (vs. ready to move to
    // playoffs). Weeks beyond that haven't been played yet, so they're
    // naturally not-final and must be excluded here — otherwise every
    // future week gets pulled in as "past due".
    const isDueOrEarlier = (wk: string) => {
      const n = parseInt(wk);
      return !isNaN(n) && n <= 18 && n <= parsedLeagueWeek;
    };
    // What actually appears in the email: due-or-earlier weeks, PLUS a
    // one-week look-ahead so the upcoming week's matchups show alongside
    // the "next deadline" banner (which is always the upcoming Sunday) —
    // otherwise the email says a deadline is coming but shows no games for it.
    const isVisibleWeek = (wk: string) => {
      const n = parseInt(wk);
      return !isNaN(n) && n <= 18 && n <= parsedLeagueWeek + 1;
    };
    const unfinishedReg = games.filter(g =>
      !isFinal(g) && !playoffOrder.includes(g.week) && isDueOrEarlier(g.week)
    ).length;

    const weeksToShow = new Set<string>();
    for (const g of games) {
      const isPlayoff = playoffOrder.includes(g.week) || (!isNaN(parseInt(g.week)) && parseInt(g.week) > 18);
      if (unfinishedReg > 0) {
        if (!isPlayoff && isVisibleWeek(g.week) && (g.week === currentLeagueWeek || !isFinal(g))) weeksToShow.add(g.week);
      } else {
        if (isPlayoff && !isFinal(g)) weeksToShow.add(g.week);
      }
    }

    if (weeksToShow.size === 0) {
      results.push({ leagueId, skipped: 'all games final' });
      continue;
    }

    const sortedWeeks = Array.from(weeksToShow).sort((a, b) => {
      const ai = playoffOrder.indexOf(a), bi = playoffOrder.indexOf(b);
      if (ai !== -1 && bi !== -1) return ai - bi;
      if (ai !== -1) return 1;
      if (bi !== -1) return -1;
      return parseInt(a) - parseInt(b);
    });

    const displayWeek = sortedWeeks[0];

    // Build schedule HTML + WhatsApp text
    let waMessage = `📅 *GFL WEEKLY UPDATE: Week ${displayWeek} (${currentSeasonYear})*\n----------------------------------\n`;
    let htmlRows = '';

    for (const wk of sortedWeeks) {
      waMessage += `\n*WEEK ${wk}*\n`;
      for (const g of games.filter(x => x.week === wk)) {
        const scoreStr = g.homeScore !== null && g.awayScore !== null ? `${g.awayScore}-${g.homeScore}` : '';
        // Only a week strictly before the current one can be "past due" —
        // the current week is still in progress, and the look-ahead week
        // hasn't happened yet, so neither should ever be flagged overdue.
        const wkNum = parseInt(wk);
        const isPastDue = !isNaN(wkNum) && wkNum < parsedLeagueWeek && !isFinal(g) && !playoffOrder.includes(wk);
        const displayStatus = isPastDue ? '🚨 PAST DUE' : isFinal(g) ? `Final: ${scoreStr}` : 'PENDING';
        waMessage += `${isPastDue ? '❌' : '🏈'} ${g.away} @ ${g.home} - ${displayStatus}\n`;
        // Highlight PENDING games for the current GFL week in red so coaches
        // see the scores still owed this week (the look-ahead week is left
        // unstyled — those games haven't happened yet and aren't due).
        const isCurrentWeekPending = wk === currentLeagueWeek && !isFinal(g) && !playoffOrder.includes(wk);
        const rowStyle = isPastDue || isCurrentWeekPending ? 'background-color:#fff4f4;color:#d93025;font-weight:bold;' : '';
        htmlRows += `<tr style="${rowStyle}">
          <td style="padding:8px;border:1px solid #ddd;text-align:center;">${wk}</td>
          <td style="padding:8px;border:1px solid #ddd;">${escapeHtml(g.away)} @ ${escapeHtml(g.home)}</td>
          <td style="padding:8px;border:1px solid #ddd;">${displayStatus}</td>
        </tr>`;
      }
    }

    // Get standings
    const standingsRows = await db.select({
      teamName: teams.name,
      wins: standings.wins,
      losses: standings.losses,
      ties: standings.ties,
      division: standings.division,
      offPts: standings.offPts,
      defPts: standings.defPts,
    })
    .from(standings)
    .leftJoin(teams, eq(standings.teamId, teams.id))
    .where(and(eq(standings.leagueId, leagueId), eq(standings.year, currentSeasonYear)));

    const getH2H = (teamA: string, teamB: string) => {
      const finalGames = games.filter(g =>
        g.homeScore !== null && g.awayScore !== null &&
        !playoffOrder.includes(g.week) &&
        ((g.home === teamA && g.away === teamB) || (g.home === teamB && g.away === teamA))
      );
      if (finalGames.length === 0) return 0.5;
      let points = 0;
      for (const g of finalGames) {
        const aScore = g.home === teamA ? g.homeScore! : g.awayScore!;
        const bScore = g.home === teamA ? g.awayScore! : g.homeScore!;
        if (aScore > bScore) points += 1;
        else if (aScore === bScore) points += 0.5;
      }
      return points / finalGames.length;
    };

    const divisions: Record<string, typeof standingsRows> = {};
    for (const s of standingsRows) {
      if (!s.division) continue;
      if (!divisions[s.division]) divisions[s.division] = [];
      divisions[s.division].push(s);
    }

    const sortedDivisions = Object.keys(divisions).sort();
    let standingsHtml = `<h3 style="color:#0047AB;margin-top:25px;border-bottom:2px solid #eee;">League Standings (${currentSeasonYear})</h3>`;
    for (const div of sortedDivisions) {
      divisions[div].sort((a, b) => {
        const totalA = a.wins + a.losses + a.ties;
        const totalB = b.wins + b.losses + b.ties;
        const pctA = totalA > 0 ? (a.wins + a.ties * 0.5) / totalA : 0;
        const pctB = totalB > 0 ? (b.wins + b.ties * 0.5) / totalB : 0;
        if (pctB !== pctA) return pctB - pctA;

        if (a.teamName && b.teamName) {
          const h2h = getH2H(a.teamName, b.teamName);
          if (h2h !== 0.5) return h2h > 0.5 ? -1 : 1;
        }

        const diffA = (a.offPts ?? 0) - (a.defPts ?? 0);
        const diffB = (b.offPts ?? 0) - (b.defPts ?? 0);
        if (diffB !== diffA) return diffB - diffA;

        if ((b.offPts ?? 0) !== (a.offPts ?? 0)) return (b.offPts ?? 0) - (a.offPts ?? 0);
        if (b.wins !== a.wins) return b.wins - a.wins;
        return (a.teamName || '').localeCompare(b.teamName || '');
      });

      standingsHtml += `<h4 style="color:#333;margin-bottom:5px;text-transform:uppercase;font-size:14px;">${escapeHtml(div)}</h4>
        <table style="border-collapse:collapse;width:100%;font-size:12px;margin-bottom:15px;">
          <tr style="background:#f8f9fa;">
            <th style="border:1px solid #ddd;padding:5px;text-align:left;">Team</th>
            <th style="border:1px solid #ddd;padding:5px;text-align:center;">W</th>
            <th style="border:1px solid #ddd;padding:5px;text-align:center;">L</th>
            <th style="border:1px solid #ddd;padding:5px;text-align:center;">T</th>
            <th style="border:1px solid #ddd;padding:5px;text-align:center;">Pct</th>
          </tr>`;
      for (const t of divisions[div]) {
        const total = t.wins + t.losses + t.ties;
        const pct = total > 0 ? ((t.wins + 0.5 * t.ties) / total).toFixed(3).replace(/^0/, '') : '.000';
        standingsHtml += `<tr>
          <td style="border:1px solid #ddd;padding:5px;">${escapeHtml(t.teamName)}</td>
          <td style="border:1px solid #ddd;padding:5px;text-align:center;">${t.wins}</td>
          <td style="border:1px solid #ddd;padding:5px;text-align:center;">${t.losses}</td>
          <td style="border:1px solid #ddd;padding:5px;text-align:center;">${t.ties}</td>
          <td style="border:1px solid #ddd;padding:5px;text-align:center;">${pct}</td>
        </tr>`;
      }
      standingsHtml += '</table>';
    }

    const nextSunday = new Date();
    nextSunday.setDate(nextSunday.getDate() + (7 - nextSunday.getDay()) % 7);
    const dueDate = `${nextSunday.toLocaleString('default', { month: 'short' })} ${nextSunday.getDate()}, ${currentSeasonYear} @ 1:00 PM EST`;

    const html = `<div style="max-width:600px;border:1px solid #eee;padding:20px;font-family:sans-serif;">
      <h2 style="color:#0047AB;">GFL ${currentSeasonYear} Week ${displayWeek} Update</h2>
      <div style="background:#fff9c4;padding:10px;border-left:5px solid #fbc02d;margin-bottom:20px;"><strong>🚨 NEXT DEADLINE:</strong> ${dueDate}</div>
      <table style="border-collapse:collapse;width:100%;font-size:13px;">
        <tr style="background:#333;color:white;"><th style="padding:8px;border:1px solid #ddd;">Wk</th><th style="padding:8px;border:1px solid #ddd;">Matchup</th><th style="padding:8px;border:1px solid #ddd;">Status</th></tr>
        ${htmlRows}
      </table>
      ${standingsHtml}
    </div>`;

    await sendEmail({ subject: `GFL Update: ${currentSeasonYear} Week ${displayWeek}`, html });
    await sendWhatsApp(waMessage);
    results.push({ leagueId, sent: true, week: displayWeek });
    } // end league loop

    return NextResponse.json({ results });
  } catch (error: unknown) {
    console.error('Schedule reminder cron error:', error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}
