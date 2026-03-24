import { NextResponse } from 'next/server';
import { isAdmin } from '@/lib/auth';
import { db } from '@/lib/db';
import { teams } from '@/schema';
import { eq, and } from 'drizzle-orm';
import { getLeagueId } from '@/lib/getLeagueId';
import { logSystemEvent } from '@/lib/db-helpers';
import { auth } from '@/auth';
import bcrypt from 'bcrypt';

export const dynamic = 'force-dynamic';

export async function GET() {
  const admin = await isAdmin();
  if (!admin) return NextResponse.json({ error: 'Unauthorized' }, { status: 403 });

  const leagueId = await getLeagueId();
  const rows = await db.select().from(teams).where(eq(teams.leagueId, leagueId));
  return NextResponse.json(rows);
}

export async function POST(req: Request) {
  const admin = await isAdmin();
  if (!admin) return NextResponse.json({ error: 'Unauthorized' }, { status: 403 });

  const leagueId = await getLeagueId();
  const body = await req.json();
  const { name, teamshort, coach, email, mobile, nickname, isCommissioner, status } = body;

  if (!name || !teamshort) {
    return NextResponse.json({ error: 'Name and teamshort are required' }, { status: 400 });
  }

  const [row] = await db.insert(teams).values({
    leagueId,
    name: name.trim(),
    teamshort: teamshort.trim().toUpperCase(),
    coach: coach?.trim() || null,
    email: email?.trim() || null,
    mobile: mobile?.trim() || null,
    nickname: nickname?.trim() || null,
    isCommissioner: isCommissioner ?? false,
    status: status || 'active',
    touch_id: 'admin',
  }).returning();

  return NextResponse.json(row, { status: 201 });
}

export async function PATCH(req: Request) {
  const admin = await isAdmin();
  if (!admin) return NextResponse.json({ error: 'Unauthorized' }, { status: 403 });

  const leagueId = await getLeagueId();
  const body = await req.json();
  const { id, name, teamshort, coach, email, mobile, nickname, isCommissioner, status, newPassword } = body;

  if (!id) return NextResponse.json({ error: 'id is required' }, { status: 400 });

  const session = await auth();
  const actor = session?.user?.name || 'admin';

  // Password-only reset
  if (newPassword !== undefined) {
    if (!newPassword || newPassword.length < 4) {
      return NextResponse.json({ error: 'Password must be at least 4 characters.' }, { status: 400 });
    }
    const hashed = await bcrypt.hash(newPassword, 10);
    const target = await db.select({ teamshort: teams.teamshort })
      .from(teams).where(and(eq(teams.id, id), eq(teams.leagueId, leagueId))).limit(1);
    if (!target[0]) return NextResponse.json({ error: 'Team not found.' }, { status: 404 });

    await db.update(teams).set({ password: hashed, touch_id: actor })
      .where(and(eq(teams.id, id), eq(teams.leagueId, leagueId)));
    logSystemEvent(actor, 'admin', 'RESET_PASSWORD', `Reset password for team ${target[0].teamshort}`, leagueId);
    return NextResponse.json({ success: true });
  }

  await db.update(teams).set({
    name: name?.trim(),
    teamshort: teamshort?.trim().toUpperCase(),
    coach: coach?.trim() || null,
    email: email?.trim() || null,
    mobile: mobile?.trim() || null,
    nickname: nickname?.trim() || null,
    isCommissioner: isCommissioner ?? false,
    status: status || 'active',
    touch_id: actor,
  }).where(and(eq(teams.id, id), eq(teams.leagueId, leagueId)));

  logSystemEvent(actor, 'admin', 'UPDATE_TEAM', `Updated team id ${id}`, leagueId);
  return NextResponse.json({ success: true });
}
