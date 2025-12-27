import { sheets, SHEET_ID } from './googleSheets';

type Transaction = {
  type: 'ADD' | 'DROP' | 'IR' | 'TRADE';
  identity: string;
  fromTeam?: string;
  toTeam?: string;
  coach: string;
};

function capitalize(word: string) {
  if (!word) return '';
  return word.charAt(0).toUpperCase() + word.slice(1).toLowerCase();
}

// Keep this for ADD/DROP/IR logic
function formatMessage(identity: string) {
  // If the string doesn't look like a raw pipe-delimited ID, 
  // or if it's already a formatted list, return it as is.
  if (!identity.includes('|')) return identity;

  const [first, last, , off, def] = identity.split('|');
  const positionRaw = off || def || '';
  const position = positionRaw.toUpperCase();
  const firstName = capitalize(first);
  const lastName = capitalize(last);

  return `${position} - ${firstName} ${lastName}`;
}

function formatTimestamp(date: Date) {
  const mm = String(date.getMonth() + 1).padStart(2, '0');
  const dd = String(date.getDate()).padStart(2, '0');
  const yyyy = date.getFullYear();
  
  const hh = String(date.getHours()).padStart(2, '0');
  const min = String(date.getMinutes()).padStart(2, '0');
  const ss = String(date.getSeconds()).padStart(2, '0');

  return `${mm}/${dd}/${yyyy} ${hh}:${min}:${ss}`;
}

export async function logTransaction(tx: Transaction) {
  // Use the new timestamp function
  const timestamp = formatTimestamp(new Date());

  // LOGIC CHANGE: 
  // If it's a TRADE, use tx.identity directly (since we formatted it in the API).
  // Otherwise, use formatMessage to handle the raw player ID.
  const finalMessage = tx.type === 'TRADE' ? tx.identity : formatMessage(tx.identity);

  await sheets.spreadsheets.values.append({
    spreadsheetId: SHEET_ID,
    range: 'Transactions',
    valueInputOption: 'RAW',
    requestBody: {
      values: [[
        date,
        tx.type,
        finalMessage, // This will now be clean for trades!
        tx.fromTeam || '',
        tx.toTeam || '',
        tx.coach,
        tx.type === 'TRADE' ? 'PENDING' : 'INSTANT'
      ]],
    },
  });
}