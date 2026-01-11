import { sheets, SHEET_ID } from './googleSheets';

export type Transaction = {
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
 * Updates the 'Current Owner' in the DraftPicks sheet using the Unique Overall Pick Number.
 * This is the most reliable method as Overall (#) is a unique identifier.
 */
// lib/transactions.ts - updatePickOwner function

/**
 * Updates the 'Current Owner' in the DraftPicks sheet.
 * Uses USER_ENTERED to ensure the UI refreshes and Google processes the change.
 */
async function updatePickOwner(details: string, newOwnerShort: string, fromTeamShort: string) {
  console.log("--- START Surgical Pick Update ---");
  
  try {
    // 1. Extract Overall Pick ID (e.g., "2" from "(#2)")
    const overallMatch = details.match(/\(#(\d+)\)/);
    if (!overallMatch) {
      console.error("❌ Surgical Match Failed: Identity missing (#ID).");
      return;
    }
    const targetOverall = overallMatch[1].trim();

    // 2. Fetch the current data
    const response = await sheets.spreadsheets.values.get({
      spreadsheetId: SHEET_ID,
      range: 'DraftPicks!A:G', 
    });
    const rows = response.data.values || [];

    // 3. Find the exact row based on Column C (Overall)
    const rowIndex = rows.findIndex(row => String(row[2] || '').trim() === targetOverall);

    if (rowIndex !== -1) {
      // Column E is index 4. This is the 'Current Owner' column.
      const rangeToUpdate = `DraftPicks!E${rowIndex + 1}`;
      const targetValue = newOwnerShort.toUpperCase().trim();

      console.log(`Writing "${targetValue}" to Range: ${rangeToUpdate}`);

      // 4. Perform the Update with USER_ENTERED
      const updateResponse = await sheets.spreadsheets.values.update({
        spreadsheetId: SHEET_ID,
        range: rangeToUpdate,
        valueInputOption: 'USER_ENTERED', // 💡 Forces the UI to refresh/re-calculate
        requestBody: {
          values: [[targetValue]],
        },
      });

      if (updateResponse.status === 200) {
        console.log(`✅ GOOGLE CONFIRMED: Cell at ${rangeToUpdate} updated.`);
        // Optional: Log the first few chars of the Sheet ID to verify you're in the right file
        console.log(`Targeting Sheet ID: ${SHEET_ID.substring(0, 5)}...`);
      }
    } else {
      console.error(`❌ NOT FOUND: Overall #${targetOverall} doesn't exist in Column C.`);
    }
  } catch (err: any) {
    console.error("❌ API ERROR:", err.message);
  }
  console.log("--- END Surgical Pick Update ---");
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
  console.log(`[${timestamp}] Logging ${tx.type}: ${tx.identity}`);

  // --- 1. PREPARE MESSAGE ---
  let finalMessage = (tx.type === 'TRADE') ? tx.identity : (tx.type === 'INJURY PICKUP' && tx.details) ? tx.details : formatMessage(tx.identity);

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

  // --- 3. EXECUTE PICK TRADE LOGIC ---
  if (tx.type === 'TRADE' && tx.identity.includes('#')) {
    await updatePickOwner(tx.identity, tx.toTeam || '', tx.fromTeam || '');
  }

  // --- 4. APPEND TO TRANSACTIONS TAB ---
  await sheets.spreadsheets.values.append({
    spreadsheetId: SHEET_ID,
    range: 'Transactions!A:J', 
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
        tx.status || 'INSTANT',   
        tx.weekBack || ''         
      ]],
    },
  });
}