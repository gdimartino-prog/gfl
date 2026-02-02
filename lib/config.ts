import { sheets, SHEET_ID } from './googleSheets';

export type Coach = {
  coach: string;
  team: string;
  teamshort: string;
  isCommissioner: boolean;
  status: string;
  lastSync: string;
};

// Reads config tab and returns all coaches
export async function getCoaches(): Promise<Coach[]> {
  const res = await sheets.spreadsheets.values.get({
    spreadsheetId: SHEET_ID,
    range: 'Coaches',
  });

  const rows = res.data.values || [];

  // Assuming columns: team | teamshort | coach | isCommissioner
  const coaches: Coach[] = rows.slice(1).map(r => ({
    team: r[0] || '',
    teamshort: r[1] || '',
    coach: r[2] || '',
    isCommissioner: r[3] === 'TRUE' || r[3] === 'true',
    status: (r[5] || '').toLowerCase().trim(),
    lastSync: r[8] || '',
  }));

  return coaches;
}

/**
 * Updates the last_sync timestamp for a specific coach in the Coaches tab (Column I)
 */
export async function updateCoachSync(teamCode: string) {
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
