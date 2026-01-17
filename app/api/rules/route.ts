import { google } from 'googleapis';
import { NextResponse } from 'next/server';

export async function GET() {
  try {
    const auth = new google.auth.GoogleAuth({
      credentials: {
        client_email: process.env.GOOGLE_CLIENT_EMAIL,
        private_key: process.env.GOOGLE_PRIVATE_KEY?.replace(/\\n/g, '\n'),
      },
      scopes: ['https://www.googleapis.com/auth/spreadsheets.readonly'],
    });

    const sheets = google.sheets({ version: 'v4', auth });
    
    // Specifically targeting the new "Rules" sheet
    const range = 'Rules!A:B'; 
    const response = await sheets.spreadsheets.values.get({
      spreadsheetId: process.env.GOOGLE_SHEET_ID,
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