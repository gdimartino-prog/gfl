import { sheets, SHEET_ID } from './googleSheets';

export async function getResources() {
  try {
    // Uses your existing authorized 'sheets' instance and 'SHEET_ID'
    const response = await sheets.spreadsheets.values.get({
      spreadsheetId: SHEET_ID,
      range: 'Resources!A2:C100', 
    });

    const rows = response.data.values || [];
    
    // Group the data by the first column (Group)
    return rows.reduce((acc: any, [group, name, url]) => {
      if (!acc[group]) acc[group] = [];
      acc[group].push({ name, url });
      return acc;
    }, {});
  } catch (error) {
    console.error("❌ Google Sheets Resources Error:", error);
    return {}; // Return empty object so the page doesn't crash
  }
}