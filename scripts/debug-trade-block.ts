import { db } from '../lib/db';
import { tradeBlock } from '../schema';
import { and, eq } from 'drizzle-orm';

// Directly delete Daniel Jones from trade block
const result = await db.delete(tradeBlock).where(
  and(eq(tradeBlock.playerId, 'daniel|jones|28|qb||'), eq(tradeBlock.leagueId, 1))
);
console.log('Deleted Daniel Jones from trade block');

// Show remaining entries
const remaining = await db.select({ name: tradeBlock.playerName, team: tradeBlock.team }).from(tradeBlock).where(eq(tradeBlock.leagueId, 1));
console.log('Remaining trade block:', remaining);
process.exit(0);
