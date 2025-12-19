import { sheets, SHEET_ID } from './googleSheets';

type Transaction = {
  type: 'ADD' | 'DROP' | 'IR' | 'TRADE';
  identity: string;
  fromTeam?: string;
  toTeam?: string;
  coach: string;
};

export async function logTransaction(tx: Transaction) {
  const timestamp = new Date().toISOString();

  await sheets.spreadsheets.values.append({
    spreadsheetId: SHEET_ID,
    range: 'Transactions',
    valueInputOption: 'RAW',
    requestBody: {
      values: [[
        timestamp,
        tx.type,
        tx.identity,
        tx.fromTeam || '',
        tx.toTeam || '',
        tx.coach,
        tx.type === 'TRADE' ? 'PENDING' : 'INSTANT'
      ]],
    },
  });
}
