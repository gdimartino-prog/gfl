import { db } from '../lib/db';
import { auditLog } from '../schema';
import { eq, desc } from 'drizzle-orm';

const rows = await db.select()
  .from(auditLog)
  .where(eq(auditLog.action, 'PRESS_BOX_STORY'))
  .orderBy(desc(auditLog.timestamp));

console.log(JSON.stringify(rows, null, 2));
process.exit(0);
