"use server";

import { auth } from "@/auth";
import { db } from "@/lib/db";
import { teams } from "@/schema";
import { eq } from "drizzle-orm";
import bcrypt from "bcrypt";
import { revalidatePath } from "next/cache";

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
    const hashed = await bcrypt.hash(newPassword, 10);
    await db
      .update(teams)
      .set({ password: hashed })
      .where(eq(teams.teamshort, teamshort));

    revalidatePath("/settings");
    return { success: true };
  } catch (err) {
    console.error("Update Error:", err);
    return { success: false, error: "Internal server error." };
  }
}
