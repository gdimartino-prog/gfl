import { sheets, SHEET_ID } from './googleSheets';

export type Coach = {
  coach: string;
  team: string;
  teamshort: string;
  isCommissioner: boolean;
};

// Reads config tab and returns all coaches
export async function getCoaches(): Promise<Coach[]> {
  const res = await sheets.spreadsheets.values.get({
    spreadsheetId: SHEET_ID,
    range: 'Config',
  });

  const rows = res.data.values || [];

  // Assuming columns: team | teamshort | coach | isCommissioner
  const coaches: Coach[] = rows.slice(1).map(r => ({
    team: r[0] || '',
    teamshort: r[1] || '',
    coach: r[2] || '',
    isCommissioner: r[3] === 'TRUE' || r[3] === 'true',
  }));

  return coaches;
}
