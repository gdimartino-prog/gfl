import { NextResponse } from 'next/server';
import { sheets, SHEET_ID } from '../../../lib/googleSheets';

export async function GET() {
  try {
    const result = await sheets.spreadsheets.values.get({
      spreadsheetId: SHEET_ID,
      range: 'Players',
    });

    return NextResponse.json({
      success: true,
      rows: result.data.values,
    });
  } catch (error: any) {
    return NextResponse.json(
      {
        success: false,
        error: error.message,
      },
      { status: 500 }
    );
  }
}
