import { NextRequest, NextResponse } from 'next/server';
import { sheets, SHEET_ID } from '@/lib/googleSheets';
import { parsePlayers } from '@/lib/players';
import { unstable_cache } from 'next/cache';

// Ensure the route is treated as dynamic to handle search parameters correctly
export const dynamic = 'force-dynamic';

// Create a cached version of the player fetch with a 60-second window
const getCachedPlayers = unstable_cache(
  async () => {
    console.log("Fetching fresh Player data from Google Sheets...");
    const result = await sheets.spreadsheets.values.get({
      spreadsheetId: SHEET_ID,
      range: 'Players!A:CV', 
    });
    return result.data.values || [];
  },
  ['players-master-list'],
  { 
    revalidate: 60, // FIX: Cache for 60 seconds to prevent Quota Exceeded errors
    tags: ['players'] 
  } 
);

export async function GET(req: NextRequest) {
  const teamShort = req.nextUrl.searchParams.get('team');

  try {
    const rows = await getCachedPlayers();
    
    if (!rows || rows.length === 0) {
      return NextResponse.json([]);
    }

    // Standardize parsing using your existing library logic
    const players = parsePlayers(rows);

    // If a specific team is requested (e.g., ?team=VV), filter server-side
    if (teamShort) {
      const filtered = players.filter((p) => 
        p.team?.trim().toUpperCase() === teamShort.trim().toUpperCase()
      );
      return NextResponse.json(filtered);
    }

    return NextResponse.json(players);
  } catch (err: any) {
    console.error('API Error (Players):', err.message);
    // Return a JSON error so the frontend catch block can handle it
    return NextResponse.json(
      { error: 'Failed to fetch players from Google Sheets' }, 
      { status: 500 }
    );
  }
}