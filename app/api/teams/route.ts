import { NextResponse } from 'next/server';
import { auth } from "@/auth";
import { getCoaches, updateCoachContact } from '@/lib/config';
import { getLeagueId } from '@/lib/getLeagueId';
import { logSystemEvent } from '@/lib/db-helpers';

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

    return NextResponse.json(activeTeams);
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

    const result = await updateCoachContact(teamCode, mobile, email, coach, nickname, team);

    if (result.success) {
      await logSystemEvent(
        session.user.name || "Unknown Coach",
        teamCode,
        "UPDATE_CONTACT",
        `Email: ${email}, Mobile: ${mobile}, Coach: ${coach}, Nickname: ${nickname}, Team: ${team}`
      );
    }

    return NextResponse.json(result);
  } catch {
    return NextResponse.json({ success: false, error: 'Internal Server Error' }, { status: 500 });
  }
}