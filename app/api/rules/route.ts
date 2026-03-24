import { NextResponse, NextRequest } from 'next/server';
import { db } from '@/lib/db';
import { rules } from '@/schema';
import { eq, and, isNull } from 'drizzle-orm';
import { getLeagueId } from '@/lib/getLeagueId';
import { logSystemEvent } from '@/lib/db-helpers';
import { isAdmin } from '@/lib/auth';

const GLOBAL_ONLY_RULES = new Set(['cuts_year', 'current_nfl_week', 'player_sync']);
const isGlobalOnlyRule = (r: string) => GLOBAL_ONLY_RULES.has(r) || r.startsWith('draft_clock_');

export async function GET() {
  try {
    const leagueId = await getLeagueId();
    const rows = await db.select().from(rules)
      .where(eq(rules.leagueId, leagueId))
      .orderBy(rules.year, rules.rule);
    return NextResponse.json(rows.map(r => ({ setting: r.rule, value: r.value, desc: r.desc, year: r.year ?? null })));
  } catch (error) {
    console.error('Rules API Error:', error);
    return NextResponse.json([], { status: 200 });
  }
}

export async function POST(req: NextRequest) {
  if (!await isAdmin()) return NextResponse.json({ error: 'Unauthorized' }, { status: 403 });
  try {
    const { rule, value, year, desc } = await req.json();
    if (!rule || value === undefined) {
      return NextResponse.json({ error: 'rule and value are required' }, { status: 400 });
    }
    const leagueId = await getLeagueId();
    const yearVal = isGlobalOnlyRule(String(rule).trim()) ? null : (year != null && year !== '' ? Number(year) : null);
    await db.insert(rules).values({
      leagueId,
      year: yearVal,
      rule: String(rule).trim(),
      value: String(value),
      desc: desc ?? null,
      touch_id: 'maintenance',
    });
    logSystemEvent('admin', 'admin', 'RULE_CREATED', `Created rule: ${rule}=${value}${yearVal != null ? ` (year ${yearVal})` : ''}`, leagueId);
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Rules POST Error:', error);
    return NextResponse.json({ error: 'Failed to create rule' }, { status: 500 });
  }
}

export async function PATCH(req: NextRequest) {
  if (!await isAdmin()) return NextResponse.json({ error: 'Unauthorized' }, { status: 403 });
  try {
    const { rule, value, year } = await req.json();
    if (!rule || value === undefined) {
      return NextResponse.json({ error: 'rule and value are required' }, { status: 400 });
    }
    const leagueId = await getLeagueId();
    const yearVal = year != null ? Number(year) : null;
    await db.update(rules)
      .set({ value: String(value), touch_id: 'maintenance' })
      .where(and(
        eq(rules.rule, rule),
        eq(rules.leagueId, leagueId),
        yearVal != null ? eq(rules.year, yearVal) : isNull(rules.year),
      ));
    logSystemEvent('admin', 'admin', 'RULE_UPDATED', `Updated rule: ${rule}=${value}${yearVal != null ? ` (year ${yearVal})` : ''}`, leagueId);
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Rules PATCH Error:', error);
    return NextResponse.json({ error: 'Failed to update rule' }, { status: 500 });
  }
}

export async function DELETE(req: NextRequest) {
  if (!await isAdmin()) return NextResponse.json({ error: 'Unauthorized' }, { status: 403 });
  try {
    const { rule, year } = await req.json();
    if (!rule) return NextResponse.json({ error: 'rule is required' }, { status: 400 });
    const leagueId = await getLeagueId();
    const yearVal = year != null ? Number(year) : null;
    await db.delete(rules).where(and(
      eq(rules.rule, rule),
      eq(rules.leagueId, leagueId),
      yearVal != null ? eq(rules.year, yearVal) : isNull(rules.year),
    ));
    logSystemEvent('admin', 'admin', 'RULE_DELETED', `Deleted rule: ${rule}${yearVal != null ? ` (year ${yearVal})` : ''}`, leagueId);
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Rules DELETE Error:', error);
    return NextResponse.json({ error: 'Failed to delete rule' }, { status: 500 });
  }
}
