import { db } from '../lib/db';
import { players } from '../schema';
import { inArray } from 'drizzle-orm';

// Exact-identity duplicates: keep higher ID (newer), delete lower ID (stale)
const toDelete = [23108, 23301, 23528, 23439]; // Joe Flacco, Cam Robinson, Adam Thielen, Michael Carter II

await db.delete(players).where(inArray(players.id, toDelete));
console.log(`Deleted ${toDelete.length} stale duplicate player rows: ${toDelete.join(', ')}`);
process.exit(0);
