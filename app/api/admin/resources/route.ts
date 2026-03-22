import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/auth';
import { isAdmin, isCommissioner } from '@/lib/auth';
import { db } from '@/lib/db';
import { resources } from '@/schema';
import { asc, eq, and } from 'drizzle-orm';
import { getLeagueId } from '@/lib/getLeagueId';

export const dynamic = 'force-dynamic';

export async function GET() {
  const session = await auth();
  if (!session?.user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  const authorized = await isAdmin() || await isCommissioner();
  if (!authorized) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

  const leagueId = await getLeagueId();
  const rows = await db.select().from(resources).where(eq(resources.leagueId, leagueId)).orderBy(asc(resources.sortOrder), resources.group, resources.title);
  return NextResponse.json(rows);
}

export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session?.user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  const authorized = await isAdmin() || await isCommissioner();
  if (!authorized) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

  const { title, url, group, sortOrder } = await req.json();
  if (!title?.trim()) return NextResponse.json({ error: 'Title is required' }, { status: 400 });

  const leagueId = await getLeagueId();
  const [row] = await db.insert(resources).values({
    leagueId,
    title: title.trim(),
    url: url?.trim() || null,
    group: group?.trim() || 'General',
    sortOrder: Number(sortOrder) || 0,
    touch_id: session.user.name || 'admin',
  }).returning();

  return NextResponse.json(row);
}

export async function PATCH(req: NextRequest) {
  const session = await auth();
  if (!session?.user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  const authorized = await isAdmin() || await isCommissioner();
  if (!authorized) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

  const { id, title, url, group, sortOrder } = await req.json();
  if (!id) return NextResponse.json({ error: 'id required' }, { status: 400 });
  if (!title?.trim()) return NextResponse.json({ error: 'Title is required' }, { status: 400 });

  const leagueId = await getLeagueId();
  await db.update(resources).set({
    title: title.trim(),
    url: url?.trim() || null,
    group: group?.trim() || 'General',
    sortOrder: Number(sortOrder) || 0,
    touch_id: session.user.name || 'admin',
  }).where(and(eq(resources.id, id), eq(resources.leagueId, leagueId)));

  return NextResponse.json({ success: true });
}

export async function DELETE(req: NextRequest) {
  const session = await auth();
  if (!session?.user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  const authorized = await isAdmin() || await isCommissioner();
  if (!authorized) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

  const { id } = await req.json();
  if (!id) return NextResponse.json({ error: 'id required' }, { status: 400 });

  const leagueId = await getLeagueId();
  await db.delete(resources).where(and(eq(resources.id, id), eq(resources.leagueId, leagueId)));
  return NextResponse.json({ success: true });
}
