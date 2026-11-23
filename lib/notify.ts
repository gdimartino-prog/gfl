import nodemailer from 'nodemailer';
import { revalidateTag } from 'next/cache';
import { logSystemEvent } from './db-helpers';
import { redactEmailAddresses } from './passwordResetRules';

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
    const user = (process.env.GMAIL_USER || MY_EMAIL).trim();
    const pass = process.env.GMAIL_APP_PASSWORD?.replace(/\s+/g, '');
    _transporter = nodemailer.createTransport({
      service: 'gmail',
      auth: {
        user,
        pass,
      },
    });
  }
  return _transporter;
}

export async function sendEmail({ subject, html, text, leagueId }: {
  subject: string;
  html?: string;
  text?: string;
  leagueId?: number;
}): Promise<boolean> {
  const targetLeague = leagueId ?? 1;
  const appPassword = process.env.GMAIL_APP_PASSWORD?.replace(/\s+/g, '');
  if (!appPassword) {
    console.warn('[notify] GMAIL_APP_PASSWORD not set — skipping email');
    await logSystemEvent('System', 'EMAIL', 'ALERT_SKIPPED', `No App Password: ${subject}`, targetLeague);
    return false;
  }
  console.log('[notify] sending email:', subject);
  const ccRecipient = GROUP_EMAIL.toLowerCase() === MY_EMAIL.toLowerCase() ? undefined : MY_EMAIL;
  const plainText = text || (html ? html.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim() : undefined);

  const MAX_RETRIES = 3;
  for (let attempt = 0; attempt <= MAX_RETRIES; attempt++) {
    try {
      await getTransporter().sendMail({
        from: FROM_EMAIL,
        to: GROUP_EMAIL,
        ...(ccRecipient ? { cc: ccRecipient } : {}),
        subject,
        html: html || `<pre>${escapeHtml(text)}</pre>`,
        text: plainText,
      });
      await logSystemEvent('System', 'EMAIL', 'ALERT_SENT', subject, targetLeague);
      return true;
    } catch (e) {
      // Invalidate cached transporter on failure to force fresh socket connection on retry
      _transporter = null;
      const errMsg = e instanceof Error ? e.message : String(e);
      console.error(`[notify] Email send attempt ${attempt + 1}/${MAX_RETRIES + 1} failed:`, errMsg);

      if (attempt < MAX_RETRIES) {
        await new Promise((resolve) => setTimeout(resolve, 1500 * (attempt + 1)));
        continue;
      }

      await logSystemEvent('System', 'EMAIL', 'ALERT_FAILED', `${subject} (${errMsg})`.slice(0, 1000), targetLeague);
      try { revalidateTag('email-alerts', 'max'); } catch {}
      return false;
    }
  }
  return false;
}

export async function sendDirectEmail({
  to,
  subject,
  html,
  text,
  leagueId,
  auditDetail,
}: {
  to: string;
  subject: string;
  html: string;
  text?: string;
  leagueId: number;
  auditDetail: string;
}): Promise<boolean> {
  if (!to || /[\r\n,;<>]/.test(to) || /[\r\n]/.test(subject) || !to.trim()) {
    return false;
  }

  const appPassword = process.env.GMAIL_APP_PASSWORD?.replace(/\s+/g, '');
  if (!appPassword) {
    console.warn('[notify] GMAIL_APP_PASSWORD not set — skipping direct email');
    await logSystemEvent('System', 'EMAIL', 'ALERT_SKIPPED', `No App Password: ${auditDetail}`, leagueId);
    return false;
  }

  const cleanTo = to.trim();
  const plainText = text || html.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim();

  const MAX_RETRIES = 2;
  for (let attempt = 0; attempt <= MAX_RETRIES; attempt++) {
    try {
      await getTransporter().sendMail({
        from: FROM_EMAIL,
        to: cleanTo,
        subject,
        html,
        text: plainText,
      });
      await logSystemEvent('System', 'EMAIL', 'DIRECT_EMAIL_SENT', auditDetail, leagueId);
      return true;
    } catch (e) {
      _transporter = null;
      const errMsg = e instanceof Error ? e.message : String(e);
      const safeErr = redactEmailAddresses(errMsg);
      const responseCode = (e as { responseCode?: number })?.responseCode;
      const isPermanent5xx = typeof responseCode === 'number' && responseCode >= 500 && responseCode < 600;
      console.error(`[notify] Direct email attempt ${attempt + 1}/${MAX_RETRIES + 1} failed:`, safeErr);

      if (!isPermanent5xx && attempt < MAX_RETRIES) {
        await new Promise((resolve) => setTimeout(resolve, 1000 * (attempt + 1)));
        continue;
      }

      await logSystemEvent('System', 'EMAIL', 'DIRECT_EMAIL_FAILED', `${auditDetail} (${safeErr})`.slice(0, 1000), leagueId);
      return false;
    }
  }
  return false;
}

export async function sendWhatsApp(message: string, leagueId?: number): Promise<boolean> {
  const targetLeague = leagueId ?? 1;
  if (!SEND_WHATSAPP) {
    console.warn('[notify] SEND_WHATSAPP=false — skipping');
    return false;
  }
  const idInstance = process.env.GREENAPI_INSTANCE_ID?.trim();
  const apiToken = process.env.GREENAPI_API_TOKEN?.trim();
  const groupId = process.env.GREENAPI_GROUP_ID?.trim();
  if (!idInstance || !apiToken || !groupId) {
    console.warn('[notify] WhatsApp env vars missing — skipping (GREENAPI_INSTANCE_ID:', !!idInstance, 'GREENAPI_API_TOKEN:', !!apiToken, 'GREENAPI_GROUP_ID:', !!groupId, ')');
    await logSystemEvent('System', 'WHATSAPP', 'ALERT_SKIPPED', 'Missing credentials', targetLeague);
    return false;
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
      await logSystemEvent('System', 'WHATSAPP', 'ALERT_FAILED', `Status ${res.status}: ${body}`.slice(0, 500), targetLeague);
      return false;
    }
    await logSystemEvent('System', 'WHATSAPP', 'ALERT_SENT', message.slice(0, 300), targetLeague);
    return true;
  } catch (e) {
    const errMsg = e instanceof Error ? e.message : String(e);
    console.error('WhatsApp error:', errMsg);
    await logSystemEvent('System', 'WHATSAPP', 'ALERT_FAILED', `Error: ${errMsg}`.slice(0, 500), targetLeague);
    return false;
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

  await sendEmail({ subject, text: body, leagueId });

  if (leagueId === 1 || leagueId === undefined) {
    const waMessage = `${waHeader}\n----------\n*Round ${round} | Pick #${overallPick}*\n\n${details}\n\nRECENT:\n${recentStr}\n\nON DECK:\n${onDeckStr}${skippedBlock}${nextOwner ? `\n\n👉 *NEXT UP:* ${nextOwner.toUpperCase()} 👈` : ''}\n\n🌐 ${GFL_URL}`;
    await sendWhatsApp(waMessage, leagueId);
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

  await sendEmail({ subject, html, text, leagueId });
  if (leagueId === 1) {
    await sendWhatsApp(text, leagueId);
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

  await sendEmail({ subject, html, text, leagueId });
  if (leagueId === 1) {
    await sendWhatsApp(text, leagueId);
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

  // Format unique subject line to prevent Gmail thread collapsing
  const paths = Object.keys(directions);
  const pathSummary = paths.length === 2 && paths[0].includes('➔') && paths[1].includes('➔')
    ? `${paths[0].split('➔')[0].trim()} ↔ ${paths[0].split('➔')[1].trim()}`
    : paths.join('; ');

  const allAssets = Object.values(directions).flat();
  const assetSummary = allAssets.length > 0
    ? ` (${allAssets.slice(0, 2).map(a => a.split(' - ')[0].trim()).join(', ')}${allAssets.length > 2 ? ` +${allAssets.length - 2}` : ''})`
    : '';

  const nowET = new Date().toLocaleString('en-US', {
    timeZone: 'America/New_York',
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  });

  const subject = `GFL Activity: ${type} — ${pathSummary}${assetSummary} · ${nowET}`;
  const plainText = `OFFICIAL LEAGUE ACTIVITY: ${type}\n----------------------------\n${waSectionsText}Website: ${GFL_URL}`;

  await sendEmail({ subject, html, text: plainText, leagueId });
  if (leagueId === 1 || leagueId === undefined) {
    await sendWhatsApp(`📝 *GFL TRANSACTION: ${type}*\n----------------------------\n${waSectionsText}🌐 ${GFL_URL}`, leagueId);
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

  const nowET = new Date().toLocaleString('en-US', {
    timeZone: 'America/New_York',
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  });
  const subject = `GFL Trade Block: ${newPlayer.playerName.slice(0, 60)} (${newPlayer.team.slice(0, 40)}) listed · ${nowET}`;
  const plainText = `TRADE BLOCK UPDATE\n----------------------------\n${newPlayer.playerName}${newPlayer.position ? ` [${newPlayer.position}]` : ''} listed by ${newPlayer.team}\n\nFULL BLOCK (${block.length}):\n${waBlock}\n\nWebsite: ${GFL_URL}/trade-block`;

  await sendEmail({ subject, html, text: plainText, leagueId });

  if (leagueId === 1 || leagueId === undefined) {
    await sendWhatsApp(
      `🔄 *TRADE BLOCK UPDATE*\n----------------------------\n` +
      `*${newPlayer.playerName}*${newPlayer.position ? ` [${newPlayer.position}]` : ''} listed by ${newPlayer.team}\n\n` +
      `*FULL BLOCK (${block.length}):*\n${waBlock}\n\n🌐 ${GFL_URL}/trade-block`,
      leagueId
    );
  }
}

function formatEasternDateTime(date: Date): string {
  return date.toLocaleString('en-US', {
    timeZone: 'America/New_York',
    weekday: 'short',
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
    timeZoneName: 'short',
  });
}

export async function notifyPollOpened({
  title,
  description,
  pollType,
  options,
  closesAt,
  isRunoff = false,
  leagueId,
}: {
  title: string;
  description?: string | null;
  pollType: string;
  options: string[];
  closesAt: Date;
  isRunoff?: boolean;
  leagueId: number;
}) {
  if (leagueId !== 1) {
    console.log('[notify] skipping poll opened notification for leagueId:', leagueId);
    return;
  }

  const closesET = formatEasternDateTime(closesAt);
  const kindLabel = isRunoff
    ? 'Runoff Poll (E11)'
    : pollType === 'rule_change'
      ? 'Rule Change Proposal (E12)'
      : 'League Poll';
  const subject = isRunoff ? `GFL Runoff Poll: ${title.slice(0, 90)}` : `GFL Poll Open: ${title.slice(0, 90)}`;

  const optionsHtml = options.map((opt) => `<li style="margin:4px 0;">${escapeHtml(opt)}</li>`).join('');
  const optionsText = options.map((opt, idx) => `${idx + 1}. ${opt}`).join('\n');

  const html = `
    <div style="max-width:560px;border:2px solid #0047AB;border-radius:12px;font-family:sans-serif;overflow:hidden;">
      <div style="background:#0047AB;color:white;padding:10px;text-align:center;">
        <p style="margin:0;font-size:12px;font-weight:bold;">GFL LEAGUE POLL — ${escapeHtml(kindLabel.toUpperCase())}</p>
      </div>
      <div style="padding:20px;">
        <h2 style="margin:0 0 8px 0;color:#0f172a;">${escapeHtml(title)}</h2>
        ${description ? `<p style="color:#475569;font-size:14px;line-height:1.5;margin:0 0 14px 0;">${escapeHtml(description)}</p>` : ''}
        <p style="font-size:12px;font-weight:bold;color:#334155;margin-bottom:6px;text-transform:uppercase;">Ballot Choices</p>
        <ol style="margin:0 0 16px 0;padding-left:20px;color:#1e293b;font-size:14px;">${optionsHtml}</ol>
        <p style="font-size:13px;color:#334155;"><strong>Voting Closes:</strong> ${escapeHtml(closesET)}</p>
        <p style="font-size:12px;color:#64748b;">Choices remain private until the poll closes; roll call tracks participation.</p>
      </div>
      <p style="text-align:center;padding:0 20px 20px;">
        <a href="${GFL_URL}/polls" style="background:#0047AB;color:white;padding:12px 24px;text-decoration:none;border-radius:5px;font-weight:bold;display:inline-block;">Vote on GFL Polls</a>
      </p>
    </div>`;

  const text = `${kindLabel}: ${title}\n${description ? `${description}\n\n` : '\n'}Choices:\n${optionsText}\n\nCloses: ${closesET}\nVote: ${GFL_URL}/polls`;

  await sendEmail({ subject, html, text, leagueId });
  await sendWhatsApp(
    `🗳️ *${isRunoff ? 'GFL RUNOFF POLL' : 'NEW GFL POLL'}*\n----------------------------\n*${title}*${description ? `\n${description}` : ''}\n\n*Choices:*\n${optionsText}\n\n⏰ Closes: ${closesET}\n👉 ${GFL_URL}/polls`,
    leagueId,
  );
}

export async function notifyPollReminder({
  title,
  closesAt,
  votesCast,
  eligibleTeamCount,
  nonVotedTeams,
  leagueId,
}: {
  title: string;
  closesAt: Date;
  votesCast: number;
  eligibleTeamCount: number;
  nonVotedTeams: string[];
  leagueId: number;
}) {
  if (leagueId !== 1) {
    console.log('[notify] skipping poll reminder notification for leagueId:', leagueId);
    return;
  }

  const closesET = formatEasternDateTime(closesAt);
  const subject = `GFL Poll Reminder: ${title.slice(0, 90)}`;
  const waitingHtml = nonVotedTeams.map((t) => `<li>${escapeHtml(t)}</li>`).join('');
  const waitingText = nonVotedTeams.map((t) => `• ${t}`).join('\n');

  const html = `
    <div style="max-width:560px;border:2px solid #d97706;border-radius:12px;font-family:sans-serif;overflow:hidden;">
      <div style="background:#d97706;color:white;padding:10px;text-align:center;">
        <p style="margin:0;font-size:12px;font-weight:bold;">POLL VOTING REMINDER (E12)</p>
      </div>
      <div style="padding:20px;">
        <h2 style="margin:0 0 8px 0;color:#0f172a;">${escapeHtml(title)}</h2>
        <p style="font-size:13px;color:#334155;"><strong>Turnout:</strong> ${votesCast} of ${eligibleTeamCount} teams voted</p>
        <p style="font-size:13px;color:#334155;"><strong>Closes:</strong> ${escapeHtml(closesET)}</p>
        <p style="font-size:12px;font-weight:bold;color:#334155;margin:12px 0 6px 0;text-transform:uppercase;">Still Waiting On (${nonVotedTeams.length})</p>
        <ul style="margin:0;padding-left:20px;color:#1e293b;font-size:13px;">${waitingHtml}</ul>
      </div>
      <p style="text-align:center;padding:0 20px 20px;">
        <a href="${GFL_URL}/polls" style="background:#d97706;color:white;padding:12px 24px;text-decoration:none;border-radius:5px;font-weight:bold;display:inline-block;">Cast Your Vote</a>
      </p>
    </div>`;

  const text = `POLL REMINDER: ${title}\nTurnout: ${votesCast}/${eligibleTeamCount}\nCloses: ${closesET}\n\nNot yet voted (${nonVotedTeams.length}):\n${waitingText}\n\nVote: ${GFL_URL}/polls`;

  await sendEmail({ subject, html, text, leagueId });
  await sendWhatsApp(
    `⏳ *GFL POLL REMINDER*\n----------------------------\n*${title}*\nTurnout: ${votesCast}/${eligibleTeamCount}\nCloses: ${closesET}\n\n*Not yet voted:*\n${nonVotedTeams.join(', ')}\n\n👉 ${GFL_URL}/polls`,
    leagueId,
  );
}

export async function notifyPollFinalized({
  title,
  pollType,
  status,
  winnerLabel,
  votesCast,
  eligibleTeamCount,
  optionTallies,
  leagueId,
}: {
  title: string;
  pollType: string;
  status: string;
  winnerLabel: string | null;
  votesCast: number;
  eligibleTeamCount: number;
  optionTallies: { label: string; count: number; pct: number }[];
  leagueId: number;
}) {
  if (leagueId !== 1) {
    console.log('[notify] skipping poll finalized notification for leagueId:', leagueId);
    return;
  }

  let outcomeHeadline = 'Poll Closed';
  if (status === 'null_quorum') {
    outcomeHeadline = 'Null Result — Quorum Not Met (Rule E13; Status Quo Remains)';
  } else if (status === 'runoff_needed') {
    outcomeHeadline = 'Runoff Required — No Choice Reached 50% + 1 (Rule E11)';
  } else if (status === 'tied') {
    outcomeHeadline = 'Tied — Status Quo Remains';
  } else if (winnerLabel) {
    outcomeHeadline = `Approved: ${winnerLabel}`;
  } else if (pollType === 'general') {
    outcomeHeadline = 'Closed — No Votes Cast';
  }

  const subject = `GFL Poll Result: ${title.slice(0, 80)}`;
  const rowsHtml = optionTallies
    .map(
      (o) =>
        `<tr><td style="padding:6px 10px;border-bottom:1px solid #e2e8f0;">${escapeHtml(o.label)}</td><td style="padding:6px 10px;border-bottom:1px solid #e2e8f0;text-align:right;font-weight:bold;">${o.count} (${o.pct}%)</td></tr>`,
    )
    .join('');
  const tallyText = optionTallies.map((o) => `• ${o.label}: ${o.count} (${o.pct}%)`).join('\n');

  const html = `
    <div style="max-width:560px;border:2px solid #0f172a;border-radius:12px;font-family:sans-serif;overflow:hidden;">
      <div style="background:#0f172a;color:white;padding:10px;text-align:center;">
        <p style="margin:0;font-size:12px;font-weight:bold;">GFL POLL OFFICIAL RESULTS</p>
      </div>
      <div style="padding:20px;">
        <h2 style="margin:0 0 8px 0;color:#0f172a;">${escapeHtml(title)}</h2>
        <p style="padding:10px 12px;background:#f1f5f9;border-radius:8px;font-weight:bold;color:#0f172a;">${escapeHtml(outcomeHeadline)}</p>
        <p style="font-size:13px;color:#475569;"><strong>Turnout:</strong> ${votesCast} of ${eligibleTeamCount} teams</p>
        <table style="width:100%;border-collapse:collapse;font-size:13px;margin-top:8px;">
          <tbody>${rowsHtml}</tbody>
        </table>
      </div>
      <p style="text-align:center;padding:0 20px 20px;">
        <a href="${GFL_URL}/polls" style="background:#0047AB;color:white;padding:12px 24px;text-decoration:none;border-radius:5px;font-weight:bold;display:inline-block;">View Full Vote Breakdown</a>
      </p>
    </div>`;

  const text = `POLL RESULT: ${title}\n${outcomeHeadline}\nTurnout: ${votesCast}/${eligibleTeamCount}\n\nResults:\n${tallyText}\n\nDetails: ${GFL_URL}/polls`;

  await sendEmail({ subject, html, text, leagueId });
  await sendWhatsApp(
    `📊 *GFL POLL RESULTS*\n----------------------------\n*${title}*\n*Outcome:* ${outcomeHeadline}\nTurnout: ${votesCast}/${eligibleTeamCount}\n\n${tallyText}\n\n🌐 ${GFL_URL}/polls`,
    leagueId,
  );
}
