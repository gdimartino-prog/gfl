import { NextResponse } from 'next/server';
import { sheets, SHEET_ID } from '@/lib/googleSheets';
import { parsePlayers } from '@/lib/players';
import { executeFreeAgentMove } from '@/lib/freeAgency';

export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    console.log("DEBUG: Initializing Free Agent Fetch from SHEET_ID:", SHEET_ID);
    
    // Fetch the wide range to capture all Action PC columns (A to CV)
    const result = await sheets.spreadsheets.values.get({
      spreadsheetId: SHEET_ID,
      range: 'Players!A:CV', 
    });

    const rows = result.data.values || [];
    
    if (rows.length === 0) {
      console.warn("DEBUG: No data returned from Google Sheets 'Players' tab.");
      return NextResponse.json([]);
    }

    // 1. Parse using our dynamic header-based parser in lib/players.ts
    const allPlayers = parsePlayers(rows);

    // 2. Filter for Free Agents (Case-insensitive 'FA')
    // Added safety check (p && p.team) to prevent crashes on empty rows
    const freeAgents = allPlayers.filter(
      (p) => p && p.team && p.team.trim().toUpperCase() === 'FA'
    );

    console.log(`✅ Success: Found ${allPlayers.length} total players, ${freeAgents.length} are Free Agents.`);

    return NextResponse.json(freeAgents);
  } catch (error: any) {
    console.error('❌ Free Agent API Error:', error.message);
    return NextResponse.json(
      { error: 'Failed to fetch free agents', details: error.message },
      { status: 500 }
    );
  }
}

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const { team, addIdentity, dropIdentity } = body;

    // Validation for Free Agent moves (Drafting/Signing)
    if (!team || !addIdentity || !dropIdentity) {
      return NextResponse.json(
        { error: 'Missing required fields: team, addIdentity, or dropIdentity' },
        { status: 400 }
      );
    }

    // executeFreeAgentMove handles the Google Sheets row updates
    await executeFreeAgentMove(team, addIdentity, dropIdentity);

    return NextResponse.json({ success: true });
  } catch (err: any) {
    console.error('❌ Free agency POST error:', err.message);
    return NextResponse.json(
      { error: err.message },
      { status: 500 }
    );
  }
}