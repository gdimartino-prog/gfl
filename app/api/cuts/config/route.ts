import { NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { rules } from '@/schema';
import { eq } from 'drizzle-orm';
import { getLeagueId } from '@/lib/getLeagueId';
import { auth } from '@/auth';

export async function GET() {
  const session = await auth();
  if (!session?.user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  try {
    const leagueId = await getLeagueId();
    const rows = await db.select({ rule: rules.rule, value: rules.value })
      .from(rules)
      .where(eq(rules.leagueId, leagueId));

    const cfg: Record<string, string> = {};
    rows.forEach(r => { cfg[r.rule] = r.value; });

    return NextResponse.json({
      cuts_year:    cfg.cuts_year    || '2025',
      draft_year:   cfg.draft_year   || '2026',
      protected:    parseInt(cfg.limit_protected) || 30,
      pullback:     parseInt(cfg.limit_pullback)  || 8,
      cuts_due_date: cfg.cuts_due_date || '',
    });
  } catch (error) {
    console.error('Config API Error:', error);
    return NextResponse.json({
      cuts_year: '2025', draft_year: '2026',
      protected: 30, pullback: 8, cuts_due_date: '',
    });
  }
}
