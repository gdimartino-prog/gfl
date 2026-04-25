import { put, list } from '@vercel/blob';
import { NextResponse } from 'next/server';
import { updateCoachSync } from '@/lib/config';
import { auth } from "@/auth";
import { logSystemEvent } from '@/lib/db-helpers';
import { getLeagueId } from '@/lib/getLeagueId';
import { db } from '@/lib/db';
import { teams } from '@/schema';
import { eq } from 'drizzle-orm';

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

// 2. POST: Saves the uploaded file from the coach
// Inside app/api/upload/route.ts

export async function POST(request: Request) {
  try {
    const session = await auth();
    
    const { searchParams } = new URL(request.url);
    const filename = searchParams.get('filename');

    if (!filename) {
      return NextResponse.json({ error: "Filename required" }, { status: 400 });
    }

    // 🛡️ SECURITY: Ensure the filename starts with the user's authorized team ID
    // This prevents Coach A from overwriting Coach B's files.
    const teamCode = (session?.user as { id?: string })?.id;
    if (!teamCode || !filename.toUpperCase().startsWith(teamCode.toUpperCase())) {
      return NextResponse.json({ error: "Unauthorized: Filename mismatch with Team ID" }, { status: 403 });
    }

    const blobFile = await request.blob();

    // UPDATED PUT FUNCTION
    const blob = await put(filename, blobFile, {
      access: 'public',
      addRandomSuffix: false, // Prevents "Team_ABC_123.COA"
      allowOverwrite: true,    // PERMITS REPLACING THE OLD FILE
    });

    const leagueId = await getLeagueId();

    // 🚀 SYNC TO GOOGLE SHEETS
    if (teamCode) {
      await updateCoachSync(teamCode);
    }
    logSystemEvent(session?.user?.name || teamCode, teamCode, 'COA_UPLOAD', `Uploaded ${filename}`, leagueId);

    return NextResponse.json(blob);
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Unknown upload error";
    console.error("Upload Error:", message);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}