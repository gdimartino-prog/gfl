import bcrypt from 'bcrypt';
import { and, desc, eq, gt, isNull, lt, or, sql } from 'drizzle-orm';
import { revalidateTag } from 'next/cache';
import { db } from '@/lib/db';
import { logSystemEvent } from '@/lib/db-helpers';
import { GFL_URL, sendDirectEmail } from '@/lib/notify';
import {
  buildResetEmailContent,
  buildResetUrl,
  generateResetToken,
  hashResetToken,
  isPlausibleEmail,
  isResetAllowedLeague,
  isValidResetTokenFormat,
  isWithinCooldown,
  MAX_DIRECT_EMAILS_PER_LEAGUE_PER_HOUR,
  RESET_TOKEN_TTL_MS,
  validateNewPassword,
} from '@/lib/passwordResetRules';
import { auditLog, leagues, passwordResetTokens, teams } from '@/schema';

const INVALID_OR_EXPIRED_ERROR = 'Reset link is invalid or has expired.';

export async function revokePasswordResetTokensForTeam(
  teamId: number,
  leagueId: number,
  executor: Pick<typeof db, 'delete'> = db,
): Promise<void> {
  await executor
    .delete(passwordResetTokens)
    .where(
      and(
        eq(passwordResetTokens.teamId, teamId),
        eq(passwordResetTokens.leagueId, leagueId),
        isNull(passwordResetTokens.usedAt),
      ),
    );
}

export async function requestPasswordReset({
  leagueId,
  identifier,
}: {
  leagueId: number;
  identifier: string;
}): Promise<{ ok: true }> {
  if (!isResetAllowedLeague(leagueId)) {
    return { ok: true };
  }

  const lowerId = identifier.toLowerCase();
  const upperId = identifier.toUpperCase();

  const matches = await db
    .select({
      id: teams.id,
      name: teams.name,
      coach: teams.coach,
      teamshort: teams.teamshort,
      email: teams.email,
      leagueName: leagues.name,
    })
    .from(teams)
    .innerJoin(leagues, eq(teams.leagueId, leagues.id))
    .where(
      and(
        eq(teams.leagueId, leagueId),
        eq(teams.status, 'active'),
        sql`(lower(${teams.email}) = ${lowerId} OR lower(${teams.name}) = ${lowerId} OR upper(${teams.teamshort}) = ${upperId})`,
      ),
    )
    .orderBy(sql`${teams.password} IS NOT NULL DESC`, teams.id)
    .limit(1);

  const team = matches[0];
  if (!team || !team.teamshort || !isPlausibleEmail(team.email)) {
    return { ok: true };
  }

  const now = new Date();
  const oneHourAgo = new Date(now.getTime() - 60 * 60 * 1000);
  const [hourlyStats] = await db
    .select({ sentCount: sql<number>`count(*)::int` })
    .from(auditLog)
    .where(
      and(
        eq(auditLog.leagueId, leagueId),
        eq(auditLog.action, 'DIRECT_EMAIL_SENT'),
        gt(auditLog.timestamp, oneHourAgo),
      ),
    );

  if ((hourlyStats?.sentCount ?? 0) >= MAX_DIRECT_EMAILS_PER_LEAGUE_PER_HOUR) {
    return { ok: true };
  }

  const { rawToken, tokenHash } = generateResetToken();
  const expiresAt = new Date(now.getTime() + RESET_TOKEN_TTL_MS);

  const inserted = await db.transaction(async (tx) => {
    // Serialize concurrent reset requests for the same team so cooldown + token replacement are atomic.
    await tx
      .select({ id: teams.id })
      .from(teams)
      .where(and(eq(teams.id, team.id), eq(teams.leagueId, leagueId)))
      .for('update');

    const latest = await tx
      .select({ createdAt: passwordResetTokens.createdAt })
      .from(passwordResetTokens)
      .where(
        and(
          eq(passwordResetTokens.leagueId, leagueId),
          eq(passwordResetTokens.teamId, team.id),
        ),
      )
      .orderBy(desc(passwordResetTokens.createdAt))
      .limit(1);

    if (isWithinCooldown(latest[0]?.createdAt, now)) {
      return null;
    }

    await tx
      .delete(passwordResetTokens)
      .where(
        and(
          eq(passwordResetTokens.leagueId, leagueId),
          or(
            and(
              eq(passwordResetTokens.teamId, team.id),
              isNull(passwordResetTokens.usedAt),
            ),
            lt(passwordResetTokens.expiresAt, now),
          ),
        ),
      );

    const [created] = await tx
      .insert(passwordResetTokens)
      .values({
        leagueId,
        teamId: team.id,
        tokenHash,
        expiresAt,
        createdAt: now,
        touch_dt: now,
        touch_id: team.teamshort,
      })
      .returning({ id: passwordResetTokens.id });

    return created;
  });

  if (!inserted) {
    return { ok: true };
  }

  const resetUrl = buildResetUrl(GFL_URL, rawToken);
  const { subject, html, text } = buildResetEmailContent({
    leagueName: team.leagueName,
    teamName: team.name,
    coachName: team.coach,
    resetUrl,
  });

  const sent = await sendDirectEmail({
    to: team.email.trim(),
    subject,
    html,
    text,
    leagueId,
    auditDetail: `Password reset for ${team.teamshort}`,
  });

  if (!sent) {
    // Mark token expired/used rather than deleting so createdAt still enforces the 3-minute cooldown.
    await db
      .update(passwordResetTokens)
      .set({ expiresAt: now, usedAt: now, touch_dt: now })
      .where(
        and(
          eq(passwordResetTokens.id, inserted.id),
          eq(passwordResetTokens.leagueId, leagueId),
        ),
      );
    return { ok: true };
  }

  await logSystemEvent(
    team.coach || 'Coach',
    team.name,
    'PASSWORD_RESET_REQUESTED',
    `Self-service reset link issued for ${team.teamshort}`,
    leagueId,
  );

  return { ok: true };
}

export async function confirmPasswordReset({
  rawToken,
  newPassword,
}: {
  rawToken: string;
  newPassword: unknown;
}): Promise<{ ok: true } | { ok: false; error: string; status: number }> {
  if (!isValidResetTokenFormat(rawToken)) {
    return { ok: false, error: INVALID_OR_EXPIRED_ERROR, status: 400 };
  }

  const pw = validateNewPassword(newPassword);
  if (!pw.ok) {
    return { ok: false, error: pw.error, status: 400 };
  }

  const tokenHash = hashResetToken(rawToken);
  const now = new Date();

  const existing = await db
    .select({
      id: passwordResetTokens.id,
      leagueId: passwordResetTokens.leagueId,
    })
    .from(passwordResetTokens)
    .innerJoin(
      teams,
      and(
        eq(passwordResetTokens.teamId, teams.id),
        eq(passwordResetTokens.leagueId, teams.leagueId),
      ),
    )
    .where(
      and(
        eq(passwordResetTokens.tokenHash, tokenHash),
        isNull(passwordResetTokens.usedAt),
        gt(passwordResetTokens.expiresAt, now),
        eq(teams.status, 'active'),
      ),
    )
    .limit(1);

  if (!existing[0] || !isResetAllowedLeague(existing[0].leagueId)) {
    return { ok: false, error: INVALID_OR_EXPIRED_ERROR, status: 400 };
  }

  const hashedPassword = await bcrypt.hash(pw.value, 12);

  const updatedTeam = await db.transaction(async (tx) => {
    const claimTime = new Date();
    const claimed = await tx
      .update(passwordResetTokens)
      .set({
        usedAt: claimTime,
        touch_dt: claimTime,
        touch_id: 'self-reset',
      })
      .where(
        and(
          eq(passwordResetTokens.tokenHash, tokenHash),
          isNull(passwordResetTokens.usedAt),
          gt(passwordResetTokens.expiresAt, claimTime),
        ),
      )
      .returning({
        id: passwordResetTokens.id,
        teamId: passwordResetTokens.teamId,
        leagueId: passwordResetTokens.leagueId,
      });

    if (!claimed[0] || !isResetAllowedLeague(claimed[0].leagueId)) {
      return null;
    }

    const updated = await tx
      .update(teams)
      .set({
        password: hashedPassword,
        touch_id: 'self-reset',
        touch_dt: claimTime,
      })
      .where(
        and(
          eq(teams.id, claimed[0].teamId),
          eq(teams.leagueId, claimed[0].leagueId),
          eq(teams.status, 'active'),
        ),
      )
      .returning({
        id: teams.id,
        name: teams.name,
        coach: teams.coach,
        teamshort: teams.teamshort,
        leagueId: teams.leagueId,
      });

    if (!updated[0]) {
      return null;
    }

    await tx
      .delete(passwordResetTokens)
      .where(
        and(
          eq(passwordResetTokens.leagueId, claimed[0].leagueId),
          eq(passwordResetTokens.teamId, claimed[0].teamId),
          isNull(passwordResetTokens.usedAt),
        ),
      );

    return updated[0];
  });

  if (!updatedTeam) {
    return { ok: false, error: INVALID_OR_EXPIRED_ERROR, status: 400 };
  }

  revalidateTag('coaches', 'max');
  revalidateTag('team-leagues', 'max');

  await logSystemEvent(
    updatedTeam.coach || 'Coach',
    updatedTeam.name,
    'PASSWORD_RESET_COMPLETED',
    `Password reset via self-service link (${updatedTeam.teamshort || updatedTeam.id})`,
    updatedTeam.leagueId,
  );

  return { ok: true };
}
