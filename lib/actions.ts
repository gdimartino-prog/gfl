"use server";

import { auth } from "@/auth";
import { getSheetsClient } from "@/lib/google-cloud";
import { revalidatePath } from "next/cache";

export async function updatePassword(newPassword: string) {
  const session = await auth();
  
  if (!session || !session.user) {
    return { success: false, error: "Unauthorized: Please log in again." };
  }

  // The session provides 'VV' as the ID for George
  const userTeamId = (session.user as { id?: string }).id; 

  try {
    const sheets = getSheetsClient();
    const SHEET_ID = process.env.GOOGLE_SHEET_ID;

    const response = await sheets.spreadsheets.values.get({
      spreadsheetId: SHEET_ID,
      range: "Coaches!A:H", // Ensure we fetch through Column H
    });

    const rows = response.data.values;
    if (!rows || rows.length === 0) return { success: false, error: "Could not access database." };

    // FIX: Look in Column B (index 1) for the teamshort code 'VV'
    const rowIndex = rows.findIndex(row => 
      row[1]?.toString().trim().toUpperCase() === userTeamId?.trim().toUpperCase()
    );

    if (rowIndex === -1) {
      return { success: false, error: `Team ID [${userTeamId}] not found in database.` };
    }

    // Google Sheets is 1-indexed
    const sheetRowNumber = rowIndex + 1;
    const range = `Coaches!H${sheetRowNumber}`; // Update Column H
    
    await sheets.spreadsheets.values.update({
      spreadsheetId: SHEET_ID,
      range,
      valueInputOption: "RAW",
      requestBody: { values: [[newPassword]] },
    });

    revalidatePath("/settings");
    return { success: true };

  } catch (err) {
    console.error("Update Error:", err);
    return { success: false, error: "Internal server error." };
  }
}