import { NextResponse } from "next/server";
import { isAdmin } from "@/lib/auth";
import { auth } from "@/auth";
import { processStandingsFile, processScheduleFile, processPlayersFile } from "@/lib/maintenance";
import { getLeagueId } from "@/lib/getLeagueId";
import { logSystemEvent } from "@/lib/db-helpers";
import { db } from "@/lib/db";
import { players, transactions } from "@/schema";
import { eq, and, inArray, sql } from "drizzle-orm";

async function restoreIRFlags(leagueId: number) {
  const irTxns = await db.select({ fromTeam: transactions.fromTeam, description: transactions.description, date: transactions.date })
    .from(transactions)
    .where(and(eq(transactions.leagueId, leagueId), inArray(transactions.type, ['IR', 'IR MOVE'])))
    .orderBy(transactions.date);

  const removeTxns = await db.select({ description: transactions.description, date: transactions.date })
    .from(transactions)
    .where(and(eq(transactions.leagueId, leagueId), inArray(transactions.type, ['DROP', 'WAIVE', 'ADD'])))
    .orderBy(transactions.date);

  function parseName(desc: string | null): string | null {
    const m = (desc || '').match(/Placed on IR:\s*(?:[A-Z\-\/]+ - )?(.+)/i);
    return m ? m[1].trim().toLowerCase() : null;
  }

  const stillOnIR: string[] = [];
  for (const t of irTxns) {
    const name = parseName(t.description);
    if (!name) continue;
    const removed = removeTxns.some(r =>
      new Date(r.date!) > new Date(t.date!) &&
      (r.description || '').toLowerCase().includes(name)
    );
    if (!removed) stillOnIR.push(name);
  }

  // Clear all IR flags first so stale entries from prior seasons don't persist
  await db.update(players)
    .set({ isIR: false, touch_id: 'ir-restore' })
    .where(and(eq(players.leagueId, leagueId), sql`${players.isIR} = true`));

  if (stillOnIR.length === 0) return 0;

  let updated = 0;
  for (const name of stillOnIR) {
    const result = await db.update(players)
      .set({ isIR: true, touch_id: 'ir-restore' })
      .where(and(
        eq(players.leagueId, leagueId),
        sql`lower(${players.name}) = ${name}`,
      ));
    updated += (result as { rowCount?: number }).rowCount ?? 0;
  }
  return updated;
}

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
        if (processResult.success) await logSystemEvent(actor, actor, 'IMPORT_STANDINGS', `Imported standings: ${fileName}`, leagueId);
      } else if (looksLikeSchedule) {
        const processResult = await processScheduleFile(fileContent, leagueId);
        result = { ...processResult, fileName };
        if (processResult.success) await logSystemEvent(actor, actor, 'IMPORT_SCHEDULE', `Imported schedule: ${fileName}`, leagueId);
      } else if (lowerName.endsWith(".csv")) {
        const processResult = await processPlayersFile(fileContent, leagueId);
        result = { ...processResult, fileName };
        if (processResult.success) {
          await logSystemEvent(actor, actor, 'IMPORT_PLAYERS', `Imported players: ${fileName}`, leagueId);
          const irRestored = await restoreIRFlags(leagueId);
          if (irRestored > 0) await logSystemEvent(actor, actor, 'IR_FLAGS_RESTORED', `Restored isIR flag for ${irRestored} player(s) after sync`, leagueId);
        }
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
