import { NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { schedule, standings, teams, rules } from '@/schema';
import { eq, and } from 'drizzle-orm';
import { sendEmail, sendWhatsApp } from '@/lib/notify';
import { alias } from 'drizzle-orm/pg-core';

function isAuthorized(req: Request) {
  return req.headers.get('authorization') === `Bearer ${process.env.CRON_SECRET}`;
}

export async function GET(req: Request) {
  if (!isAuthorized(req)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const leagueId = 1;

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
    const unfinishedReg = games.filter(g =>
      !isFinal(g) && !playoffOrder.includes(g.week) && !isNaN(parseInt(g.week)) && parseInt(g.week) <= 18
    ).length;

    const weeksToShow = new Set<string>();
    for (const g of games) {
      const isPlayoff = playoffOrder.includes(g.week) || (!isNaN(parseInt(g.week)) && parseInt(g.week) > 18);
      if (unfinishedReg > 0) {
        if (!isPlayoff && (g.week === currentLeagueWeek || !isFinal(g))) weeksToShow.add(g.week);
      } else {
        if (isPlayoff && !isFinal(g)) weeksToShow.add(g.week);
      }
    }

    if (weeksToShow.size === 0) {
      return NextResponse.json({ skipped: 'all games final' });
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
        const isPastDue = wk !== currentLeagueWeek && !isFinal(g) && !playoffOrder.includes(wk);
        const displayStatus = isPastDue ? '🚨 PAST DUE' : isFinal(g) ? `Final: ${scoreStr}` : 'PENDING';
        waMessage += `${isPastDue ? '❌' : '🏈'} ${g.away} @ ${g.home} - ${displayStatus}\n`;
        const rowStyle = isPastDue ? 'background-color:#fff4f4;color:#d93025;font-weight:bold;' : '';
        htmlRows += `<tr style="${rowStyle}">
          <td style="padding:8px;border:1px solid #ddd;text-align:center;">${wk}</td>
          <td style="padding:8px;border:1px solid #ddd;">${g.away} @ ${g.home}</td>
          <td style="padding:8px;border:1px solid #ddd;">${displayStatus}</td>
        </tr>`;
      }
    }

    // Get standings
    const standingsRows = await db.select({
      teamName: teams.name,
      wins: standings.wins, losses: standings.losses, ties: standings.ties,
      division: standings.division,
    })
    .from(standings)
    .leftJoin(teams, eq(standings.teamId, teams.id))
    .where(and(eq(standings.leagueId, leagueId), eq(standings.year, currentSeasonYear)));

    const divisions: Record<string, typeof standingsRows> = {};
    for (const s of standingsRows) {
      if (!s.division) continue;
      if (!divisions[s.division]) divisions[s.division] = [];
      divisions[s.division].push(s);
    }

    let standingsHtml = `<h3 style="color:#0047AB;margin-top:25px;border-bottom:2px solid #eee;">League Standings (${currentSeasonYear})</h3>`;
    for (const div in divisions) {
      standingsHtml += `<h4 style="color:#333;margin-bottom:5px;text-transform:uppercase;font-size:14px;">${div}</h4>
        <table style="border-collapse:collapse;width:100%;font-size:12px;margin-bottom:15px;">
          <tr style="background:#f8f9fa;"><th style="border:1px solid #ddd;padding:5px;">Team</th><th style="border:1px solid #ddd;padding:5px;">W</th><th style="border:1px solid #ddd;padding:5px;">L</th><th style="border:1px solid #ddd;padding:5px;">T</th></tr>`;
      for (const t of divisions[div]) {
        standingsHtml += `<tr><td style="border:1px solid #ddd;padding:5px;">${t.teamName}</td>
          <td style="border:1px solid #ddd;padding:5px;text-align:center;">${t.wins}</td>
          <td style="border:1px solid #ddd;padding:5px;text-align:center;">${t.losses}</td>
          <td style="border:1px solid #ddd;padding:5px;text-align:center;">${t.ties}</td></tr>`;
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

    return NextResponse.json({ sent: true, week: displayWeek });
  } catch (error: unknown) {
    console.error('Schedule reminder cron error:', error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}
