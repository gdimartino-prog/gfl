export const FA_DEADLINE_RULE = 'fa_trade_deadline';

export type PositionInput = {
  position?: string | null;
  pos?: string | null;
  offense?: string | null;
  defense?: string | null;
  special?: string | null;
};

function getNewYorkOffsetForDate(year: number, month: number, day: number): string {
  // Probe 17:00 UTC (midday ET) so we stay well clear of 2:00 AM DST transitions.
  const probe = new Date(Date.UTC(year, month - 1, day, 17, 0, 0));
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone: 'America/New_York',
    timeZoneName: 'longOffset',
  }).formatToParts(probe);
  const tzValue = parts.find(p => p.type === 'timeZoneName')?.value ?? '';
  const match = tzValue.match(/GMT([+-])(\d{1,2})(?::(\d{2}))?/);
  if (!match) return '-05:00';
  const sign = match[1];
  const hours = match[2].padStart(2, '0');
  const mins = (match[3] ?? '00').padStart(2, '0');
  return `${sign}${hours}:${mins}`;
}

/**
 * Parses `fa_trade_deadline` values. Date-only strings (`YYYY-MM-DD` or `M/D/YYYY`)
 * are interpreted as end-of-day (23:59:59.999) in `America/New_York`, and naive
 * ISO datetimes without an explicit timezone offset are also anchored to `America/New_York`.
 */
export function parseFaDeadline(raw?: string | null): Date | null {
  if (!raw || !raw.trim()) return null;
  const trimmed = raw.trim();

  let year: number | null = null;
  let month: number | null = null;
  let day: number | null = null;

  const isoDateMatch = trimmed.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  const usDateMatch = trimmed.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);

  if (isoDateMatch) {
    year = Number(isoDateMatch[1]);
    month = Number(isoDateMatch[2]);
    day = Number(isoDateMatch[3]);
  } else if (usDateMatch) {
    month = Number(usDateMatch[1]);
    day = Number(usDateMatch[2]);
    year = Number(usDateMatch[3]);
  }

  if (year !== null && month !== null && day !== null) {
    const check = new Date(Date.UTC(year, month - 1, day, 12, 0, 0));
    if (
      check.getUTCFullYear() !== year ||
      check.getUTCMonth() !== month - 1 ||
      check.getUTCDate() !== day
    ) {
      return null;
    }
    const offset = getNewYorkOffsetForDate(year, month, day);
    const yyyy = String(year).padStart(4, '0');
    const mm = String(month).padStart(2, '0');
    const dd = String(day).padStart(2, '0');
    const parsed = new Date(`${yyyy}-${mm}-${dd}T23:59:59.999${offset}`);
    return Number.isNaN(parsed.getTime()) ? null : parsed;
  }

  // Naive ISO datetime without timezone offset (e.g. 2026-11-03T16:00:00) -> anchor to ET
  const naiveDateTimeMatch = trimmed.match(
    /^(\d{4})-(\d{2})-(\d{2})[T ](\d{2}):(\d{2})(?::(\d{2}))?$/,
  );
  if (naiveDateTimeMatch) {
    const y = Number(naiveDateTimeMatch[1]);
    const m = Number(naiveDateTimeMatch[2]);
    const d = Number(naiveDateTimeMatch[3]);
    const hh = naiveDateTimeMatch[4];
    const min = naiveDateTimeMatch[5];
    const sec = naiveDateTimeMatch[6] ?? '00';
    const check = new Date(Date.UTC(y, m - 1, d, 12, 0, 0));
    if (
      check.getUTCFullYear() !== y ||
      check.getUTCMonth() !== m - 1 ||
      check.getUTCDate() !== d
    ) {
      return null;
    }
    const offset = getNewYorkOffsetForDate(y, m, d);
    const parsed = new Date(
      `${naiveDateTimeMatch[1]}-${naiveDateTimeMatch[2]}-${naiveDateTimeMatch[3]}T${hh}:${min}:${sec}${offset}`,
    );
    return Number.isNaN(parsed.getTime()) ? null : parsed;
  }

  const parsed = new Date(trimmed);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
}

export function isFaDeadlinePassed(raw?: string | null, now: Date = new Date()): boolean {
  const deadline = parseFaDeadline(raw);
  return deadline !== null && now.getTime() > deadline.getTime();
}

export function formatFaDeadlineET(raw?: string | null): string | null {
  const deadline = parseFaDeadline(raw);
  if (!deadline) return null;
  return deadline.toLocaleString('en-US', {
    timeZone: 'America/New_York',
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
    timeZoneName: 'short',
  });
}

const RETURN_ONLY = new Set(['KR', 'PR', 'RET']);
const SPECIAL_KICKING = new Set(['K', 'P', 'K-P']);

const TOKEN_MAP: Record<string, string[]> = {
  OT: ['T'],
  OG: ['G'],
  OC: ['C'],
  OL: ['C', 'G', 'T'],
  HB: ['RB'],
  FB: ['RB'],
  RB: ['RB'],
  NT: ['DT'],
  DT: ['DT'],
  DL: ['DE', 'DT'],
  MLB: ['ILB'],
  ILB: ['ILB'],
  LB: ['ILB', 'OLB'],
  FS: ['S'],
  SS: ['S'],
  SAF: ['S'],
  S: ['S'],
  DB: ['CB', 'S'],
};

/**
 * Extracts normalized position tokens from a player record, expanding generic/combo
 * designations (e.g., `OL`, `DL`, `LB`, `DB`, `C-G`) and ignoring return-only tags
 * (`KR`, `PR`, `RET`) when scrimmage/kicking positions exist.
 */
export function extractPositionTokens(p: PositionInput): string[] {
  const rawCodes: string[] = [];
  const off = (p.offense || '').trim().toUpperCase();
  const def = (p.defense || '').trim().toUpperCase();
  const spec = (p.special || '').trim().toUpperCase();

  if (off) rawCodes.push(off);
  if (def) rawCodes.push(def);
  if (spec && SPECIAL_KICKING.has(spec)) rawCodes.push(spec);

  let splitParts: string[];
  if (rawCodes.length > 0) {
    splitParts = rawCodes.flatMap(code => code.split(/[-/]/)).map(t => t.trim()).filter(Boolean);
  } else {
    const pos = (p.position || p.pos || '').trim().toUpperCase();
    const parts = pos
      .split(/[-/]/)
      .map(t => t.trim())
      .filter(t => t !== '' && t !== '??');
    const nonReturn = parts.filter(t => !RETURN_ONLY.has(t));
    splitParts = nonReturn.length > 0 ? nonReturn : parts;
  }

  const out = new Set<string>();
  for (const part of splitParts) {
    if (!part || part === '??') continue;
    for (const mapped of TOKEN_MAP[part] ?? [part]) {
      out.add(mapped);
    }
  }
  return Array.from(out);
}

const GROUP_TOKENS: Record<string, string[]> = {
  'QB': ['QB'],
  'RB/HB': ['RB'],
  'WR': ['WR'],
  'TE': ['TE'],
  'OL': ['C', 'G', 'T'],
  'DL': ['DE', 'DT'],
  'LB': ['ILB', 'OLB'],
  'DB': ['CB', 'S'],
  'K/P': ['K', 'P'],
};

const TOKEN_TO_GROUP: Record<string, string> = Object.fromEntries(
  Object.entries(GROUP_TOKENS).flatMap(([group, tokens]) =>
    tokens.map(token => [token, group]),
  ),
);

/**
 * Maps a player's normalized position tokens to unit groups (`OL`, `DL`, `LB`,
 * `DB`, `RB/HB`, `K/P`, etc.), falling back to the raw token if unmapped.
 */
export function extractUnitGroups(p: PositionInput): string[] {
  const out = new Set<string>();
  for (const token of extractPositionTokens(p)) {
    out.add(TOKEN_TO_GROUP[token] ?? token);
  }
  return Array.from(out);
}

export function isInjuryPositionMatch(injured: PositionInput, candidate: PositionInput): boolean {
  const injuredGroups = extractUnitGroups(injured);
  const candidateGroups = extractUnitGroups(candidate);
  if (injuredGroups.length === 0 || candidateGroups.length === 0) return true;
  return injuredGroups.some(g => candidateGroups.includes(g));
}

export function matchesPositionFilter(
  p: PositionInput,
  filter: string,
  injuredPlayer?: PositionInput | null,
): boolean {
  if (filter === 'ALL') return true;
  if (filter === 'MATCH') {
    return injuredPlayer ? isInjuryPositionMatch(injuredPlayer, p) : true;
  }
  const allowed = GROUP_TOKENS[filter];
  if (!allowed) return true;
  const tokens = extractPositionTokens(p);
  return tokens.some(t => allowed.includes(t));
}
