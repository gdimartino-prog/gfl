import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { teams, leagues } from '@/schema';
import { eq, and, or, sql } from 'drizzle-orm';
import bcrypt from 'bcrypt';
import { auth } from '@/auth';
import { isCommissioner } from '@/lib/auth';
import { getLeagueId } from '@/lib/getLeagueId';
import { tokenBucket } from '@/lib/rateLimit';
import { revalidateTag } from 'next/cache';

// Returns { isSuperuser, leagueId } for the current session.
// Commissioner status is verified against the DB — the JWT role can be
// stale for up to 30 days after a demotion.
async function getSessionAccess() {
  const session = await auth();
  if (!session?.user) return null;
  if (session.user.role === 'superuser') return { isSuperuser: true, leagueId: null };
  if (await isCommissioner()) {
    const leagueId = await getLeagueId();
    return { isSuperuser: false, leagueId };
  }
  return null;
}

export async function POST(req: NextRequest) {
  try {
    // Unauthenticated endpoint doing bcrypt cost-12 work — rate-limit by IP
    // so it can't be used to flood the teams table or burn CPU.
    const ip = (req.headers.get('x-forwarded-for') || 'unknown').split(',')[0].trim();
    const limit = tokenBucket(`signup:${ip}`, 5, 3600);
    if (!limit.ok) {
      return NextResponse.json(
        { error: 'Too many signup attempts. Please try again later.' },
        { status: 429, headers: { 'Retry-After': String(limit.retryAfterSec) } },
      );
    }

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
    revalidateTag('team-leagues', 'max');

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
    revalidateTag('team-leagues', 'max');
  }

  return NextResponse.json({ success: true });
}
