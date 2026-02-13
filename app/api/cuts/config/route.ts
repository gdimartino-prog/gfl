import { NextResponse } from 'next/server';
import { getSheetsClient } from '@/lib/google-cloud';

export async function GET() {
  try {
    const sheets = getSheetsClient();
    const SHEET_ID = process.env.GOOGLE_SHEET_ID;

    // Expanded range to G20 just to be safe for future config additions
    const response = await sheets.spreadsheets.values.get({
      spreadsheetId: SHEET_ID,
      range: 'Config!F2:G20',
    });

    const rows = response.data.values || [];

    // Transform rows into a key-value object
    const config = rows.reduce((acc, [key, val]) => {
      if (key) acc[key.trim().toLowerCase()] = String(val).trim();
      return acc;
    }, {} as Record<string, string>);

    return NextResponse.json({
      cuts_year: config.cuts_year || '2025',
      draft_year: config.draft_year || '2026',
      protected: parseInt(config.limit_protected) || 30,
      pullback: parseInt(config.limit_pullback) || 8,
      // Add the new date field here
      cuts_due_date: config.cuts_due_date || '', 
    });
  } catch (error) {
    console.error('Config API Error:', error);
    return NextResponse.json({ 
      cuts_year: '2025', 
      draft_year: '2026', 
      protected: 30, 
      pullback: 8,
      cuts_due_date: ''
    });
  }
}