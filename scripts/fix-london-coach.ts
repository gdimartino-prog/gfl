import { db } from '../lib/db';
import { standings } from '../schema';
import { inArray } from 'drizzle-orm';

await db.update(standings)
  .set({ coachName: 'Matt Cicirelli', touch_id: 'maintenance' })
  .where(inArray(standings.id, [261, 117, 167, 187]));

console.log('Updated London 2022–2025 standings to Matt Cicirelli');
process.exit(0);
