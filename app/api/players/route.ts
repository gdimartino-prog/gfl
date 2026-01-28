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
  const forceFresh = searchParams.get('t');

  try {
    const isLight = view === 'light';
    let rows: any[][] | null = null;

    // 1. Fetch Data (Bypass cache if 't' parameter is present)
    if (forceFresh) {
      const range = isLight ? 'Players!A:I' : 'Players!A:CV';
      const result = await sheets.spreadsheets.values.get({
        spreadsheetId: SHEET_ID,
        range: range,
      });
      rows = result.data.values || [];
    } else {
      rows = isLight ? await getCachedPlayersLight() : await getCachedPlayersFull();
    }
    
    if (!rows || rows.length === 0) return NextResponse.json([]);

    const header = rows[0];

    // 🚀 FILTER: Remove rows that don't have a First (idx 2) or Last (idx 3) name.
    // This prevents "metadata" or empty rows from creating the '|||||' key crash.
    const activeRows = rows.filter((row, idx) => {
      if (idx === 0) return true; // Keep header
      return row[2]?.toString().trim() && row[3]?.toString().trim();
    });

    // 2. Process Data into Objects
    // This ensures consistency between views and protects against spreadsheet column shifts.
    const processedPlayers = activeRows.slice(1).map((row) => {
      const pData: any = {};
      header.forEach((key: string, index: number) => {
        const cleanKey = key.toLowerCase().trim();
        pData[cleanKey] = row[index]?.toString().trim() || '';
      });

      return {
        ...pData,
        name: `${pData.first || ''} ${pData.last || ''}`.trim(),
        // pos logic: handles '0' values or empty position fields
        pos: [pData.offense, pData.defense, pData.special].filter(v => v && v !== '0').join('/'),
        identity: buildPlayerIdentity(pData)
      };
    });

    // 3. Handle Returns based on view/filter
    if (isLight) {
      return NextResponse.json(processedPlayers);
    }

    if (teamFilter) {
      const filtered = processedPlayers.filter(p => 
        p.team?.toString().toUpperCase() === teamFilter.toUpperCase()
      );
      return NextResponse.json(filtered);
    }

    // Default: Return [HeaderRow, ...ObjectArray] 
    // The Draft page needs the header array at [0] for index lookups.
    return NextResponse.json([header, ...processedPlayers]);
    
  } catch (err: any) {
    console.error('API Error (Players):', err.message);
    return NextResponse.json({ error: 'Failed to fetch' }, { status: 500 });
  }
}