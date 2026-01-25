"use server";

import { auth } from "@/auth";
import { sheets, SHEET_ID } from "@/lib/googleSheets";
import { revalidatePath } from "next/cache";

export async function updatePassword(newPassword: string) {
  const session = await auth();
  if (!session || !session.user) throw new Error("Unauthorized");

  // 1. Fetch the Coaches sheet to find the right row
  const response = await sheets.spreadsheets.values.get({
    spreadsheetId: SHEET_ID,
    range: "Coaches!A:H",
  });

  const rows = response.data.values;
  if (!rows) return { error: "Could not access sheet" };

  // 2. Find row index (Match by Coach Name or Team Name)
  const rowIndex = rows.findIndex(row => row[2] === session.user?.name);
  if (rowIndex === -1) return { error: "User not found in sheet" };

  // 3. Write new password to Column H (Index 7)
  // Sheets is 1-indexed for ranges, so rowIndex + 1
  const range = `Coaches!H${rowIndex + 1}`;
  
  await sheets.spreadsheets.values.update({
    spreadsheetId: SHEET_ID,
    range,
    valueInputOption: "RAW",
    requestBody: { values: [[newPassword]] },
  });

  revalidatePath("/");
  return { success: true };
}