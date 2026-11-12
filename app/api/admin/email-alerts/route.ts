import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/auth';
import { isPrivileged } from '@/lib/auth';
import { getLeagueId } from '@/lib/getLeagueId';
import { getUnacknowledgedEmailFailures } from '@/lib/emailAlerts';
import { runScheduleReminderForLeague } from '@/lib/scheduleReminder';
import { db } from '@/lib/db';
import { auditLog, rules } from '@/schema';
import { and, desc, eq } from 'drizzle-orm';
import { logSystemEvent } from '@/lib/db-helpers';
import { tokenBucket } from '@/lib/rateLimit';
import { revalidateTag } from 'next/cache';

async function acknowledgeLatestEmailFailures(leagueId: number, touchId: string): Promise<number> {
  const latestRows = await db
    .select({ id: auditLog.id })
    .from(auditLog)
    .where(
      and(
        eq(auditLog.leagueId, leagueId),
        eq(auditLog.team, 'EMAIL'),
        eq(auditLog.action, 'ALERT_FAILED'),
      ),
    )
    .orderBy(desc(auditLog.id))
    .limit(1);

  const latestId = latestRows[0]?.id ?? 0;
  await db
    .insert(rules)
    .values({
      leagueId,
      year: null,
      rule: 'email_alert_ack_id',
      value: String(latestId),
      desc: 'Last acknowledged failed email audit_log ID',
      touch_id: touchId,
    })
    .onConflictDoUpdate({
      target: [rules.leagueId, rules.year, rules.rule],
      set: { value: String(latestId), touch_id: touchId, touch_dt: new Date() },
    });

  return latestId;
}

export async function GET() {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ alert: null }, { status: 401 });
  }
  if (!(await isPrivileged())) {
    return NextResponse.json(
      { alert: null },
      { headers: { 'Cache-Control': 'private, max-age=60' } },
    );
  }

  const leagueId = await getLeagueId();
  const alert = await getUnacknowledgedEmailFailures(leagueId);

  return NextResponse.json(
    { alert },
    { headers: { 'Cache-Control': 'private, max-age=60' } },
  );
}

export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
  if (!(await isPrivileged())) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  const body = await req.json().catch(() => ({}));
  const action = body?.action;
  if (action !== 'dismiss' && action !== 'retry-weekly' && action !== 'send-weekly') {
    return NextResponse.json({ error: 'Invalid action' }, { status: 400 });
  }

  const leagueId = await getLeagueId();
  const coachName = session.user.name || 'Commissioner';
  const teamName = (session.user as { team?: string }).team || session.user.id || 'Admin';

  if (action === 'dismiss') {
    const ackId = await acknowledgeLatestEmailFailures(leagueId, coachName);
    await logSystemEvent(
      coachName,
      teamName,
      'EMAIL_ALERT_DISMISSED',
      `Acknowledged failed email alerts up to #${ackId}`,
      leagueId,
    );
    revalidateTag('email-alerts', 'max');
    return NextResponse.json({ success: true, ackId });
  }

  // action === 'retry-weekly' || action === 'send-weekly'
  const emailOnly = action === 'retry-weekly';
  const rl = tokenBucket(`weekly-alert:${leagueId}`, 3, 600);
  if (!rl.ok) {
    return NextResponse.json(
      { error: `Rate limited — please wait ${rl.retryAfterSec}s before retrying.` },
      { status: 429 },
    );
  }
  const result = await runScheduleReminderForLeague(leagueId, { emailOnly });
  if (!result.emailSent) {
    revalidateTag('email-alerts', 'max');
    return NextResponse.json(
      { error: result.skipped || 'Weekly email failed — check SMTP credentials.' },
      { status: 502 },
    );
  }

  const ackId = await acknowledgeLatestEmailFailures(leagueId, coachName);
  await logSystemEvent(
    coachName,
    teamName,
    emailOnly ? 'EMAIL_WEEKLY_RETRIED' : 'WEEKLY_UPDATE_SENT',
    emailOnly
      ? `Retried weekly update email (Week ${result.week ?? 'preseason'}) and acknowledged alerts up to #${ackId}`
      : `Manually sent weekly update email & WhatsApp (Week ${result.week ?? 'preseason'})`,
    leagueId,
  );
  revalidateTag('email-alerts', 'max');
  return NextResponse.json({
    success: true,
    week: result.week,
    emailSent: result.emailSent,
    whatsappSent: result.whatsappSent,
    ackId,
  });
}
