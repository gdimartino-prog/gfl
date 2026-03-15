import { NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { rules } from '@/schema';
import { eq } from 'drizzle-orm';
import { getLeagueId } from '@/lib/getLeagueId';
import { isAdmin } from '@/lib/auth';

const TEMPLATE_LEAGUE_ID = 1;

export async function POST() {
  const admin = await isAdmin();
  if (!admin) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const leagueId = await getLeagueId();

  if (leagueId === TEMPLATE_LEAGUE_ID) {
    return NextResponse.json({ error: 'Cannot initialize from itself.' }, { status: 400 });
  }

  // Fetch all rules from the template league (league 1)
  const templateRules = await db
    .select({ rule: rules.rule, value: rules.value, desc: rules.desc })
    .from(rules)
    .where(eq(rules.leagueId, TEMPLATE_LEAGUE_ID));

  if (templateRules.length === 0) {
    return NextResponse.json({ error: 'No rules found in template league (ID 1).' }, { status: 404 });
  }

  // Find which rules are missing for the target league
  const existing = await db
    .select({ rule: rules.rule, year: rules.year })
    .from(rules)
    .where(eq(rules.leagueId, leagueId));

  const existingKeys = new Set(existing.map(r => `${r.rule}||${r.year ?? ''}`));
  const toInsert = templateRules.filter(r => !existingKeys.has(`${r.rule}||${(r as { year?: number | null }).year ?? ''}`));

  if (toInsert.length === 0) {
    return NextResponse.json({ message: 'All rules already exist for this league.', created: 0 });
  }

  await db.insert(rules).values(
    toInsert.map(r => ({ ...r, leagueId, touch_id: 'initialize' }))
  );

  return NextResponse.json({
    message: `Copied ${toInsert.length} rule(s) from league ${TEMPLATE_LEAGUE_ID}.`,
    created: toInsert.length,
  });
}
