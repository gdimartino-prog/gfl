import { put, list } from '@vercel/blob';
import { NextResponse } from 'next/server';
import { updateCoachSync } from '@/lib/config';
import { auth } from "@/auth";
import { logSystemEvent } from '@/lib/db-helpers';
import { getLeagueId } from '@/lib/getLeagueId';
import { db } from '@/lib/db';
import { teams } from '@/schema';
import { eq, and, sql } from 'drizzle-orm';

const MAX_COA_BYTES = 2 * 1024 * 1024; // 2MB — .COA files are small text exports

// 1. GET: Fetches the list of .COA files for the current league's teams only
export async function GET() {
  const session = await auth();
  if (!session?.user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  try {
    const leagueId = await getLeagueId();

    // Get team names for this league to filter blobs
    const leagueTeams = await db
      .select({ name: teams.name })
      .from(teams)
      .where(eq(teams.leagueId, leagueId));

    const leagueFileNames = new Set(
      leagueTeams.map(t => t.name.replace(/\s+/g, '_').toUpperCase() + '.COA')
    );

    const { blobs } = await list();
    const coachFiles = blobs.filter(f => {
      const fileName = f.pathname.split('/').pop() || '';
      return fileName.toLowerCase().endsWith('.coa') && leagueFileNames.has(fileName.toUpperCase());
    });

    return NextResponse.json(coachFiles);
  } catch {
    return NextResponse.json({ error: "Failed to list files" }, { status: 500 });
  }
}

// 2. POST: Saves the uploaded .COA file from the coach.
// The blob filename is derived server-side from the caller's own team, so a
// coach can only ever write their own <TEAM_NAME>.COA. Admins/commissioners
// may upload for any team in their league by passing ?team=<teamshort>.
export async function POST(request: Request) {
  try {
    const session = await auth();
    if (!session?.user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const callerTeamshort = (session.user as { id?: string }).id || '';
    const role = (session.user as { role?: string }).role || '';
    const privileged = role === 'superuser' || role === 'admin';
    const leagueId = await getLeagueId();

    const { searchParams } = new URL(request.url);
    const requestedTeam = searchParams.get('team');
    const targetTeamshort = privileged && requestedTeam ? requestedTeam : callerTeamshort;
    if (!targetTeamshort) {
      return NextResponse.json({ error: 'No team associated with this session' }, { status: 400 });
    }

    // Resolve the team's full name in this league — the blob name comes from
    // the DB, never from client input.
    const teamRow = await db
      .select({ name: teams.name })
      .from(teams)
      .where(and(
        eq(teams.leagueId, leagueId),
        sql`upper(${teams.teamshort}) = ${targetTeamshort.toUpperCase()}`,
      ))
      .limit(1);
    if (!teamRow[0]) return NextResponse.json({ error: 'Team not found' }, { status: 404 });

    const filename = teamRow[0].name.replace(/\s+/g, '_').toUpperCase() + '.COA';

    const blobFile = await request.blob();
    if (blobFile.size === 0) {
      return NextResponse.json({ error: 'Empty file' }, { status: 400 });
    }
    if (blobFile.size > MAX_COA_BYTES) {
      return NextResponse.json({ error: 'File too large (max 2MB)' }, { status: 413 });
    }

    const blob = await put(filename, blobFile, {
      access: 'public',
      addRandomSuffix: false, // Prevents "Team_ABC_123.COA"
      allowOverwrite: true,    // PERMITS REPLACING THE OLD FILE
    });

    await updateCoachSync(targetTeamshort, leagueId);
    await logSystemEvent(session.user.name || callerTeamshort, callerTeamshort, 'COA_UPLOAD', `Uploaded ${filename}`, leagueId);

    return NextResponse.json(blob);
  } catch (error: unknown) {
    console.error("Upload Error:", error instanceof Error ? error.message : error);
    return NextResponse.json({ error: 'Upload failed' }, { status: 500 });
  }
}
