import { NextResponse, NextRequest } from 'next/server';
import { auth } from '@/auth';
import { db } from '@/lib/db';
import { leagues, teams } from '@/schema';
import { eq, and, sql } from 'drizzle-orm';

export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);

  // Public endpoint — returns id+name for all leagues (used on login page)
  if (searchParams.get('public') === 'true') {
    const rows = await db.select({ id: leagues.id, name: leagues.name }).from(leagues).orderBy(leagues.name);
    return NextResponse.json(rows);
  }

  const session = await auth();
  if (!session?.user) {
    return NextResponse.json([], { status: 401 });
  }

  const isSuperuser = session.user.role === 'superuser';
  const teamshort = (session.user as { id?: string }).id;

  type LeagueRow = { id: number; name: string; slug: string; legacyUrl: string | null };
  let rows: LeagueRow[] = [];

  if (isSuperuser) {
    const result = await db.select({ id: leagues.id, name: leagues.name, slug: leagues.slug, legacyUrl: leagues.legacyUrl }).from(leagues).orderBy(leagues.name);
    rows = result;
  } else if (session.user.role === 'demo') {
    // Demo users are locked to AFL (league 2) only
    const result = await db.select({ id: leagues.id, name: leagues.name, slug: leagues.slug, legacyUrl: leagues.legacyUrl }).from(leagues).where(eq(leagues.id, 2));
    rows = result;
  } else if (teamshort) {
    // Look up this user's email from the DB (using their teamshort + leagueId from session)
    const sessionLeagueId = (session.user as { leagueId?: number }).leagueId ?? 1;
    const emailRow = await db
      .select({ email: teams.email })
      .from(teams)
      .where(and(eq(teams.teamshort, teamshort.toUpperCase()), eq(teams.leagueId, sessionLeagueId)))
      .limit(1);
    const userEmail = emailRow[0]?.email;

    if (userEmail) {
      // Return all leagues where a team with this email exists and has credentials —
      // same email = same person, so they can access all those leagues
      const result = await db
        .selectDistinct({ id: leagues.id, name: leagues.name, slug: leagues.slug, legacyUrl: leagues.legacyUrl })
        .from(leagues)
        .innerJoin(teams, eq(teams.leagueId, leagues.id))
        .where(and(sql`lower(${teams.email}) = ${userEmail.toLowerCase()}`, sql`${teams.password} IS NOT NULL`))
        .orderBy(leagues.name);
      rows = result;
    } else {
      // No email on file — only return their current league
      const result = await db
        .select({ id: leagues.id, name: leagues.name, slug: leagues.slug, legacyUrl: leagues.legacyUrl })
        .from(leagues)
        .where(eq(leagues.id, sessionLeagueId));
      rows = result;
    }
  }

  return NextResponse.json(rows);
}

export async function POST(req: NextRequest) {
  const session = await auth();
  if (session?.user?.role !== 'superuser') {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { name, slug } = await req.json();
  if (!name?.trim() || !slug?.trim()) {
    return NextResponse.json({ error: 'name and slug are required' }, { status: 400 });
  }

  const slugVal = slug.trim().toLowerCase().replace(/[^a-z0-9-]/g, '');
  if (!slugVal) {
    return NextResponse.json({ error: 'Invalid slug' }, { status: 400 });
  }

  try {
    const [row] = await db.insert(leagues).values({
      name: name.trim(),
      slug: slugVal,
      touch_id: 'superuser',
    }).returning({ id: leagues.id, name: leagues.name, slug: leagues.slug });

    return NextResponse.json({ success: true, league: row });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    if (msg.includes('unique') || msg.includes('duplicate')) {
      return NextResponse.json({ error: 'Slug already exists' }, { status: 409 });
    }
    return NextResponse.json({ error: 'Failed to create league' }, { status: 500 });
  }
}

export async function PATCH(req: NextRequest) {
  const session = await auth();
  if (session?.user?.role !== 'superuser') {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { id, name, slug, legacyUrl } = await req.json();
  if (!id || (!name?.trim() && !slug?.trim() && legacyUrl === undefined)) {
    return NextResponse.json({ error: 'id and at least one field are required' }, { status: 400 });
  }

  const updates: Partial<{ name: string; slug: string; legacyUrl: string | null; touch_id: string }> = { touch_id: 'superuser' };
  if (name?.trim()) updates.name = name.trim();
  if (legacyUrl !== undefined) updates.legacyUrl = legacyUrl?.trim() || null;
  if (slug?.trim()) {
    const slugVal = slug.trim().toLowerCase().replace(/[^a-z0-9-]/g, '');
    if (!slugVal) return NextResponse.json({ error: 'Invalid slug' }, { status: 400 });
    updates.slug = slugVal;
  }

  try {
    const [row] = await db.update(leagues).set(updates).where(eq(leagues.id, Number(id)))
      .returning({ id: leagues.id, name: leagues.name, slug: leagues.slug });
    if (!row) return NextResponse.json({ error: 'League not found' }, { status: 404 });
    return NextResponse.json({ success: true, league: row });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    if (msg.includes('unique') || msg.includes('duplicate')) {
      return NextResponse.json({ error: 'Slug already exists' }, { status: 409 });
    }
    return NextResponse.json({ error: 'Failed to update league' }, { status: 500 });
  }
}
