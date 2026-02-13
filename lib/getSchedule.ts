import { getSheetsClient } from './google-cloud';
import { unstable_cache } from 'next/cache'; // Add this import

export async function getSchedule() {
  // Wrap the entire fetch logic in a cache function
  return unstable_cache(
    async () => {
      const sheets = getSheetsClient();
      
      try {
        console.log("Fetching fresh schedule from Google...");
        const response = await sheets.spreadsheets.values.get({
          spreadsheetId: process.env.GOOGLE_SHEET_ID,
          range: 'Schedule!A:G', 
        });

        const [, ...rows] = response.data.values || [];
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
    },
    ['schedule-data'], // Cache Key
    { revalidate: 60, tags: ['schedule'] } // Cache for 60 seconds
  )();
}