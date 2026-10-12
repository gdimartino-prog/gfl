import { timingSafeEqual } from 'crypto';

/**
 * Shared CRON_SECRET gate for /api/cron/* routes.
 *
 * Fails CLOSED: if CRON_SECRET is unset, every request is rejected. Without
 * this, an unset secret makes the check `authorization === 'Bearer undefined'`,
 * which anyone can guess.
 */
export function isAuthorizedCron(req: Request): boolean {
  const secret = process.env.CRON_SECRET;
  if (!secret) return false;

  const provided = req.headers.get('authorization') ?? '';
  const expected = `Bearer ${secret}`;
  const a = Buffer.from(provided);
  const b = Buffer.from(expected);
  if (a.length !== b.length) return false;
  return timingSafeEqual(a, b);
}
