import { sheets, SHEET_ID } from './googleSheets';

type Transaction = {
  type: string;
  identity: string;
  fromTeam?: string;
  toTeam?: string;
  coach: string;
  details?: string;
  status?: string;
  weekBack?: string;
};

/**
 * Updates the 'Current Owner' in the DraftPicks sheet when a pick is traded.
 */
async function updatePickOwner(details: string, newOwnerShort: string, fromTeamShort: string) {
  try {
    const response = await sheets.spreadsheets.values.get({
      spreadsheetId: SHEET_ID,
      range: 'DraftPicks!A:F',
    });
    const rows = response.data.values || [];

    const match = details.match(/(\d{4})\s+Round\s+(\d+)/i);
    if (!match) return;

    const [_, year, round] = match;

    // FIX: Look for Year, Round, AND the current owner (Column E/Index 4)
    // This prevents accidentally grabbing the #1 overall pick every time.
    const rowIndex = rows.findIndex(row => 
      row[0] === year && 
      row[1] === round && 
      row[4]?.toUpperCase() === fromTeamShort.toUpperCase()
    );

    if (rowIndex !== -1) {
      const rangeToUpdate = `DraftPicks!E${rowIndex + 1}`; 
      await sheets.spreadsheets.values.update({
        spreadsheetId: SHEET_ID,
        range: rangeToUpdate,
        valueInputOption: 'RAW',
        requestBody: {
          values: [[newOwnerShort.toUpperCase()]],
        },
      });
    } else {
      console.warn(`Could not find a ${year} Round ${round} pick owned by ${fromTeamShort}`);
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
  if (!identity || !identity.includes('|')) return identity;
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

  // --- 1. MESSAGE LOGIC (THE FIX) ---
  let finalMessage = "";

  if (tx.type === 'TRADE') {
    finalMessage = tx.identity;
  } else if (tx.type === 'INJURY PICKUP' && tx.details) {
    // Use the long custom string (e.g., "G - Logan Bruss for injury to...")
    finalMessage = tx.details;
  } else {
    // For ADD, DROP, or IR: Convert "first|last|..." to "POS - First Last"
    finalMessage = formatMessage(tx.identity);
  }

  // --- 2. TEAM NAME LOOKUP ---
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

  if (tx.type === 'TRADE' && tx.identity.toLowerCase().includes('round')) {
    await updatePickOwner(tx.identity, tx.toTeam || '', tx.fromTeam || '');
  }

  // --- 3. APPEND TO TRANSACTION LOG ---
  // Maps to: A:Timestamp, B:Type, C:Desc, D:fromFull, E:toFull, F:fromShort, G:toShort, H:Owner, I:Status, J:WeekBack
  await sheets.spreadsheets.values.append({
    spreadsheetId: SHEET_ID,
    range: 'Transactions!A:J', 
    valueInputOption: 'RAW',
    requestBody: {
      values: [[
        timestamp,
        tx.type,
        finalMessage,             // Column C: The Description
        fullFrom,                 // Column D: Full Team From
        fullTo,                   // Column E: Full Team To
        tx.fromTeam || 'FA',      // Column F: Short Team From
        tx.toTeam || 'FA',        // Column G: Short Team To
        tx.coach,                 // Column H: Owner (Coach Name)
        tx.status || 'INSTANT',   // Column I: Status
        tx.weekBack || ''         // Column J: Week Back
      ]],
    },
  });
}