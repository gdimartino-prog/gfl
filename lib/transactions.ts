import { getSheetsClient } from './google-cloud';

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
  const sheets = getSheetsClient();
  const SHEET_ID = process.env.GOOGLE_SHEET_ID;

  // --- 1. PREPARE MESSAGE (Includes Position Fix) ---
  // Priority types that use pre-formatted details from the frontend
  const useDetailsTypes = ['TRADE', 'INJURY PICKUP', 'WAIVE', 'DROP', 'IR MOVE', 'ADD'];
  const finalMessage = (useDetailsTypes.includes(tx.type) && tx.details) 
    ? tx.details 
    : tx.identity;

  // --- 2. TEAM NAME LOOKUP (Resolves "VV" to "Vico") ---
  let fullFrom = tx.fromTeam || 'Free Agent';
  let fullTo = tx.toTeam || 'Free Agent';
  
  try {
    const configRes = await sheets.spreadsheets.values.get({
      spreadsheetId: SHEET_ID,
      range: 'Config!A:B', 
    });
    const configRows = configRes.data.values || [];
    const teamMap = new Map(configRows.map(row => [
      String(row[1] || '').trim().toUpperCase(), 
      String(row[0] || '').trim()
    ]));
    
    const fromCode = String(tx.fromTeam || '').trim().toUpperCase();
    const toCode = String(tx.toTeam || '').trim().toUpperCase();

    if (teamMap.has(fromCode)) fullFrom = teamMap.get(fromCode)!;
    if (teamMap.has(toCode)) fullTo = teamMap.get(toCode)!;

    // Manual overrides for standard keywords
    if (fromCode === 'FA') fullFrom = 'Free Agent';
    if (toCode === 'FA') fullTo = 'Free Agent';
    if (fromCode === 'IR') fullFrom = 'Injured Reserve';
    if (toCode === 'IR') fullTo = 'Injured Reserve';
  } catch (err) {
    console.error("Team lookup failed:", err);
  }

  // --- 3. APPEND TO TRANSACTIONS TAB (Simplified 8-Column Format) ---
  // We removed F and G so "Owner" is now the 6th column
  await sheets.spreadsheets.values.append({
    spreadsheetId: SHEET_ID,
    range: 'Transactions!A:H', 
    valueInputOption: 'RAW',
    requestBody: {
      values: [[
        timestamp,           // Col A: Date
        tx.type,            // Col B: Type
        finalMessage,       // Col C: Desc (POS - Name)
        fullFrom,           // Col D: fromTeam (Long Name)
        fullTo,             // Col E: toTeam (Long Name)
        tx.coach,           // Col F: Owner
        tx.status || 'SUCCESS', // Col G: Status
        tx.weekBack || ''    // Col H: Week Back
      ]],
    },
  });
}