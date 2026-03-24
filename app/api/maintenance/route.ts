import { NextResponse } from "next/server";
import { isAdmin } from "@/lib/auth";
import { processStandingsFile, processScheduleFile, processPlayersFile } from "@/lib/maintenance";
import { getLeagueId } from "@/lib/getLeagueId";
import { logSystemEvent } from "@/lib/db-helpers";

export async function POST(request: Request) {
  const admin = await isAdmin();
  if (!admin) {
    return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 403 });
  }

  const leagueId = await getLeagueId();
  const data = await request.formData();
  const files: File[] = data.getAll("files") as unknown as File[];

  if (!files || files.length === 0) {
    return NextResponse.json({ success: false, error: "No files found" }, { status: 400 });
  }

  const results = [];

  for (const file of files) {
    const fileContent = await file.text();
    const fileName = file.name;
    let result: { success: boolean; message: string; fileName: string };

    try {
      const lowerName = fileName.toLowerCase();
      if (lowerName.includes("standings")) {
        const processResult = await processStandingsFile(fileContent, leagueId);
        result = { ...processResult, fileName };
        if (processResult.success) logSystemEvent('admin', 'admin', 'IMPORT_STANDINGS', `Imported standings: ${fileName}`, leagueId);
      } else if (lowerName.includes("schedule")) {
        const processResult = await processScheduleFile(fileContent, leagueId);
        result = { ...processResult, fileName };
        if (processResult.success) logSystemEvent('admin', 'admin', 'IMPORT_SCHEDULE', `Imported schedule: ${fileName}`, leagueId);
      } else if (lowerName.endsWith(".csv")) {
        const processResult = await processPlayersFile(fileContent, leagueId);
        result = { ...processResult, fileName };
        if (processResult.success) logSystemEvent('admin', 'admin', 'IMPORT_PLAYERS', `Imported players: ${fileName}`, leagueId);
      } else {
        result = { success: false, message: "Unsupported file type", fileName };
      }
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : "An unknown error occurred";
      result = { success: false, message: errorMessage, fileName };
    }
    results.push(result);
  }

  return NextResponse.json({ results });
}
