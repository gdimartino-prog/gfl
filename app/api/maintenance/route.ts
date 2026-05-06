import { NextResponse } from "next/server";
import { isAdmin } from "@/lib/auth";
import { auth } from "@/auth";
import { processStandingsFile, processScheduleFile, processPlayersFile } from "@/lib/maintenance";
import { getLeagueId } from "@/lib/getLeagueId";
import { logSystemEvent } from "@/lib/db-helpers";

export async function POST(request: Request) {
  const admin = await isAdmin();
  if (!admin) {
    return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 403 });
  }

  const session = await auth();
  const actor = session?.user?.name || (session?.user as { id?: string })?.id || 'commissioner';

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
      const firstLine = fileContent.split(/\r?\n/)[0]?.toUpperCase() ?? '';
      const looksLikeSchedule = lowerName.includes("schedule") || firstLine.includes("SCHEDULE");
      const looksLikeStandings = lowerName.includes("standings") || firstLine.includes("STANDINGS");

      if (looksLikeStandings) {
        const processResult = await processStandingsFile(fileContent, leagueId);
        result = { ...processResult, fileName };
        if (processResult.success) logSystemEvent(actor, actor, 'IMPORT_STANDINGS', `Imported standings: ${fileName}`, leagueId);
      } else if (looksLikeSchedule) {
        const processResult = await processScheduleFile(fileContent, leagueId);
        result = { ...processResult, fileName };
        if (processResult.success) logSystemEvent(actor, actor, 'IMPORT_SCHEDULE', `Imported schedule: ${fileName}`, leagueId);
      } else if (lowerName.endsWith(".csv")) {
        const processResult = await processPlayersFile(fileContent, leagueId);
        result = { ...processResult, fileName };
        if (processResult.success) logSystemEvent(actor, actor, 'IMPORT_PLAYERS', `Imported players: ${fileName}`, leagueId);
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
