import { NextResponse } from 'next/server';
import { auth } from "@/auth";
import { getCoaches, updateCoachContact } from '@/lib/config';
import { logSystemEvent } from '@/lib/googleSheets';

export async function GET() {
  try {
    // 🔒 Verify authentication before returning sensitive contact data
    const session = await auth();
    if (!session?.user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const allCoaches = await getCoaches();
    const activeTeams = allCoaches
      .filter((c) => c.status === 'active')
      .map((c) => ({
        name: c.team,
        short: c.teamshort,
        nickname: c.nickname,
        coach: c.coach,
        commissioner: c.isCommissioner,
        lastSync: c.lastSync,
        mobile: c.mobile,
        email: c.email
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

    const { email, mobile } = await req.json();
    const teamCode = (session.user as any).id;

    const result = await updateCoachContact(teamCode, mobile, email);
    
    if (result.success) {
      await logSystemEvent(
        session.user.name || "Unknown Coach",
        teamCode,
        "UPDATE_CONTACT",
        `Email: ${email}, Mobile: ${mobile}`
      );
    }

    return NextResponse.json(result);
  } catch (error) {
    return NextResponse.json({ success: false, error: 'Internal Server Error' }, { status: 500 });
  }
}