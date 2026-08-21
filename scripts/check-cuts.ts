import { db } from '../lib/db';
import { cuts } from '../schema';

const rows = await db.select().from(cuts).limit(10);
console.log('Total sample rows:', rows.length);
rows.forEach(r => console.log(r));
