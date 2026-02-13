import { NextResponse } from 'next/server';
import { getSheetsClient } from '@/lib/google-cloud';

export async function GET() {
  try {
    const sheets = getSheetsClient();
    const SHEET_ID = process.env.GOOGLE_SHEET_ID;

    const result = await sheets.spreadsheets.values.get({
      spreadsheetId: SHEET_ID,
      range: 'Players',
    });

    return NextResponse.json({
      success: true,
      rows: result.data.values,
    });
  } catch (error: unknown) {
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Internal Server Error',
      },
      { status: 500 }
    );
  }
}
