import { getSheetsClient } from './google-cloud';
import { unstable_cache } from 'next/cache';

export type Coach = {
  coach: string;
  team: string;
  teamshort: string;
  nickname: string;
  isCommissioner: boolean;
  status: string;
  mobile: string;
  email: string;
  lastSync: string;
};

// Reads config tab and returns all coaches
export async function getCoaches(): Promise<Coach[]> {
  return unstable_cache(
    async () => {
      const sheets = getSheetsClient();
      const SHEET_ID = process.env.GOOGLE_SHEET_ID;

      try {
        const res = await sheets.spreadsheets.values.get({
          spreadsheetId: SHEET_ID,
          range: 'Coaches!A:J',
        });

        const rows = res.data.values || [];

        return rows.slice(1).map(r => ({
          team: r[0] || '',
          teamshort: r[1] || '',
          coach: r[2] || '',
          nickname: r[6] || '',
          isCommissioner: r[3] === 'TRUE' || r[3] === 'true',
          mobile: r[4] || '',
          status: (r[5] || '').toLowerCase().trim(),
          lastSync: r[8] || '',
          email: r[9] || '',
        }));
      } catch (error) {
        console.error("getCoaches Error:", error);
        return [];
      }
    },
    ['coaches-data'],
    { revalidate: 60, tags: ['coaches'] }
  )();
}

/**
 * Updates coach contact information in the Coaches tab
 */
export async function updateCoachContact(teamCode: string, mobile: string, email: string) {
  const sheets = getSheetsClient();
  const SHEET_ID = process.env.GOOGLE_SHEET_ID;

  try {
    const response = await sheets.spreadsheets.values.get({
      spreadsheetId: SHEET_ID,
      range: 'Coaches!A:B',
    });

    const rows = response.data.values || [];
    const rowIndex = rows.findIndex(row => 
      row[1]?.toString().trim().toUpperCase() === teamCode.trim().toUpperCase()
    );

    if (rowIndex === -1) return { success: false, error: 'Team not found' };

    // Update Column E (Mobile - Index 4) and Column J (Email - Index 9)
    const updates = [
      { range: `Coaches!E${rowIndex + 1}`, values: [[mobile]] },
      { range: `Coaches!J${rowIndex + 1}`, values: [[email]] }
    ];

    for (const update of updates) {
      await sheets.spreadsheets.values.update({
        spreadsheetId: SHEET_ID,
        range: update.range,
        valueInputOption: 'RAW',
        requestBody: { values: update.values }
      });
    }

    return { success: true };
  } catch (error) {
    console.error("❌ Failed to update coach contact:", error);
    return { success: false };
  }
}

/**
 * Updates the last_sync timestamp for a specific coach in the Coaches tab (Column I)
 */
export async function updateCoachSync(teamCode: string) {
  const sheets = getSheetsClient();
  const SHEET_ID = process.env.GOOGLE_SHEET_ID;

  try {
    const response = await sheets.spreadsheets.values.get({
      spreadsheetId: SHEET_ID,
      range: 'Coaches!A:B',
    });

    const rows = response.data.values || [];
    const rowIndex = rows.findIndex(row => 
      row[1]?.toString().trim().toUpperCase() === teamCode.trim().toUpperCase()
    );

    if (rowIndex === -1) {
      console.error(`❌ updateCoachSync: Team ${teamCode} not found.`);
      return { success: false };
    }

    const now = new Date();
    const mm = String(now.getMonth() + 1).padStart(2, '0');
    const dd = String(now.getDate()).padStart(2, '0');
    const yyyy = now.getFullYear();
    const hh = String(now.getHours()).padStart(2, '0');
    const min = String(now.getMinutes()).padStart(2, '0');
    const ss = String(now.getSeconds()).padStart(2, '0');
    const timestamp = `${mm}/${dd}/${yyyy} ${hh}:${min}:${ss}`;

    await sheets.spreadsheets.values.update({
      spreadsheetId: SHEET_ID,
      range: `Coaches!I${rowIndex + 1}`, // Column I is the 9th column
      valueInputOption: 'RAW',
      requestBody: { values: [[timestamp]] }
    });

    return { success: true, timestamp };
  } catch (error) {
    console.error("❌ Failed to update coach sync timestamp:", error);
    return { success: false };
  }
}
