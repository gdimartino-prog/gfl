import { getSheetsClient } from './google-cloud';

export const sheets = getSheetsClient();

export const SHEET_ID = process.env.GOOGLE_SHEET_ID!;

if (
  !process.env.GOOGLE_SHEET_ID
) {
  throw new Error('Missing GOOGLE_SHEET_ID environment variable');
}


export async function logSystemEvent(coach: string, team: string, action: string, details: string = "") {
  try {
    const timestamp = new Date().toLocaleString('en-US', { timeZone: 'America/New_York' });
    
    await sheets.spreadsheets.values.append({
      spreadsheetId: SHEET_ID,
      range: "AuditLog!A:E", // Target your new tab
      valueInputOption: "RAW",
      requestBody: {
        values: [[timestamp, coach, team, action, details]],
      },
    });
  } catch (error) {
    console.error("Audit Log Failure:", error);
  }
}