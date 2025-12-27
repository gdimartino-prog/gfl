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

// Full timestamp with HH:MM:SS
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

  // --- 1. TEAM NAME LOOKUP ---
  let fullFrom = tx.fromTeam || 'FA';
  let fullTo = tx.toTeam || 'FA';
  
  try {
    const configRes = await sheets.spreadsheets.values.get({
      spreadsheetId: SHEET_ID,
      range: 'Config!A:B', 
    });
    const configRows = configRes.data.values || [];
    const teamMap = new Map(configRows.map(row => [row[1], row[0]]));
    
    if (tx.fromTeam && teamMap.has(tx.fromTeam)) fullFrom = teamMap.get(tx.fromTeam)!;
    if (tx.toTeam && teamMap.has(tx.toTeam)) fullTo = teamMap.get(tx.toTeam)!;
  } catch (err) {
    console.error("Team name lookup failed:", err);
  }

  const finalMessage = tx.type === 'TRADE' ? tx.identity : formatMessage(tx.identity);

  // --- 2. RESTORED tx.type AND APPEND ---
  await sheets.spreadsheets.values.append({
    spreadsheetId: SHEET_ID,
    range: 'Transactions!A:I', // Extended range to Column I
    valueInputOption: 'RAW',
    requestBody: {
      values: [[
        timestamp,            // A: Date + Time
        tx.type,              // B: Type (ADD, DROP, etc.) - RESTORED
        finalMessage,        // C: Formatted Identity
        fullFrom,            // D: Full From Team
        fullTo,              // E: Full To Team
        tx.fromTeam || 'FA',  // F: Short From Team
        tx.toTeam || 'FA',    // G: Short To Team
        tx.coach,             // H: Coach Name
        tx.type === 'TRADE' ? 'PENDING' : 'INSTANT' // I: Status
      ]],
    },
  });
}