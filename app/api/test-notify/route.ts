import { NextResponse } from 'next/server';
import { isAdmin } from '@/lib/auth';
import { sendWhatsApp } from '@/lib/notify';

export async function POST() {
  if (!await isAdmin()) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 403 });
  }

  await sendWhatsApp('🧪 *GFL TEST MESSAGE*\nWhatsApp notifications are working! ✅');

  return NextResponse.json({ success: true });
}
