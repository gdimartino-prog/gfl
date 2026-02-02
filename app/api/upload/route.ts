import { put, list } from '@vercel/blob';
import { NextResponse } from 'next/server';
import { updateCoachSync } from '@/lib/config';
import { auth } from "@/auth";

// 1. GET: Fetches the list of all .COA files for the Opponent Intelligence hub
export async function GET() {
  try {
    const { blobs } = await list();
    // Defensive filter: only show .COA files (case-insensitive)
    const coachFiles = blobs.filter(f => f.pathname.toLowerCase().endsWith('.coa'));
    return NextResponse.json(coachFiles);
  } catch (error) {
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

    const blobFile = await request.blob();

    // UPDATED PUT FUNCTION
    const blob = await put(filename, blobFile, {
      access: 'public',
      addRandomSuffix: false, // Prevents "Team_ABC_123.COA"
      allowOverwrite: true,    // PERMITS REPLACING THE OLD FILE
    });

    // 🚀 SYNC TO GOOGLE SHEETS
    // If we have a session, use the user's ID (team short code) to update the timestamp in Coaches tab
    if (session?.user) {
      const teamCode = (session.user as any).id;
      if (teamCode) await updateCoachSync(teamCode);
    }

    return NextResponse.json(blob);
  } catch (error: any) {
    console.error("Upload Error:", error.message);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}