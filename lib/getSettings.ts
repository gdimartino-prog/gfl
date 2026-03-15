import { sheets, SHEET_ID } from './googleSheets';
import { unstable_cache } from 'next/cache';

export const getSettings = unstable_cache(
  async (): Promise<Record<string, string>> => {
    const response = await sheets.spreadsheets.values.get({
      spreadsheetId: SHEET_ID,
      range: 'Rules!A:B',
    });
    const values = response.data.values || [];
    const settings = values.reduce((acc, row) => {
      if (row[0]) {
        acc[row[0]] = row[1];
      }
      return acc;
    }, {} as Record<string, string>);
    return settings;
  },
  ['settings'],
  { revalidate: 3600 }
);
