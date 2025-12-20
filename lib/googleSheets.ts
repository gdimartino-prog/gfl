import { google } from 'googleapis';

const auth = new google.auth.JWT({
  email: process.env.GOOGLE_CLIENT_EMAIL,
  key: process.env.GOOGLE_PRIVATE_KEY?.replace(/\\n/g, '\n'),
  scopes: ['https://www.googleapis.com/auth/spreadsheets'],
});

export const sheets = google.sheets({
  version: 'v4',
  auth,
});

export const SHEET_ID = process.env.GOOGLE_SHEET_ID!;

if (
  !process.env.GOOGLE_CLIENT_EMAIL ||
  !process.env.GOOGLE_PRIVATE_KEY ||
  !process.env.GOOGLE_SHEET_ID
) {
  throw new Error('Missing Google Sheets environment variables');
}
