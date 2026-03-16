import nodemailer from 'nodemailer';

const MY_EMAIL = process.env.NOTIFY_MY_EMAIL || 'gdimartino@gmail.com';
const GROUP_EMAIL = process.env.NOTIFY_GROUP_EMAIL || MY_EMAIL;
const SEND_WHATSAPP = process.env.SEND_WHATSAPP !== 'false';
export const GFL_URL = process.env.NEXT_PUBLIC_APP_URL || 'https://gfl-zeta.vercel.app';
const FROM_EMAIL = process.env.NOTIFY_FROM_EMAIL || `GFL <${MY_EMAIL}>`;

let _transporter: nodemailer.Transporter | null = null;
function getTransporter() {
  if (!_transporter) {
    _transporter = nodemailer.createTransport({
      service: 'gmail',
      auth: {
        user: process.env.GMAIL_USER || MY_EMAIL,
        pass: process.env.GMAIL_APP_PASSWORD,
      },
    });
  }
  return _transporter;
}

export async function sendEmail({ subject, html, text }: {
  subject: string;
  html?: string;
  text?: string;
}) {
  if (!process.env.GMAIL_APP_PASSWORD) {
    console.warn('GMAIL_APP_PASSWORD not set — skipping email');
    return;
  }
  try {
    await getTransporter().sendMail({
      from: FROM_EMAIL,
      to: GROUP_EMAIL,
      cc: MY_EMAIL,
      subject,
      html: html || `<pre>${text}</pre>`,
      text,
    });
  } catch (e) {
    console.error('Email send failed:', e);
  }
}

export async function sendWhatsApp(message: string) {
  if (!SEND_WHATSAPP) return;
  const idInstance = process.env.GREENAPI_INSTANCE_ID;
  const apiToken = process.env.GREENAPI_API_TOKEN;
  const groupId = process.env.GREENAPI_GROUP_ID;
  if (!idInstance || !apiToken || !groupId) return;

  try {
    const res = await fetch(
      `https://7105.api.greenapi.com/waInstance${idInstance}/sendMessage/${apiToken}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ chatId: groupId, message }),
      }
    );
    if (!res.ok) console.error('WhatsApp send failed:', res.status);
  } catch (e) {
    console.error('WhatsApp error:', e);
  }
}

export async function notifyDraftPick({
  round, overallPick, currentOwner, originalOwner, playerName,
  timeTakenMs, recentPicks, onDeck, type, leagueId,
}: {
  round: number;
  overallPick: number;
  currentOwner: string;
  originalOwner: string;
  playerName?: string;
  timeTakenMs?: number;
  recentPicks: { round: number; pick: number; player: string; owner: string }[];
  onDeck: { round: number; pick: number; owner: string }[];
  type: 'PICK' | 'WARNING' | 'EXPIRATION';
  leagueId?: number;
}) {
  const tradeSuffix = originalOwner && originalOwner !== currentOwner
    ? ` (via ${originalOwner})` : '';

  let timeTakenStr = '';
  if (type === 'PICK' && timeTakenMs) {
    const hrs = Math.floor(timeTakenMs / (1000 * 60 * 60));
    const mins = Math.floor((timeTakenMs % (1000 * 60 * 60)) / (1000 * 60));
    timeTakenStr = `\nTime Taken: ${hrs}h ${mins}m`;
  }

  const recentStr = recentPicks.map(p =>
    `   R${p.round} #${p.pick}: ${p.player || 'Skipped'} (${p.owner})`
  ).join('\n');

  const onDeckStr = onDeck.map(p =>
    `   R${p.round} #${p.pick}: ${p.owner}`
  ).join('\n');

  const nextOwner = onDeck[0]?.owner || '';
  const pingText = nextOwner ? `>>> @ ${nextOwner.toUpperCase()}: YOU ARE ON THE CLOCK <<<\n\n` : '';

  let header = '', details = '', waHeader = '';
  if (type === 'WARNING') {
    header = '1-HOUR CLOCK WARNING';
    waHeader = '⚠️ *1-HOUR WARNING*';
    details = `${currentOwner}${tradeSuffix} has < 1 hr left.`;
  } else if (type === 'EXPIRATION') {
    header = 'PICK EXPIRED';
    waHeader = '⏰ *PICK EXPIRED*';
    details = `Team ${currentOwner}${tradeSuffix} was skipped.`;
  } else {
    header = 'LATEST PICK';
    waHeader = '🏈 *LATEST PICK*';
    details = `Team: ${currentOwner}${tradeSuffix}\nSelection: ${playerName}${timeTakenStr}`;
  }

  const subject = `GFL DRAFT (R${round}): Pick #${overallPick}${type === 'PICK' ? ` (${playerName})` : ' ' + type}`;
  const body = `${pingText}${header}:\n----------\nRound: ${round} | Pick: #${overallPick}\n${details}\n\nRECENT:\n${recentStr}\n\nON DECK:\n${onDeckStr}\n\nBoard: ${GFL_URL}`;

  await sendEmail({ subject, text: body });

  if (leagueId === 1 || leagueId === undefined) {
    const waMessage = `${waHeader}\n----------\n*Round ${round} | Pick #${overallPick}*\n\n${details}\n\nRECENT:\n${recentStr}\n\nON DECK:\n${onDeckStr}${nextOwner ? `\n\n👉 *NEXT UP:* ${nextOwner.toUpperCase()} 👈` : `\n\n🌐 *GFL Website:* ${GFL_URL}`}`;
    await sendWhatsApp(waMessage);
  }
}

export async function notifyTransaction({
  type, directions, leagueId,
}: {
  type: string;
  directions: Record<string, string[]>; // "From ➔ To" => asset list
  leagueId?: number;
}) {
  let emailSectionsHtml = '';
  let waSectionsText = '';

  for (const path in directions) {
    const assets = directions[path].map(item => `<li>${item}</li>`).join('');
    const waAssets = directions[path].map(item => `• ${item}`).join('\n');
    emailSectionsHtml += `
      <div style="margin-bottom:20px;border:1px solid #eee;border-radius:8px;overflow:hidden;">
        <div style="background:#f1f3f4;padding:10px;font-weight:bold;border-bottom:1px solid #eee;">${path}</div>
        <ul style="padding:15px 40px;margin:0;font-style:italic;">${assets}</ul>
      </div>`;
    waSectionsText += `*${path}:*\n${waAssets}\n\n`;
  }

  const html = `
    <div style="max-width:500px;border:2px solid #0047AB;border-radius:12px;font-family:sans-serif;text-align:center;padding:0;overflow:hidden;">
      <div style="background:#0047AB;color:white;padding:10px;"><p style="margin:0;font-size:12px;font-weight:bold;">OFFICIAL LEAGUE ACTIVITY</p></div>
      <div style="padding:20px;text-align:left;">
        <p style="font-size:24px;font-weight:bold;text-align:center;margin-bottom:20px;">${type}</p>
        ${emailSectionsHtml}
      </div>
      <p style="text-align:center;margin-top:25px;">
        <a href="${GFL_URL}" style="background-color:#0047AB;color:white;padding:12px 24px;text-decoration:none;border-radius:5px;font-weight:bold;display:inline-block;">Visit GFL Website</a>
      </p>
    </div>`;

  await sendEmail({ subject: `GFL Activity: ${type}`, html });
  if (leagueId === 1 || leagueId === undefined) {
    await sendWhatsApp(`📝 *GFL TRANSACTION: ${type}*\n----------------------------\n${waSectionsText}🌐 ${GFL_URL}`);
  }
}
