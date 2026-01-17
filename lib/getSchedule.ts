import { google } from 'googleapis';

export const dynamic = 'force-dynamic';

export async function getSchedule() {
  const auth = new google.auth.GoogleAuth({
    credentials: {
      client_email: process.env.GOOGLE_CLIENT_EMAIL,
      private_key: process.env.GOOGLE_PRIVATE_KEY?.replace(/\\n/g, '\n'),
    },
    scopes: ['https://www.googleapis.com/auth/spreadsheets.readonly'],
  });

  const sheets = google.sheets({ version: 'v4', auth });
  
  try {
    const response = await sheets.spreadsheets.values.get({
      spreadsheetId: process.env.GOOGLE_SHEET_ID,
      range: 'Schedule!A:G', 
    });

    const [headers, ...rows] = response.data.values || [];
    return rows.map((row) => ({
      year: row[0],
      week: row[1],
      visitor: row[2],
      home: row[3],
      vScore: row[4] || null,
      hScore: row[5] || null,
      status: row[6] || (row[4] ? 'Final' : 'Scheduled'),
    }));
  } catch (err) {
    console.error("Schedule Fetch Error:", err);
    return [];
  }
}