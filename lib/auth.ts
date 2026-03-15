import { auth } from "@/auth";
import { db } from "./db";
import { teams } from "@/schema";
import { eq } from "drizzle-orm";

export async function isAdmin() {
  const session = await auth();
  const role = session?.user?.role;
  return role === "admin" || role === "superuser";
}

export async function isCommissioner() {
  const session = await auth();
  if (!session?.user) return false;
  const teamshort = (session.user as { id?: string }).id;
  if (!teamshort) return false;
  const result = await db.select({ isCommissioner: teams.isCommissioner })
    .from(teams)
    .where(eq(teams.teamshort, teamshort))
    .limit(1);
  return result[0]?.isCommissioner || false;
}
