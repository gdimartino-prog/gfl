
import { db } from './db';
import { auditLog } from '@/schema';

export async function logSystemEvent(coach: string, team: string, action: string, details: string = "", leagueId?: number) {
  try {
    await db.insert(auditLog).values({
      coach,
      team,
      action,
      details,
      leagueId: leagueId ?? 1,
    });
  } catch (error) {
    console.error("Audit Log Failure:", error);
  }
}
