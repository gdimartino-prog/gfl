import { sheets, SHEET_ID } from './googleSheets';

type Transaction = {
  type: 'ADD' | 'DROP' | 'IR' | 'TRADE';
  identity: string;
  fromTeam?: string;
  toTeam?: string;
  coach: string;
};

/**
 * Updates the 'Current Owner' in the DraftPicks sheet when a pick is traded.
 */
async function updatePickOwner(details: string, newOwnerShort: string) {
  try {
    const response = await sheets.spreadsheets.values.get({
      spreadsheetId: SHEET_ID,
      range: 'DraftPicks!A:F',
    });
    const rows = response.data.values || [];

    // Regex to find Year and Round from the message (e.g., "2026 Round 1")
    const match = details.match(/(\d{4})\s+Round\s+(\d+)/i);
    if (!match) return;

    const [_, year, round] = match;

    // Find the row index where Year (Col A/0) and Round (Col B/1) match
    const rowIndex = rows.findIndex(row => 
      row[0] === year && row[1] === round
    );

    if (rowIndex !== -1) {
      // Column E is Index 4, so we update Column E at the found row index
      // +1 because Sheets are 1-indexed
      const rangeToUpdate = `DraftPicks!E${rowIndex + 1}`; 
      
      await sheets.spreadsheets.values.update({
        spreadsheetId: SHEET_ID,
        range: rangeToUpdate,
        valueInputOption: 'RAW',
        requestBody: {
          values: [[newOwnerShort.toUpperCase()]],
        },
      });
      console.log(`Successfully moved ${year} R${round} to ${newOwnerShort}`);
    }
  } catch (err) {
    console.error("DraftPicks update failed:", err);
  }
}

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

  // --- 2. UPDATE DRAFT PICKS SHEET IF NECESSARY ---
  // If the trade identity contains "Round", we update the DraftPicks sheet
  if (tx.type === 'TRADE' && tx.identity.toLowerCase().includes('round')) {
    await updatePickOwner(tx.identity, tx.toTeam || '');
  }

  // --- 3. APPEND TO TRANSACTION LOG ---
  await sheets.spreadsheets.values.append({
    spreadsheetId: SHEET_ID,
    range: 'Transactions!A:I',
    valueInputOption: 'RAW',
    requestBody: {
      values: [[
        timestamp,
        tx.type,
        finalMessage,
        fullFrom,
        fullTo,
        tx.fromTeam || 'FA',
        tx.toTeam || 'FA',
        tx.coach,
        tx.type === 'TRADE' ? 'PENDING' : 'INSTANT'
      ]],
    },
  });
}