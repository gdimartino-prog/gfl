import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { teams, leagues } from '@/schema';
import { eq, and, or, sql } from 'drizzle-orm';
import bcrypt from 'bcrypt';
import { auth } from '@/auth';

// Returns { isSuperuser, isCommissioner, leagueId } for the current session
async function getSessionAccess() {
  const session = await auth();
  const role = session?.user?.role;
  if (!role || (role !== 'admin' && role !== 'superuser')) return null;

  if (role === 'superuser') return { isSuperuser: true, leagueId: null };

  // Commissioner — look up their league via teamshort
  const teamshort = (session!.user as { id?: string }).id;
  if (!teamshort) return null;
  const row = await db
    .select({ leagueId: teams.leagueId })
    .from(teams)
    .where(eq(teams.teamshort, teamshort))
    .limit(1);
  const leagueId = row[0]?.leagueId ?? null;
  return { isSuperuser: false, leagueId };
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { leagueId, teamName, teamShort, coachName, email, mobile, password } = body;

    if (!leagueId || !teamName || !teamShort || !coachName || !password) {
      return NextResponse.json({ error: 'Missing required fields.' }, { status: 400 });
    }

    // Validate league exists
    const leagueRows = await db
      .select({ id: leagues.id })
      .from(leagues)
      .where(eq(leagues.id, parseInt(leagueId)))
      .limit(1);

    if (!leagueRows[0]) {
      return NextResponse.json({ error: 'Invalid League ID. Please check and try again.' }, { status: 400 });
    }

    // Check for duplicate shortcode or email in that league
    const conditions = [
      eq(teams.leagueId, parseInt(leagueId)),
      or(
        sql`lower(${teams.teamshort}) = ${teamShort.trim().toLowerCase()}`,
        email?.trim() ? sql`lower(${teams.email}) = ${email.trim().toLowerCase()}` : sql`false`
      ),
    ];

    const existing = await db
      .select({ id: teams.id })
      .from(teams)
      .where(and(...conditions))
      .limit(1);

    if (existing[0]) {
      return NextResponse.json(
        { error: 'A team with that shortcode or email already exists in this league.' },
        { status: 409 }
      );
    }

    const hashedPassword = await bcrypt.hash(password, 12);

    await db.insert(teams).values({
      leagueId: parseInt(leagueId),
      name: teamName.trim(),
      teamshort: teamShort.trim().toUpperCase(),
      coach: coachName.trim(),
      email: email?.trim() || null,
      mobile: mobile?.trim() || null,
      password: hashedPassword,
      status: 'pending',
    });

    return NextResponse.json({ success: true });
  } catch (err) {
    console.error('Signup error:', err);
    return NextResponse.json({ error: 'An error occurred. Please try again.' }, { status: 500 });
  }
}

export async function GET() {
  const access = await getSessionAccess();
  if (!access) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const whereClause = access.isSuperuser
    ? eq(teams.status, 'pending')
    : and(eq(teams.status, 'pending'), eq(teams.leagueId, access.leagueId!));

  const pending = await db
    .select({
      id: teams.id,
      name: teams.name,
      teamshort: teams.teamshort,
      coach: teams.coach,
      email: teams.email,
      mobile: teams.mobile,
      leagueId: teams.leagueId,
      touch_dt: teams.touch_dt,
    })
    .from(teams)
    .where(whereClause);

  return NextResponse.json(pending);
}

export async function PATCH(req: NextRequest) {
  const access = await getSessionAccess();
  if (!access) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { id, action } = await req.json();
  if (!id || !['approve', 'reject'].includes(action)) {
    return NextResponse.json({ error: 'Invalid request.' }, { status: 400 });
  }

  // Commissioner can only act on signups in their own league
  if (!access.isSuperuser) {
    const signup = await db
      .select({ leagueId: teams.leagueId })
      .from(teams)
      .where(and(eq(teams.id, id), eq(teams.status, 'pending')))
      .limit(1);
    if (!signup[0] || signup[0].leagueId !== access.leagueId) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }
  }

  if (action === 'approve') {
    await db.update(teams).set({ status: 'active' }).where(eq(teams.id, id));
  } else {
    await db.delete(teams).where(eq(teams.id, id));
  }

  return NextResponse.json({ success: true });
}
