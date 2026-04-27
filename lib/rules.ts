
import { db } from './db';
import { rules } from '@/schema';
import { eq } from 'drizzle-orm';

export type Rule = {
  id: number;
  leagueId: number;
  year?: number | null;
  rule: string;
  value: string;
  desc?: string | null;
  touch_id?: string | null;
};

/**
 * Fetches all rules from the database.
 */
export async function getRules(leagueId: number = 1): Promise<Rule[]> {
    return await db.select().from(rules).where(eq(rules.leagueId, leagueId));
}

/**
 * Adds a new rule.
 */
export async function addRule(rule: Omit<Rule, 'id'>, coachName: string) {
    await db.insert(rules).values({
        ...rule,
        touch_id: coachName,
    });
}

/**
 * Updates a rule.
 */
export async function updateRule(id: number, rule: Partial<Omit<Rule, 'id'>>, coachName: string) {
    await db.update(rules).set({
        ...rule,
        touch_id: coachName,
    }).where(eq(rules.id, id));
}

/**
 * Deletes a rule.
 */
export async function deleteRule(id: number) {
    await db.delete(rules).where(eq(rules.id, id));
}
