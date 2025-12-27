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

function formatMessage(identity: string) {
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
  const timestamp = formatTimestamp(new Date());

  // --- 1. TEAM NAME LOOKUP LOGIC ---
  let fullFrom = tx.fromTeam || '';
  let fullTo = tx.toTeam || '';
  
  try {
    const configRes = await sheets.spreadsheets.values.get({
      spreadsheetId: SHEET_ID,
      range: 'Config!A:B', // Column A: Full Name, Column B: Short Name
    });
    const configRows = configRes.data.values || [];
    
    // Create a lookup map: { "PHI": "Philadelphia Eagles", "DAL": "Dallas Cowboys" }
    const teamMap = new Map(configRows.map(row => [row[1], row[0]]));
    
    // Replace short names if they exist in the map
    if (teamMap.has(tx.fromTeam || '')) fullFrom = teamMap.get(tx.fromTeam!)!;
    if (teamMap.has(tx.toTeam || '')) fullTo = teamMap.get(tx.toTeam!)!;
    
  } catch (err) {
    console.error("Team lookup failed:", err);
  }

  const finalMessage = tx.type === 'TRADE' ? tx.identity : formatMessage(tx.identity);

  // --- 2. APPEND TO SHEET ---
  await sheets.spreadsheets.values.append({
    spreadsheetId: SHEET_ID,
    range: 'Transactions!A:H',
    valueInputOption: 'RAW',
    requestBody: {
      values: [[
        timestamp,      // A
        tx.type,       // B
        finalMessage,  // C
        fullFrom,      // D (Full Name Sender)
        fullTo,        // E (Full Name Receiver)
        tx.fromTeam,   // F (Short Name Sender - useful for filtering)
        tx.toTeam,     // G (Short Name Receiver)
        tx.coach       // H
      ]],
    },
  });
}