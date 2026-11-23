import { NextRequest, NextResponse } from 'next/server';
import { requestPasswordReset } from '@/lib/passwordReset';
import {
  normalizeIdentifier,
  parseResetLeagueId,
  UNIFORM_RESET_REQUEST_MESSAGE,
} from '@/lib/passwordResetRules';
import { tokenBucket } from '@/lib/rateLimit';

const NO_STORE_HEADERS = { 'Cache-Control': 'private, no-store' };

export async function POST(req: NextRequest) {
  const ip = (req.headers.get('x-forwarded-for')?.split(',')[0] || 'unknown').trim();
  const rl = tokenBucket(`pwdreset:req:${ip}`, 5, 900);
  if (!rl.ok) {
    return NextResponse.json(
      { error: 'Too many password reset requests. Please try again later.' },
      {
        status: 429,
        headers: {
          ...NO_STORE_HEADERS,
          'Retry-After': String(rl.retryAfterSec),
        },
      },
    );
  }

  let body: { leagueId?: unknown; identifier?: unknown } | null = null;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json(
      { error: 'Invalid request body.' },
      { status: 400, headers: NO_STORE_HEADERS },
    );
  }

  const leagueId = parseResetLeagueId(body?.leagueId);
  const identifier = normalizeIdentifier(body?.identifier);
  if (!leagueId || !identifier) {
    return NextResponse.json(
      { error: 'Please select a league and enter your team name, short code, or email.' },
      { status: 400, headers: NO_STORE_HEADERS },
    );
  }

  try {
    await requestPasswordReset({ leagueId, identifier });
    return NextResponse.json(
      { ok: true, message: UNIFORM_RESET_REQUEST_MESSAGE },
      { headers: NO_STORE_HEADERS },
    );
  } catch (err) {
    console.error('Password reset request error:', err);
    return NextResponse.json(
      { error: 'Unable to process password reset request.' },
      { status: 500, headers: NO_STORE_HEADERS },
    );
  }
}
