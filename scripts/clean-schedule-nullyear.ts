import { db } from '../lib/db';
import { schedule } from '../schema';
import { isNull } from 'drizzle-orm';

const result = await db.delete(schedule).where(isNull(schedule.year)).returning({ id: schedule.id });
console.log(`Deleted ${result.length} schedule rows with null year.`);
process.exit(0);
