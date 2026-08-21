import { NextResponse } from 'next/server';
import { auth } from "@/auth";
import { getCoaches, updateCoachContact } from '@/lib/config';
import { getLeagueId } from '@/lib/getLeagueId';
import { logSystemEvent } from '@/lib/db-helpers';
import { revalidateTag } from 'next/cache';

export async function GET() {
  try {
    const session = await auth();
    const leagueId = await getLeagueId();
    const allCoaches = await getCoaches(leagueId);
    const activeTeams = allCoaches
      .filter((c) => c.status === 'active')
      .map((c) => ({
        name: c.team,
        short: c.teamshort,
        team: c.team,
        teamshort: c.teamshort,
        nickname: c.nickname,
        coach: c.coach,
        commissioner: c.isCommissioner,
        lastSync: c.lastSync,
        // Sensitive fields only for authenticated users
        ...(session?.user ? { mobile: c.mobile, email: c.email } : {}),
      }));

    return NextResponse.json(activeTeams, {
      headers: { 'Cache-Control': 'private, max-age=60, stale-while-revalidate=120' },
    });
  } catch (error) {
    console.error('API /teams failed:', error);
    return NextResponse.json({ error: 'Failed to load teams' }, { status: 500 });
  }
}

export async function POST(req: Request) {
  try {
    const session = await auth();
    if (!session?.user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const { email, mobile, coach, nickname, team } = await req.json();
    const teamCode = (session.user as { id?: string }).id || "";
    const leagueId = await getLeagueId();

    // Email is the cross-league identity anchor (getLeagueId membership) —
    // capture the old value so every change is auditable, and bust the
    // membership cache so grants aren't stale.
    const before = (await getCoaches(leagueId)).find(
      c => c.teamshort.toUpperCase() === teamCode.toUpperCase()
    );
    const oldEmail = before?.email || '';

    const result = await updateCoachContact(teamCode, leagueId, mobile, email, coach, nickname, team);

    if (result.success) {
      const emailChanged = (email || '').trim().toLowerCase() !== oldEmail.trim().toLowerCase();
      await logSystemEvent(
        session.user.name || "Unknown Coach",
        teamCode,
        "UPDATE_CONTACT",
        `Coach: ${(coach || '').slice(0, 50)}, Nickname: ${(nickname || '').slice(0, 50)}` +
          (emailChanged ? `, Email: ${oldEmail.slice(0, 60)} → ${(email || '').slice(0, 60)}` : '')
      );
      if (emailChanged) revalidateTag('team-leagues', 'max');
    }

    return NextResponse.json(result);
  } catch {
    return NextResponse.json({ success: false, error: 'Internal Server Error' }, { status: 500 });
  }
}