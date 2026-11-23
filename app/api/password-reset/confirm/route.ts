import { NextRequest, NextResponse } from 'next/server';
import { confirmPasswordReset } from '@/lib/passwordReset';
import { tokenBucket } from '@/lib/rateLimit';

const NO_STORE_HEADERS = { 'Cache-Control': 'private, no-store' };

export async function POST(req: NextRequest) {
  const ip = (req.headers.get('x-forwarded-for')?.split(',')[0] || 'unknown').trim();
  const rl = tokenBucket(`pwdreset:confirm:${ip}`, 10, 900);
  if (!rl.ok) {
    return NextResponse.json(
      { error: 'Too many password reset attempts. Please try again later.' },
      {
        status: 429,
        headers: {
          ...NO_STORE_HEADERS,
          'Retry-After': String(rl.retryAfterSec),
        },
      },
    );
  }

  let body: { token?: unknown; newPassword?: unknown } | null = null;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json(
      { error: 'Invalid request body.' },
      { status: 400, headers: NO_STORE_HEADERS },
    );
  }

  const rawToken = typeof body?.token === 'string' ? body.token.trim() : '';

  try {
    const result = await confirmPasswordReset({
      rawToken,
      newPassword: body?.newPassword,
    });

    if (!result.ok) {
      return NextResponse.json(
        { error: result.error },
        { status: result.status, headers: NO_STORE_HEADERS },
      );
    }

    return NextResponse.json(
      { ok: true, message: 'Your password has been updated. You can now sign in.' },
      { headers: NO_STORE_HEADERS },
    );
  } catch (err) {
    console.error('Password reset confirm error:', err);
    return NextResponse.json(
      { error: 'Unable to reset password.' },
      { status: 500, headers: NO_STORE_HEADERS },
    );
  }
}
