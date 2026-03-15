import { NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { cuts, teams, rules } from '@/schema';
import { eq, and } from 'drizzle-orm';
import { sendEmail, sendWhatsApp, GFL_URL } from '@/lib/notify';

function isAuthorized(req: Request) {
  return req.headers.get('authorization') === `Bearer ${process.env.CRON_SECRET}`;
}

export async function GET(req: Request) {
  if (!isAuthorized(req)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const leagueId = 1;

    const rulesRows = await db.select({ rule: rules.rule, value: rules.value })
      .from(rules).where(eq(rules.leagueId, leagueId));
    const cfg: Record<string, string> = {};
    rulesRows.forEach(r => { cfg[r.rule] = r.value; });

    const currentSeasonYear = parseInt(cfg.cuts_year || '2025');
    const cutsDueDate = cfg.cuts_due_date ? new Date(cfg.cuts_due_date) : null;
    const limitProtected = parseInt(cfg.limit_protected || '30');
    const limitPullback = parseInt(cfg.limit_pullback || '8');

    if (!cutsDueDate || new Date() > cutsDueDate) {
      return NextResponse.json({ skipped: 'deadline passed or not configured' });
    }

    // Get active teams
    const activeTeams = await db.select({ id: teams.id, name: teams.name, teamshort: teams.teamshort })
      .from(teams)
      .where(and(eq(teams.leagueId, leagueId), eq(teams.status, 'active')));

    // Get cuts for this year
    const cutsRows = await db.select({ teamId: cuts.teamId, status: cuts.status })
      .from(cuts)
      .where(and(eq(cuts.leagueId, leagueId), eq(cuts.year, currentSeasonYear)));

    // Count per team
    const counts: Record<number, { pCount: number; pbCount: number }> = {};
    for (const c of cutsRows) {
      if (!c.teamId) continue;
      if (!counts[c.teamId]) counts[c.teamId] = { pCount: 0, pbCount: 0 };
      const s = (c.status || '').toLowerCase();
      if (s === 'protected') counts[c.teamId].pCount++;
      if (s === 'pullback') counts[c.teamId].pbCount++;
    }

    // Find pending teams
    const pendingTeams = activeTeams
      .filter(t => {
        const c = counts[t.id] || { pCount: 0, pbCount: 0 };
        return c.pCount !== limitProtected || c.pbCount !== limitPullback;
      })
      .map(t => ({
        fullName: t.name,
        p: counts[t.id]?.pCount || 0,
        pb: counts[t.id]?.pbCount || 0,
      }));

    if (pendingTeams.length === 0) {
      return NextResponse.json({ skipped: 'all teams complete' });
    }

    // Time remaining
    const timeLeft = cutsDueDate.getTime() - Date.now();
    const days = Math.floor(timeLeft / (1000 * 60 * 60 * 24));
    const hours = Math.floor((timeLeft % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
    const countdownText = `${days}d ${hours}h remaining`;

    const teamRows = pendingTeams.map(t => `<tr>
      <td style="padding:10px;border:1px solid #ddd;"><b>${t.fullName}</b></td>
      <td style="padding:10px;border:1px solid #ddd;text-align:center;color:${t.p === limitProtected ? 'green' : '#d93025'};">${t.p}</td>
      <td style="padding:10px;border:1px solid #ddd;text-align:center;color:${t.pb === limitPullback ? 'green' : '#d93025'};">${t.pb}</td>
    </tr>`).join('');

    const html = `<div style="max-width:600px;border:1px solid #eee;padding:20px;font-family:sans-serif;">
      <h2 style="color:#d93025;border-bottom:2px solid #ddd;padding-bottom:10px;">${currentSeasonYear} Roster Requirements Alert</h2>
      <div style="background:#fff4f4;padding:15px;border-left:5px solid #d93025;margin-bottom:20px;">
        <strong>Deadline:</strong> ${cutsDueDate.toLocaleDateString()} (${countdownText})
      </div>
      <p>Teams missing <b>${limitProtected} Protected</b> and <b>${limitPullback} Pullback</b>:</p>
      <table style="border-collapse:collapse;width:100%;font-size:13px;">
        <tr style="background:#333;color:white;">
          <th style="padding:10px;border:1px solid #ddd;text-align:left;">Team</th>
          <th style="padding:10px;border:1px solid #ddd;text-align:center;">Protected (${limitProtected})</th>
          <th style="padding:10px;border:1px solid #ddd;text-align:center;">Pullback (${limitPullback})</th>
        </tr>
        ${teamRows}
      </table>
      <p style="text-align:center;margin-top:30px;">
        <a href="${GFL_URL}/cuts" style="background-color:#d93025;color:white;padding:15px 25px;text-decoration:none;border-radius:5px;font-weight:bold;display:inline-block;">Finalize Cuts on Website</a>
      </p>
    </div>`;

    await sendEmail({ subject: `URGENT: GFL Roster Requirements (${countdownText})`, html });
    const names = pendingTeams.map(t => t.fullName).join(', ');
    await sendWhatsApp(`🚨 *GFL ROSTER ALERT*\nTime Left: ${countdownText}\n\n*Pending:* ${names}\n\n🔗 ${GFL_URL}/cuts`);

    return NextResponse.json({ sent: true, pending: pendingTeams.length });
  } catch (error: unknown) {
    console.error('Cuts alert cron error:', error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}
