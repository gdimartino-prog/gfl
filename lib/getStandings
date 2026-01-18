import { sheets, SHEET_ID } from './googleSheets';

export async function getStandings() {
  try {
    const response = await sheets.spreadsheets.values.get({
      spreadsheetId: SHEET_ID,
      range: 'Coaches!A:G', // Expanded range to include Column G
    });

    const rows = response.data.values || [];
    if (rows.length === 0) return [];

    const headers = rows[0];

    return rows.slice(1).map((row) => {
      const teamObj = {}; 
      
      headers.forEach((header, i) => {
        if (header) {
          const key = header.toLowerCase().trim();
          teamObj[key] = row[i] || '';
        }
      });

      // Explicitly mapping key fields to ensure UI consistency
      return {
        ...teamObj,
        team: row[0],       // e.g., "Vico"
        teamshort: row[1],  // e.g., "VV"
        coach: row[2],      // e.g., "George Di Martino"
        nickname: row[6]    // e.g., "Vikes" from Column G
      };
    });
  } catch (error) {
    console.error("getStandings Lib Error:", error);
    throw error;
  }
}