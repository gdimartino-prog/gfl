import { put, list } from '@vercel/blob';
import { NextResponse } from 'next/server';
import { updateCoachSync } from '@/lib/config';
import { auth } from "@/auth";
import { isPrivileged } from '@/lib/auth';
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

    // Match this league's prefixed keys ("<leagueId>/NAME.COA") plus legacy
    // unprefixed keys from before league scoping. Full-path matching — a
    // basename-only check would surface another league's same-named team.
    const { blobs } = await list();
    const coachFiles = blobs.filter(f => {
      const path = f.pathname.toUpperCase();
      for (const name of leagueFileNames) {
        // Unprefixed legacy keys belong to GFL (league 1) only — other
        // leagues use "<leagueId>/NAME.COA" and must not see GFL's files
        // when a team name happens to repeat across leagues.
        if (leagueId === 1 && path === name) return true;
        if (path === `${leagueId}/${name}`) return true;
      }
      return false;
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
    const privileged = await isPrivileged();
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

    // League-prefixed key — team names repeat across leagues, and
    // allowOverwrite on a shared key would let one league clobber another's
    // file. GFL (league 1) keeps legacy unprefixed keys so existing files
    // and download links stay valid.
    // Strip path separators — a team name containing "/" could otherwise
    // collide with another league's prefixed key.
    const baseName = teamRow[0].name.replace(/[/\\]/g, '').replace(/\s+/g, '_').toUpperCase() + '.COA';
    const filename = leagueId === 1 ? baseName : `${leagueId}/${baseName}`;

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
