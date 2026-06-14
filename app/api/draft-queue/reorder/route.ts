import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/auth';
import { db } from '@/lib/db';
import { rules } from '@/schema';
import { eq, and } from 'drizzle-orm';
import { getLeagueId } from '@/lib/getLeagueId';
import { reorderAutoPickQueue, resolveTeamId } from '@/lib/autoPickQueue';

export async function PATCH(req: NextRequest) {
  const session = await auth();
  if (!session?.user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  try {
    const { items, draftType: bodyDraftType } = await req.json();
    if (!Array.isArray(items) || items.length === 0) {
      return NextResponse.json({ error: 'items array required' }, { status: 400 });
    }

    const VALID_DRAFT_TYPES = ['free_agent', 'rookie'];
    const leagueId = await getLeagueId();
    const draftType = (typeof bodyDraftType === 'string' && VALID_DRAFT_TYPES.includes(bodyDraftType))
      ? bodyDraftType
      : 'free_agent';

    const yearRow = await db.select({ value: rules.value })
      .from(rules)
      .where(and(eq(rules.rule, 'draft_year'), eq(rules.leagueId, leagueId)))
      .limit(1);
    const year = parseInt(yearRow[0]?.value || '0') || new Date().getFullYear();

    const callerShort = String((session.user as { id?: string }).id || '');
    const teamId = await resolveTeamId(leagueId, callerShort);
    if (!teamId) return NextResponse.json({ error: 'Team not found' }, { status: 404 });

    await reorderAutoPickQueue(leagueId, teamId, year, draftType, items);
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('draft-queue reorder error:', error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}
