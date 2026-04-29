import { NextResponse } from 'next/server';
import { revalidateTag } from 'next/cache';
import { isAdmin, isCommissioner } from '@/lib/auth';

export async function POST() {
  if (!await isAdmin() && !await isCommissioner()) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 403 });
  }
  revalidateTag('draft-picks', 'max');
  revalidateTag('players', 'max');
  revalidateTag('transactions', 'max');
  return NextResponse.json({ success: true });
}
