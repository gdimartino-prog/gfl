import { createHash, randomBytes } from 'node:crypto';

export const RESET_TOKEN_BYTES = 32;
export const RESET_TOKEN_TTL_MINUTES = 30;
export const RESET_TOKEN_TTL_MS = RESET_TOKEN_TTL_MINUTES * 60 * 1000;
export const RESET_COOLDOWN_MS = 3 * 60 * 1000;
export const PASSWORD_MIN_LENGTH = 8;
export const PASSWORD_MAX_BYTES = 72;
export const DEMO_LEAGUE_ID = 2;
export const MAX_POSTGRES_INT4 = 2_147_483_647;
export const MAX_DIRECT_EMAILS_PER_LEAGUE_PER_HOUR = 25;

export const UNIFORM_RESET_REQUEST_MESSAGE =
  'If an active team in that league has an email on file, a password reset link has been sent.';

export function hashResetToken(rawToken: string): string {
  return createHash('sha256').update(rawToken, 'utf8').digest('hex');
}

export function generateResetToken(): { rawToken: string; tokenHash: string } {
  const rawToken = randomBytes(RESET_TOKEN_BYTES).toString('base64url');
  return { rawToken, tokenHash: hashResetToken(rawToken) };
}

export function isValidResetTokenFormat(token: unknown): token is string {
  return typeof token === 'string' && /^[A-Za-z0-9_-]{32,128}$/.test(token);
}

export function validateNewPassword(
  password: unknown,
): { ok: true; value: string } | { ok: false; error: string } {
  if (typeof password !== 'string') {
    return { ok: false, error: 'Password must be a string.' };
  }
  // auth.ts trims login passwords before comparing, so leading/trailing spaces
  // stored in the DB would prevent the coach from signing in afterwards.
  if (password !== password.trim()) {
    return { ok: false, error: 'Password cannot start or end with spaces.' };
  }
  if (password.length < PASSWORD_MIN_LENGTH) {
    return {
      ok: false,
      error: `Password must be at least ${PASSWORD_MIN_LENGTH} characters.`,
    };
  }
  if (Buffer.byteLength(password, 'utf8') > PASSWORD_MAX_BYTES) {
    return {
      ok: false,
      error: `Password must be at most ${PASSWORD_MAX_BYTES} bytes.`,
    };
  }
  return { ok: true, value: password };
}

export function parseResetLeagueId(raw: unknown): number | null {
  if (typeof raw === 'number') {
    return Number.isInteger(raw) && raw > 0 && raw <= MAX_POSTGRES_INT4 ? raw : null;
  }
  if (typeof raw === 'string') {
    const trimmed = raw.trim();
    if (!/^\d+$/.test(trimmed)) return null;
    const n = Number(trimmed);
    return Number.isSafeInteger(n) && n > 0 && n <= MAX_POSTGRES_INT4 ? n : null;
  }
  return null;
}

export function isResetAllowedLeague(leagueId: number): boolean {
  return Number.isInteger(leagueId) && leagueId > 0 && leagueId !== DEMO_LEAGUE_ID;
}

export function normalizeIdentifier(raw: unknown): string | null {
  if (typeof raw !== 'string') return null;
  const trimmed = raw.trim();
  if (trimmed.length < 1 || trimmed.length > 256) return null;
  return trimmed;
}

export function isPlausibleEmail(email: string | null | undefined): email is string {
  if (typeof email !== 'string') return false;
  const trimmed = email.trim();
  if (!trimmed || /[\r\n\s,;<>]/.test(trimmed)) return false;
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(trimmed);
}

export function redactEmailAddresses(input: string): string {
  return input
    .replace(/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/gi, '[redacted-email]')
    .replace(/[^\s<>"']+@[^\s<>"']+/g, '[redacted-email]');
}

export function isWithinCooldown(
  latestCreatedAt: Date | null | undefined,
  now = new Date(),
): boolean {
  if (!(latestCreatedAt instanceof Date) || Number.isNaN(latestCreatedAt.getTime())) {
    return false;
  }
  return now.getTime() - latestCreatedAt.getTime() < RESET_COOLDOWN_MS;
}

export function buildResetUrl(baseUrl: string, rawToken: string): string {
  const cleanBase = baseUrl.replace(/\/+$/, '');
  return `${cleanBase}/reset-password?token=${encodeURIComponent(rawToken)}`;
}

export function escapeEmailHtml(s: string | null | undefined): string {
  return (s ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

export function buildResetEmailContent({
  leagueName,
  teamName,
  coachName,
  resetUrl,
  ttlMinutes = RESET_TOKEN_TTL_MINUTES,
}: {
  leagueName: string;
  teamName: string;
  coachName?: string | null;
  resetUrl: string;
  ttlMinutes?: number;
}): { subject: string; html: string; text: string } {
  const cleanLeague = leagueName.trim() || 'Football League';
  const cleanTeam = teamName.trim() || 'Your Team';
  const greetingName = coachName?.trim() || 'Coach';

  const safeLeague = escapeEmailHtml(cleanLeague);
  const safeTeam = escapeEmailHtml(cleanTeam);
  const safeGreeting = escapeEmailHtml(greetingName);
  const safeUrl = escapeEmailHtml(resetUrl);

  const subject = `${cleanLeague} Password Reset — ${cleanTeam}`;

  const html = `
<div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; max-width: 560px; margin: 0 auto; padding: 24px; color: #0f172a; background: #ffffff;">
  <h2 style="margin: 0 0 12px; font-size: 20px; font-weight: 800; text-transform: uppercase; letter-spacing: -0.02em;">
    ${safeLeague} Password Reset
  </h2>
  <p style="margin: 0 0 16px; font-size: 14px; line-height: 1.5; color: #334155;">
    Hi ${safeGreeting},
  </p>
  <p style="margin: 0 0 20px; font-size: 14px; line-height: 1.5; color: #334155;">
    A password reset was requested for <strong>${safeTeam}</strong> in <strong>${safeLeague}</strong>. Use the link below to choose a new password. This link expires in <strong>${ttlMinutes} minutes</strong> and can only be used once.
  </p>
  <p style="margin: 0 0 24px;">
    <a href="${safeUrl}" style="display: inline-block; padding: 12px 22px; background-color: #2563eb; color: #ffffff; text-decoration: none; font-weight: 700; font-size: 13px; border-radius: 10px;">
      Reset Password
    </a>
  </p>
  <p style="margin: 0 0 12px; font-size: 12px; line-height: 1.5; color: #64748b; word-break: break-all;">
    If the button does not work, copy and paste this link into your browser:<br />
    ${safeUrl}
  </p>
  <hr style="border: 0; border-top: 1px solid #e2e8f0; margin: 20px 0;" />
  <p style="margin: 0; font-size: 12px; line-height: 1.5; color: #64748b;">
    If you did not request this reset, you can safely ignore this email — your password will remain unchanged.
  </p>
</div>`.trim();

  const text = [
    `${cleanLeague} Password Reset`,
    '',
    `Hi ${greetingName},`,
    '',
    `A password reset was requested for ${cleanTeam} in ${cleanLeague}.`,
    `Open the link below within ${ttlMinutes} minutes to set a new password (single-use):`,
    '',
    resetUrl,
    '',
    'If you did not request this reset, you can safely ignore this email — your password will remain unchanged.',
  ].join('\n');

  return { subject, html, text };
}
