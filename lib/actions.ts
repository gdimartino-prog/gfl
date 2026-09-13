"use server";

import { auth } from "@/auth";
import { db } from "@/lib/db";
import { teams } from "@/schema";
import { and, eq, sql } from "drizzle-orm";
import bcrypt from "bcrypt";
import { revalidatePath } from "next/cache";
import { getLeagueId } from "@/lib/getLeagueId";

export async function updatePassword(newPassword: string) {
  const session = await auth();

  if (!session?.user) {
    return { success: false, error: "Unauthorized: Please log in again." };
  }

  const teamshort = ((session.user as { id?: string }).id || "").toUpperCase();
  if (!teamshort) {
    return { success: false, error: "Session error: no team ID." };
  }

  try {
    const leagueId = await getLeagueId();
    const hashed = await bcrypt.hash(newPassword, 10);
    const result = await db
      .update(teams)
      .set({ password: hashed, touch_id: teamshort, touch_dt: new Date() })
      .where(and(
        eq(teams.leagueId, leagueId),
        sql`upper(${teams.teamshort}) = ${teamshort}`,
      ))
      .returning({ id: teams.id });

    if (result.length === 0) {
      return { success: false, error: "Team not found in this league." };
    }

    revalidatePath("/settings");
    return { success: true };
  } catch (err) {
    console.error("Update Error:", err);
    return { success: false, error: "Internal server error." };
  }
}
