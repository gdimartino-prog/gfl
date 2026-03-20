import { NextRequest, NextResponse } from 'next/server';
import { isAdmin, isCommissioner } from '@/lib/auth';
import { getLeagueId } from '@/lib/getLeagueId';
import { db } from '@/lib/db';
import { rules } from '@/schema';
import { and, eq, isNull } from 'drizzle-orm';
import { auth } from '@/auth';
import { logSystemEvent } from '@/lib/db-helpers';
import {
  getDraftPicksExist,
  hasDraftStarted,
  deleteDraftPicksByYearAndType,
  generateDraftPickRows,
  DraftOrderEntry,
} from '@/lib/draftPicks';
import { draftPicks } from '@/schema';

export const dynamic = 'force-dynamic';

export async function POST(req: NextRequest) {
  if (!await isAdmin() && !await isCommissioner()) {
    return NextResponse.json({ error: 'Commissioner access required' }, { status: 403 });
  }

  const session = await auth();
  const actor = session?.user?.name || 'Commissioner';

  try {
    const body = await req.json();
    const { year, draftType, rounds, order, salaries, confirmed } = body as {
      year: number;
      draftType: string;
      rounds: number;
      order: DraftOrderEntry[];
      salaries?: Record<number, number | string>;
      confirmed?: boolean;
    };

    if (!year || !draftType || !rounds || !order?.length) {
      return NextResponse.json({ error: 'year, draftType, rounds, and order are required' }, { status: 400 });
    }

    const leagueId = await getLeagueId();

    // Safety check: conflict
    const exists = await getDraftPicksExist(leagueId, year, draftType);
    if (exists && !confirmed) {
      const started = await hasDraftStarted(leagueId, year, draftType);
      return NextResponse.json({ conflict: true, started }, { status: 409 });
    }

    // Delete existing picks if confirmed
    if (exists) {
      await deleteDraftPicksByYearAndType(leagueId, year, draftType, actor);
    }

    // Generate and insert picks
    const rows = generateDraftPickRows({ leagueId, year, draftType, rounds, order, touchId: actor });
    await db.insert(draftPicks).values(rows);

    // Upsert salary rules if provided
    if (salaries) {
      const prefix = draftType === 'rookie' ? 'rookie_draft_round_' : 'fa_draft_round_';
      for (const [roundNum, salary] of Object.entries(salaries)) {
        if (!salary && salary !== 0) continue;
        const ruleName = `${prefix}${roundNum}_salary`;
        const ruleValue = String(salary);
        await db.delete(rules).where(and(eq(rules.leagueId, leagueId), eq(rules.rule, ruleName), isNull(rules.year)));
        await db.insert(rules).values({
          leagueId,
          rule: ruleName,
          value: ruleValue,
          year: null,
          desc: `Salary for ${draftType === 'rookie' ? 'Rookie' : 'Free Agent'} Draft Round ${roundNum}`,
          touch_id: actor,
        });
      }
    }

    logSystemEvent(actor, 'admin', 'DRAFT_SETUP_GENERATED',
      `Generated ${rows.length} picks for ${year} ${draftType} draft (${rounds} rounds, leagueId ${leagueId})`);

    return NextResponse.json({ success: true, inserted: rows.length });
  } catch (error) {
    console.error('POST /api/draft-setup failed:', error);
    return NextResponse.json({ error: 'Failed to generate draft' }, { status: 500 });
  }
}
