import { getSheetsClient } from './google-cloud';
import { unstable_cache } from 'next/cache';
import { Team } from '@/types';

export async function getStandings(): Promise<Team[]> {
  return unstable_cache(
    async () => {
      const sheets = getSheetsClient();
      const SHEET_ID = process.env.GOOGLE_SHEET_ID;

      try {
        const response = await sheets.spreadsheets.values.get({
          spreadsheetId: SHEET_ID,
          range: 'Coaches!A:G', // Expanded range to include Column G
        });

        const rows = response.data.values || [];
        if (rows.length === 0) return [];

        const headers = rows[0];

        return rows.slice(1).map((row) => {
          const teamObj: Record<string, string> = {};
          
          headers.forEach((header, i) => {
            if (header) {
              const key = header.toLowerCase().trim();
              teamObj[key] = row[i] || '';
            }
          });

          // Explicitly mapping key fields to ensure UI consistency
          return {
            ...teamObj,
            name: row[0],       // e.g., "Vico"
            short: row[1],      // e.g., "VV"
            team: row[0],       // e.g., "Vico"
            teamshort: row[1],  // e.g., "VV"
            coach: row[2],      // e.g., "George Di Martino"
            nickname: row[6]    // e.g., "Vikes" from Column G
          };
        });
      } catch (error) {
        console.error("getStandings Lib Error:", error);
        return [];
      }
    },
    ['standings-data'],
    { revalidate: 60, tags: ['standings'] }
  )();
}