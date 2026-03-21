import { db } from '../lib/db';
import { teams } from '../schema';
import { eq } from 'drizzle-orm';

const result = await db.update(teams)
  .set({ status: 'inactive', touch_id: 'history-import' })
  .where(eq(teams.touch_id, 'history-import'))
  .returning({ id: teams.id, name: teams.name });

console.log('Set inactive:', result.map(r => r.name).join(', '));
console.log('Count:', result.length);
