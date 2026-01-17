export async function getSyncTime() {
  const sheetId = process.env.GOOGLE_SHEET_ID;
  const apiKey = process.env.GOOGLE_API_KEY; // You'll need an API key or use your service account
  
  try {
    // We fetch the metadata of the spreadsheet file
    const res = await fetch(
      `https://www.googleapis.com/drive/v3/files/${sheetId}?fields=modifiedTime&key=${apiKey}`,
      { next: { revalidate: 60 } } // Refresh every minute
    );
    const data = await res.json();
    return data.modifiedTime; 
  } catch (error) {
    console.error("Error fetching sync time:", error);
    return new Date().toISOString();
  }
}