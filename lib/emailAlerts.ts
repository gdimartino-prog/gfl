import { db } from './db';
import { auditLog, rules } from '@/schema';
import { and, desc, eq, gt, isNull } from 'drizzle-orm';
import { unstable_cache } from 'next/cache';

export type UnacknowledgedEmailFailures = {
  count: number;
  latestId: number;
  latestSubject: string;
  latestTimestamp: string;
  hasWeeklyFailure: boolean;
};

function extractSubject(details: string | null): string {
  if (!details) return 'Unknown Email';
  const idx = details.indexOf(' (Invalid login:');
  if (idx !== -1) return details.slice(0, idx).trim();
  const parenIdx = details.lastIndexOf(' (');
  if (parenIdx > 0) return details.slice(0, parenIdx).trim();
  return details.slice(0, 120).trim();
}

const _getUnacknowledgedEmailFailures = unstable_cache(
  async (leagueId: number = 1): Promise<UnacknowledgedEmailFailures | null> => {
    const ruleRows = await db
      .select({ value: rules.value })
      .from(rules)
      .where(
        and(
          eq(rules.leagueId, leagueId),
          eq(rules.rule, 'email_alert_ack_id'),
          isNull(rules.year),
        ),
      )
      .limit(1);

    if (!ruleRows[0]) {
      // Seed baseline to the highest existing ALERT_FAILED id so historical
      // resolved failures don't immediately trigger the banner on first deploy.
      const latestExisting = await db
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

      const baselineId = latestExisting[0]?.id ?? 0;
      await db
        .insert(rules)
        .values({
          leagueId,
          year: null,
          rule: 'email_alert_ack_id',
          value: String(baselineId),
          desc: 'Last acknowledged failed email audit_log ID',
          touch_id: 'system-init',
        })
        .onConflictDoNothing();

      return null;
    }

    const ackId = parseInt(ruleRows[0].value, 10) || 0;

    const failedRows = await db
      .select({
        id: auditLog.id,
        timestamp: auditLog.timestamp,
        details: auditLog.details,
      })
      .from(auditLog)
      .where(
        and(
          eq(auditLog.leagueId, leagueId),
          eq(auditLog.team, 'EMAIL'),
          eq(auditLog.action, 'ALERT_FAILED'),
          gt(auditLog.id, ackId),
        ),
      )
      .orderBy(desc(auditLog.id))
      .limit(25);

    if (failedRows.length === 0) return null;

    const latest = failedRows[0];
    const hasWeeklyFailure = failedRows.some(r => {
      const subj = extractSubject(r.details);
      return subj.startsWith('GFL Update:') || subj.includes('Season — Coming Soon');
    });

    return {
      count: failedRows.length,
      latestId: latest.id,
      latestSubject: extractSubject(latest.details),
      latestTimestamp: latest.timestamp.toISOString(),
      hasWeeklyFailure,
    };
  },
  ['email-alerts-unacked'],
  { revalidate: 3600, tags: ['email-alerts', 'rules'] },
);

export function getUnacknowledgedEmailFailures(leagueId: number = 1) {
  return _getUnacknowledgedEmailFailures(leagueId);
}
