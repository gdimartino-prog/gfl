import { NextResponse } from 'next/server';
import { isAdmin } from '@/lib/auth';
import { sendWhatsApp, sendEmail } from '@/lib/notify';

export async function POST() {
  if (!await isAdmin()) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 403 });
  }

  const results: Record<string, string> = {};

  try {
    await sendEmail({
      subject: 'GFL Test Notification',
      html: '<p style="font-family:sans-serif;font-size:16px;">🧪 <strong>GFL TEST EMAIL</strong><br>Email notifications are working! ✅</p>',
    });
    results.email = 'sent';
  } catch (e) {
    results.email = `failed: ${e instanceof Error ? e.message : String(e)}`;
  }

  try {
    await sendWhatsApp('🧪 *GFL TEST MESSAGE*\nWhatsApp notifications are working! ✅');
    results.whatsapp = 'sent';
  } catch (e) {
    results.whatsapp = `failed: ${e instanceof Error ? e.message : String(e)}`;
  }

  return NextResponse.json({ success: true, results });
}
