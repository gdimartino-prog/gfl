import { getSheetsClient } from '@/lib/google-cloud';
import { NextResponse } from 'next/server';

export async function GET() {
  try {
    const sheets = getSheetsClient();
    const SHEET_ID = process.env.GOOGLE_SHEET_ID;
    
    // Specifically targeting the new "Rules" sheet
    const range = 'Rules!A:B'; 
    const response = await sheets.spreadsheets.values.get({
      spreadsheetId: SHEET_ID,
      range: range,
    });

     const rows = response.data.values ? response.data.values.slice(1) : [];
    
    if (!rows) return NextResponse.json([], { status: 200 });

    // Transform rows into a clean object array
    const rules = rows.map(([setting, value]) => ({
      setting: setting?.toString().trim().toLowerCase(),
      value: value?.toString().trim()
    }));

    return NextResponse.json(rules, {
      headers: { 
        'Cache-Control': 'no-store, max-age=0',
        'Content-Type': 'application/json'
      }
    });
  } catch (error) {
    console.error('Rules API Error:', error);
    return NextResponse.json({ error: 'Failed to fetch rules' }, { status: 500 });
  }
}