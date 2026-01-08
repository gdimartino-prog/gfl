import { NextRequest, NextResponse } from 'next/server';
import { sheets, SHEET_ID } from '@/lib/googleSheets';

export async function GET() {
  try {
    const response = await sheets.spreadsheets.values.get({
      spreadsheetId: SHEET_ID,
      range: 'Config!F2:G10',
    });

    const rows = response.data.values || [];

    // Transform rows into a key-value object
    const config = rows.reduce((acc, [key, val]) => {
      if (key) acc[key.trim()] = String(val).trim();
      return acc;
    }, {} as Record<string, string>);

    return NextResponse.json({
      cuts_year: config.cuts_year || '2025',
      draft_year: config.draft_year || '2026',
      protected: parseInt(config.limit_protected) || 30,
      pullback: parseInt(config.limit_pullback) || 8,
    });
  } catch (error) {
    console.error('Config API Error:', error);
    return NextResponse.json({ 
      cuts_year: '2025', 
      draft_year: '2026', 
      protected: 30, 
      pullback: 8 
    });
  }
}