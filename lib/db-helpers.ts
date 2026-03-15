
import { db } from './db';
import { auditLog } from '@/schema';

export async function logSystemEvent(coach: string, team: string, action: string, details: string = "") {
  try {
    await db.insert(auditLog).values({
      coach,
      team,
      action,
      details,
    });
  } catch (error) {
    console.error("Audit Log Failure:", error);
  }
}
