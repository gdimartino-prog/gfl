import { getSheetsClient } from './google-cloud';
import { unstable_cache } from 'next/cache';

export async function getResources() {
  return unstable_cache(
    async () => {
      const sheets = getSheetsClient();
      const SHEET_ID = process.env.GOOGLE_SHEET_ID;

      try {
        const response = await sheets.spreadsheets.values.get({
          spreadsheetId: SHEET_ID,
          range: 'Resources!A2:C100', 
        });

        const rows = response.data.values || [];
        
        return rows.reduce((acc: Record<string, { name: string; url: string }[]>, [group, name, url]) => {
          if (!acc[group]) acc[group] = [];
          acc[group].push({ name, url });
          return acc;
        }, {});
      } catch (error) {
        console.error("❌ Google Sheets Resources Error:", error);
        return {};
      }
    },
    ['resources-data'],
    { revalidate: 60, tags: ['resources'] }
  )();
}