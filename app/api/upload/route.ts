import { put, list } from '@vercel/blob';
import { NextResponse } from 'next/server';

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

    return NextResponse.json(blob);
  } catch (error: any) {
    console.error("Upload Error:", error.message);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}