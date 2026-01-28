import { NextRequest, NextResponse } from 'next/server';
import { sheets, SHEET_ID } from '@/lib/googleSheets';
import { buildPlayerIdentity } from '@/lib/players';
import { unstable_cache } from 'next/cache';

export const dynamic = 'force-dynamic';

// Master Cache for Full Data (A:CV)
const getCachedPlayersFull = unstable_cache(
  async () => {
    console.log("Full Cache Expired: Fetching A:CV from Google...");
    const result = await sheets.spreadsheets.values.get({
      spreadsheetId: SHEET_ID,
      range: 'Players!A:CV', 
    });
    return result.data.values || [];
  },
  ['players-full'],
  { revalidate: 60, tags: ['players'] } 
);

// Master Cache for Light Data (A:I)
const getCachedPlayersLight = unstable_cache(
  async () => {
    console.log("Light Cache Expired: Fetching A:I from Google...");
    const result = await sheets.spreadsheets.values.get({
      spreadsheetId: SHEET_ID,
      range: 'Players!A:I', 
    });
    return result.data.values || [];
  },
  ['players-light'],
  { revalidate: 10, tags: ['players'] }
);

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const view = searchParams.get('view');
  const teamFilter = searchParams.get('team');
  const forceFresh = searchParams.get('t'); // Detect cache-busting timestamp

  try {
    const isLight = view === 'light';
    let rows: any[][] | null = null;

    // 🚀 CACHE BUSTER LOGIC
    if (forceFresh) {
      // If a timestamp is provided, bypass cache and go straight to Google
      console.log(`Force Fresh: Bypassing cache for ${isLight ? 'Light' : 'Full'} view.`);
      const range = isLight ? 'Players!A:I' : 'Players!A:CV';
      const result = await sheets.spreadsheets.values.get({
        spreadsheetId: SHEET_ID,
        range: range,
      });
      rows = result.data.values || [];
    } else {
      // Otherwise, use the standard cached versions
      rows = isLight ? await getCachedPlayersLight() : await getCachedPlayersFull();
    }
    
    if (!rows || rows.length === 0) return NextResponse.json([]);

    // 1. Process Light View
    if (isLight) {
      return NextResponse.json(rows.slice(1).map((row: any) => {
        const pData = {
          team: (row[0] || '').trim().toUpperCase(),
          first: row[2] || '',   
          last: row[3] || '',    
          age: row[5] || '',     
          offense: row[6] || '', 
          defense: row[7] || '', 
          special: row[8] || '', 
        };

        return {
          ...pData,
          name: `${pData.first} ${pData.last}`,
          pos: [pData.offense, pData.defense, pData.special].filter(v => v && v !== '0').join('/'),
          identity: buildPlayerIdentity(pData) 
        };
      }));
    }

    // 2. Process Team Filter (Used by Rosters/Transactions)
    if (teamFilter) {
      const header = rows[0];
      const filtered = rows.slice(1).filter(row => 
        row[0]?.toString().toUpperCase() === teamFilter.toUpperCase()
      );
      return NextResponse.json([header, ...filtered]);
    }

    // Default: Return Full Rows
    return NextResponse.json(rows);
    
  } catch (err: any) {
    console.error('API Error (Players):', err.message);
    return NextResponse.json({ error: 'Failed to fetch' }, { status: 500 });
  }
}