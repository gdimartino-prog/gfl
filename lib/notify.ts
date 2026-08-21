import nodemailer from 'nodemailer';

const MY_EMAIL = process.env.NOTIFY_MY_EMAIL || 'gdimartino@gmail.com';
const GROUP_EMAIL = process.env.NOTIFY_GROUP_EMAIL || MY_EMAIL;
const SEND_WHATSAPP = process.env.SEND_WHATSAPP !== 'false';
export const GFL_URL = process.env.NEXT_PUBLIC_APP_URL || 'https://afl.gddevco.com';
const FROM_EMAIL = process.env.NOTIFY_FROM_EMAIL || `GFL <${MY_EMAIL}>`;

/** Escape DB/user-sourced strings before interpolating into email HTML —
 *  team names, player names, and trade-block "asking" text are all
 *  user-controlled and would otherwise inject markup into every inbox. */
export function escapeHtml(s: string | null | undefined): string {
  return (s ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

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
    console.warn('[notify] GMAIL_APP_PASSWORD not set — skipping email');
    return;
  }
  console.log('[notify] sending email:', subject);
  try {
    await getTransporter().sendMail({
      from: FROM_EMAIL,
      to: GROUP_EMAIL,
      cc: MY_EMAIL,
      subject,
      html: html || `<pre>${escapeHtml(text)}</pre>`,
      text,
    });
  } catch (e) {
    console.error('Email send failed:', e);
  }
}

export async function sendWhatsApp(message: string) {
  if (!SEND_WHATSAPP) { console.warn('[notify] SEND_WHATSAPP=false — skipping'); return; }
  const idInstance = process.env.GREENAPI_INSTANCE_ID?.trim();
  const apiToken = process.env.GREENAPI_API_TOKEN?.trim();
  const groupId = process.env.GREENAPI_GROUP_ID?.trim();
  if (!idInstance || !apiToken || !groupId) {
    console.warn('[notify] WhatsApp env vars missing — skipping (GREENAPI_INSTANCE_ID:', !!idInstance, 'GREENAPI_API_TOKEN:', !!apiToken, 'GREENAPI_GROUP_ID:', !!groupId, ')');
    return;
  }
  console.log('[notify] sending WhatsApp to chatId:', JSON.stringify(groupId));

  try {
    const res = await fetch(
      `https://7105.api.greenapi.com/waInstance${idInstance}/sendMessage/${apiToken}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ chatId: groupId, message }),
      }
    );
    if (!res.ok) {
      const body = await res.text();
      console.error('WhatsApp send failed:', res.status, body);
    }
  } catch (e) {
    console.error('WhatsApp error:', e);
  }
}

export async function notifyDraftPick({
  round, overallPick, currentOwner, originalOwner, playerName,
  timeTakenMs, recentPicks, onDeck, skippedOpen, type, leagueId,
}: {
  round: number;
  overallPick: number;
  currentOwner: string;
  originalOwner: string;
  playerName?: string;
  timeTakenMs?: number;
  recentPicks: { round: number; pick: number; player: string; owner: string; originalOwner?: string }[];
  onDeck: { round: number; pick: number; owner: string; originalOwner?: string; strikes?: number }[];
  /** Picks that were auto-skipped and still have no player attached. Coaches
   *  can submit a late selection for any of these via the draft board (the
   *  late-pick auth path is intentionally permissive). */
  skippedOpen?: { round: number; pick: number; owner: string; skippedAt: Date | null }[];
  type: 'PICK' | 'WARNING' | 'EXPIRATION' | 'PASS';
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

  const recentStr = recentPicks.map(p => {
    const via = p.originalOwner && p.originalOwner !== p.owner ? ` via ${p.originalOwner}` : '';
    return `   R${p.round} #${p.pick}: ${p.player || 'Skipped'} (${p.owner}${via})`;
  }).join('\n');

  const onDeckStr = onDeck.map(p => {
    const via = p.originalOwner && p.originalOwner !== p.owner ? ` (via ${p.originalOwner})` : '';
    const strikes = p.strikes ?? 0;
    let strikeNote = '';
    if (strikes >= 3) {
      strikeNote = `  ⚠ ${strikes} strikes — auto-skip when up`;
    } else if (strikes >= 1) {
      strikeNote = `  (${strikes} strike${strikes === 1 ? '' : 's'})`;
    }
    return `   R${p.round} #${p.pick}: ${p.owner}${via}${strikeNote}`;
  }).join('\n');

  // Skipped picks grouped by team — one line per team listing all their open picks.
  const skippedAll = skippedOpen ?? [];
  const skippedStr = (() => {
    if (!skippedAll.length) return '';
    const byTeam = new Map<string, string[]>();
    for (const p of skippedAll) {
      const key = p.owner || 'Unknown';
      if (!byTeam.has(key)) byTeam.set(key, []);
      byTeam.get(key)!.push(`R${p.round} #${p.pick}`);
    }
    return Array.from(byTeam.entries())
      .map(([team, picks]) => `   ${team}: ${picks.join(', ')}`)
      .join('\n');
  })();
  const skippedBlock = skippedAll.length > 0
    ? `\n\nSKIPPED — CAN STILL BE FILLED:\n${skippedStr}\n\nLate selections are always allowed — any coach can submit via the draft board.`
    : '';

  const nextOwner = onDeck[0]?.owner || '';
  const pingText = type === 'WARNING'
    ? `>>> @ ${currentOwner.toUpperCase()}: YOUR CLOCK IS ALMOST UP <<<\n\n`
    : type === 'PASS' || type === 'EXPIRATION'
      ? nextOwner ? `>>> @ ${nextOwner.toUpperCase()}: YOU ARE ON THE CLOCK <<<\n\n` : ''
      : nextOwner ? `>>> @ ${nextOwner.toUpperCase()}: YOU ARE ON THE CLOCK <<<\n\n` : '';

  let header = '', details = '', waHeader = '';
  if (type === 'WARNING') {
    header = '1-HOUR CLOCK WARNING';
    waHeader = '⚠️ *1-HOUR WARNING*';
    details = `${currentOwner}${tradeSuffix} has < 1 hr left.`;
  } else if (type === 'EXPIRATION') {
    header = 'PICK EXPIRED';
    waHeader = '⏰ *PICK EXPIRED*';
    details = `Team ${currentOwner}${tradeSuffix} was skipped.`;
  } else if (type === 'PASS') {
    header = 'PICK PASSED';
    waHeader = '⏭️ *PICK PASSED*';
    details = `Team ${currentOwner}${tradeSuffix} passed their pick.`;
  } else {
    header = 'LATEST PICK';
    waHeader = '🏈 *LATEST PICK*';
    details = `Team: ${currentOwner}${tradeSuffix}\nSelection: ${playerName}${timeTakenStr}`;
  }

  const subject = `GFL DRAFT (R${round}): Pick #${overallPick}${type === 'PICK' ? ` (${playerName})` : ' ' + type}`;
  const body = `${pingText}${header}:\n----------\nRound: ${round} | Pick: #${overallPick}\n${details}\n\nRECENT:\n${recentStr}\n\nON DECK:\n${onDeckStr}${skippedBlock}\n\nBoard: ${GFL_URL}/draft`;

  await sendEmail({ subject, text: body });

  if (leagueId === 1 || leagueId === undefined) {
    const waMessage = `${waHeader}\n----------\n*Round ${round} | Pick #${overallPick}*\n\n${details}\n\nRECENT:\n${recentStr}\n\nON DECK:\n${onDeckStr}${skippedBlock}${nextOwner ? `\n\n👉 *NEXT UP:* ${nextOwner.toUpperCase()} 👈` : ''}\n\n🌐 ${GFL_URL}`;
    await sendWhatsApp(waMessage);
  } else {
    console.log('[notify] skipping WhatsApp for leagueId:', leagueId);
  }
}

export async function notifyDraftComplete({
  leagueId, draftYear, totalPicks,
}: {
  leagueId: number;
  draftYear: number;
  totalPicks: number;
}) {
  const leagueName = leagueId === 1 ? 'GFL' : `League ${leagueId}`;
  const subject = `${leagueName} ${draftYear} Draft Complete`;
  const html = `
    <h2>${leagueName} ${draftYear} Draft Complete</h2>
    <p>All ${totalPicks} picks have been finalized. Congrats on a successful draft.</p>
    <p><a href="${GFL_URL}/draft">View the final draft board</a></p>
  `;
  const text = `${leagueName} ${draftYear} Draft Complete. All ${totalPicks} picks finalized. ${GFL_URL}/draft`;

  await sendEmail({ subject, html, text });
  if (leagueId === 1) {
    await sendWhatsApp(text);
  } else {
    console.log('[notify] skipping WhatsApp for leagueId:', leagueId);
  }
}

export async function notifyDraftCutoff({
  hoursLeft, deadline, leagueId, draftYear,
}: {
  hoursLeft: number | null; // null = initial "draft over" message
  deadline: Date;
  leagueId: number;
  draftYear: number;
}) {
  const leagueName = leagueId === 1 ? 'GFL' : `League ${leagueId}`;
  const deadlineET = deadline.toLocaleString('en-US', {
    timeZone: 'America/New_York',
    weekday: 'short', month: 'short', day: 'numeric',
    hour: 'numeric', minute: '2-digit', timeZoneName: 'short',
  });

  let subject: string;
  let intro: string;
  if (hoursLeft === null) {
    subject = `${leagueName} ${draftYear} Draft — 48-Hour Window Now Open`;
    intro = `The ${draftYear} ${leagueName} Free Agent Draft has concluded. Coaches now have <strong>48 hours</strong> to make any final roster moves before the draft is officially locked.`;
  } else {
    subject = `${leagueName} ${draftYear} Draft closes in ${hoursLeft} hour${hoursLeft === 1 ? '' : 's'}`;
    intro = `Reminder: The ${draftYear} ${leagueName} Draft window closes in <strong>${hoursLeft} hour${hoursLeft === 1 ? '' : 's'}</strong>. Make sure your roster is finalized.`;
  }

  const html = `
    <h2>${subject}</h2>
    <p>${intro}</p>
    <p><strong>Deadline:</strong> ${deadlineET}</p>
    <p><a href="${GFL_URL}/draft">View the draft board</a> &nbsp;|&nbsp; <a href="${GFL_URL}/rosters">View rosters</a></p>
  `;
  const text = hoursLeft === null
    ? `${leagueName} ${draftYear} Draft concluded — 48-hour window open until ${deadlineET}. ${GFL_URL}/draft`
    : `${leagueName} ${draftYear} Draft closes in ${hoursLeft}h — deadline ${deadlineET}. ${GFL_URL}/draft`;

  await sendEmail({ subject, html, text });
  if (leagueId === 1) {
    await sendWhatsApp(text);
  } else {
    console.log('[notify] skipping WhatsApp for leagueId:', leagueId);
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
    const assets = directions[path].map(item => `<li>${escapeHtml(item)}</li>`).join('');
    const waAssets = directions[path].map(item => `• ${item}`).join('\n');
    emailSectionsHtml += `
      <div style="margin-bottom:20px;border:1px solid #eee;border-radius:8px;overflow:hidden;">
        <div style="background:#f1f3f4;padding:10px;font-weight:bold;border-bottom:1px solid #eee;">${escapeHtml(path)}</div>
        <ul style="padding:15px 40px;margin:0;font-style:italic;">${assets}</ul>
      </div>`;
    waSectionsText += `*${path}:*\n${waAssets}\n\n`;
  }

  const html = `
    <div style="max-width:500px;border:2px solid #0047AB;border-radius:12px;font-family:sans-serif;text-align:center;padding:0;overflow:hidden;">
      <div style="background:#0047AB;color:white;padding:10px;"><p style="margin:0;font-size:12px;font-weight:bold;">OFFICIAL LEAGUE ACTIVITY</p></div>
      <div style="padding:20px;text-align:left;">
        <p style="font-size:24px;font-weight:bold;text-align:center;margin-bottom:20px;">${escapeHtml(type)}</p>
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

export async function notifyTradeBlock({
  newPlayer,
  block,
  leagueId,
}: {
  newPlayer: { playerName: string; team: string; position?: string | null; asking?: string | null };
  block: { playerName: string; team: string; position?: string | null; asking?: string | null }[];
  leagueId?: number;
}) {
  const blockRows = block.map(p => {
    const pos = p.position ? `[${escapeHtml(p.position)}] ` : '';
    const asking = p.asking ? ` — ${escapeHtml(p.asking)}` : '';
    return `<tr>
      <td style="padding:8px 12px;border-bottom:1px solid #f0f0f0;font-weight:bold;">${pos}${escapeHtml(p.playerName)}</td>
      <td style="padding:8px 12px;border-bottom:1px solid #f0f0f0;color:#555;">${escapeHtml(p.team)}</td>
      <td style="padding:8px 12px;border-bottom:1px solid #f0f0f0;color:#888;font-style:italic;">${asking || '—'}</td>
    </tr>`;
  }).join('');

  const waBlock = block.map(p => {
    const pos = p.position ? `[${p.position}] ` : '';
    const asking = p.asking ? ` — ${p.asking}` : '';
    return `• ${pos}${p.playerName} (${p.team})${asking}`;
  }).join('\n');

  const html = `
    <div style="max-width:560px;border:2px solid #0047AB;border-radius:12px;font-family:sans-serif;overflow:hidden;">
      <div style="background:#0047AB;color:white;padding:10px;text-align:center;">
        <p style="margin:0;font-size:12px;font-weight:bold;">OFFICIAL LEAGUE ACTIVITY</p>
      </div>
      <div style="padding:20px;">
        <p style="font-size:22px;font-weight:bold;text-align:center;margin-bottom:4px;">TRADE BLOCK UPDATE</p>
        <p style="text-align:center;color:#555;font-size:13px;margin-bottom:20px;">
          <strong>${escapeHtml(newPlayer.playerName)}</strong>${newPlayer.position ? ` (${escapeHtml(newPlayer.position)})` : ''} listed by ${escapeHtml(newPlayer.team)}
        </p>
        <p style="font-size:13px;font-weight:bold;color:#333;margin-bottom:8px;">FULL TRADE BLOCK (${block.length} player${block.length !== 1 ? 's' : ''})</p>
        <table style="width:100%;border-collapse:collapse;font-size:13px;">
          <thead>
            <tr style="background:#f8f9fa;">
              <th style="padding:8px 12px;text-align:left;color:#666;font-size:11px;text-transform:uppercase;">Player</th>
              <th style="padding:8px 12px;text-align:left;color:#666;font-size:11px;text-transform:uppercase;">Team</th>
              <th style="padding:8px 12px;text-align:left;color:#666;font-size:11px;text-transform:uppercase;">Asking</th>
            </tr>
          </thead>
          <tbody>${blockRows}</tbody>
        </table>
      </div>
      <p style="text-align:center;padding:0 20px 20px;">
        <a href="${GFL_URL}/trade-block" style="background:#0047AB;color:white;padding:12px 24px;text-decoration:none;border-radius:5px;font-weight:bold;display:inline-block;">View Trade Block</a>
      </p>
    </div>`;

  await sendEmail({ subject: `GFL Trade Block: ${newPlayer.playerName.slice(0, 60)} (${newPlayer.team.slice(0, 40)}) listed`, html });

  if (leagueId === 1 || leagueId === undefined) {
    await sendWhatsApp(
      `🔄 *TRADE BLOCK UPDATE*\n----------------------------\n` +
      `*${newPlayer.playerName}*${newPlayer.position ? ` [${newPlayer.position}]` : ''} listed by ${newPlayer.team}\n\n` +
      `*FULL BLOCK (${block.length}):*\n${waBlock}\n\n🌐 ${GFL_URL}/trade-block`
    );
  }
}
