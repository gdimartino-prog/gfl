import { NextRequest, NextResponse } from 'next/server';
import { sheets, SHEET_ID } from '@/lib/googleSheets';

export async function GET() {
  try {
    const response = await sheets.spreadsheets.values.get({
      spreadsheetId: SHEET_ID,
      range: 'Config!F2:G2',
    });

    const rows = response.data.values;

    // Safety check: if sheet is empty or row is missing
    if (!rows || !rows[0]) {
      return NextResponse.json({ protected: 30, pullback: 8 });
    }

    return NextResponse.json({
      protected: parseInt(rows[0][0]) || 30,
      pullback: parseInt(rows[0][1]) || 8,
    });
  } catch (error) {
    console.error('Config API Error:', error);
    // Return defaults so the frontend doesn't crash
    return NextResponse.json({ protected: 30, pullback: 8 });
  }
}