/**
 * Builds a stable identity hash for a player based on key fields.
 * Format: first|last|age|offense|defense|special (all lowercase)
 */
export function buildPlayerIdentity(p: {
  first?: string; last?: string; age?: number | string | null;
  offense?: string | null; defense?: string | null; special?: string | null;
}): string {
  return [p.first, p.last, p.age, p.offense, p.defense, p.special]
    .map(v => String(v || '').trim().toLowerCase())
    .join('|');
}

/**
 * Compact stats for player option labels in transaction dropdowns.
 *
 * Format per position (matching the stats sheet columns):
 *  QB        → DUR | comp/att | passYds YDS | passInt INT | passTD TD
 *  RB/HB     → DUR | rushAtt ATT | rush YDS | YPC avg | rushTD TD
 *  WR/TE     → DUR | rec REC | recYds YDS | YPR avg | recTD TD
 *  OL        → DUR | AVG avg | RUN run | PASS pass | games G
 *  DL        → DUR | OVR totalDef | RUN runDef | PASS passDef | PRS passRush
 *  LB/OLB/ILB→ DUR | OVR totalDef | RUN runDef | PASS passDef | PRS passRush
 *  DB/CB/S   → DUR | OVR totalDef | RUN runDef | PASS passDef | int INT
 *  K/P       → DUR (no sheet data for kicker/punter game stats)
 */

type PlayerLabelInput = {
  first?: string;
  last?: string;
  name?: string;
  position?: string;
  pos?: string;
  offense?: string;
  defense?: string;
  special?: string;
  // Ratings
  overall?: string | number;
  run?: string;       // run block
  pass?: string;      // pass block
  rush?: string;      // rush yards
  int?: string;       // defensive interceptions
  sack?: string;
  dur?: string;
  passRush?: string;
  tackles?: string;
  totalDef?: string;
  runDef?: string;
  passDef?: string;
  games?: string;
  // Game stats
  passAtt?: string;
  passComp?: string;
  passYds?: string;
  passTD?: string;
  passInt?: string;
  rushAtt?: string;
  rushTD?: string;
  rec?: string;
  recYds?: string;
  recTD?: string;
};

/** Returns v if it is a non-empty, non-zero value */
const nz = (v?: string | number): boolean =>
  v !== undefined && v !== null && String(v).trim() !== '' && String(v).trim() !== '0';

/** Safe integer division, returns a string to 1 decimal place */
const avg = (num?: string, den?: string): string => {
  const n = Number(num), d = Number(den);
  if (!n || !d) return '—';
  return (n / d).toFixed(1);
};

const OL_SET  = new Set(['OL', 'OT', 'OG', 'OC', 'C', 'C-G', 'C-T', 'G', 'G-T', 'T', 'FB']);
const DL_SET  = new Set(['DL', 'DE', 'DT', 'NT', 'DE-LB']);
const LB_SET  = new Set(['LB', 'OLB', 'ILB', 'MLB', 'LB-S']);
const DB_SET  = new Set(['DB', 'CB', 'S', 'FS', 'SS', 'SAF']);

export function playerOptionStats(p: PlayerLabelInput): string {
  const off  = (p.offense || '').toUpperCase().trim();
  const def  = (p.defense || '').toUpperCase().trim();

  const pos  = (p.position || p.pos || '').toUpperCase().trim();
  const posParts = pos ? pos.split('/') : [];

  const dur = nz(p.dur) ? `DUR ${p.dur}` : null;
  const seg = (...items: (string | null | undefined)[]): string =>
    items.filter(Boolean).join(' | ');

  // ── Offensive Line ──────────────────────────────────────────────────────────
  if (OL_SET.has(off) || (!off && !def && (OL_SET.has(pos) || posParts.some(p => OL_SET.has(p))))) {
    const runN = Number(p.run) || 0;
    const passN = Number(p.pass) || 0;
    const olAvg = runN && passN ? Math.round((runN + passN) / 2).toString() : null;
    return seg(
      dur,
      olAvg ? `AVG ${olAvg}` : null,
      nz(p.run)   ? `RUN ${p.run}`   : null,
      nz(p.pass)  ? `PASS ${p.pass}` : null,
      nz(p.games) ? `${p.games} G`   : null,
    );
  }

  // ── Defensive Line ──────────────────────────────────────────────────────────
  if (DL_SET.has(def) || (!off && !def && DL_SET.has(pos))) {
    return seg(
      dur,
      nz(p.totalDef) ? `OVR ${p.totalDef}` : null,
      nz(p.runDef)   ? `RUN ${p.runDef}`   : null,
      nz(p.passDef)  ? `PASS ${p.passDef}` : null,
      nz(p.passRush) ? `PRS ${p.passRush}` : null,
    );
  }

  // ── Linebackers ─────────────────────────────────────────────────────────────
  if (LB_SET.has(def) || (!off && !def && LB_SET.has(pos))) {
    return seg(
      dur,
      nz(p.totalDef) ? `OVR ${p.totalDef}` : null,
      nz(p.runDef)   ? `RUN ${p.runDef}`   : null,
      nz(p.passDef)  ? `PASS ${p.passDef}` : null,
      nz(p.passRush) ? `PRS ${p.passRush}` : null,
    );
  }

  // ── Defensive Backs ─────────────────────────────────────────────────────────
  if (DB_SET.has(def) || (!off && !def && DB_SET.has(pos))) {
    return seg(
      dur,
      nz(p.totalDef) ? `OVR ${p.totalDef}` : null,
      nz(p.runDef)   ? `RUN ${p.runDef}`   : null,
      nz(p.passDef)  ? `PASS ${p.passDef}` : null,
      nz(p.int)      ? `${p.int} INT`      : null,
    );
  }

  // ── Quarterback ─────────────────────────────────────────────────────────────
  if (off === 'QB' || posParts.includes('QB')) {
    const ratio = (nz(p.passComp) || nz(p.passAtt))
      ? `${p.passComp || '0'}/${p.passAtt || '0'}`
      : null;
    return seg(
      dur,
      ratio,
      nz(p.passYds) ? `${p.passYds} YDS` : null,
      nz(p.passInt) ? `${p.passInt} INT`  : null,
      nz(p.passTD)  ? `${p.passTD} TD`   : null,
    );
  }

  // ── Running Back / HB ───────────────────────────────────────────────────────
  if (off === 'RB' || off === 'HB' || posParts.includes('RB') || posParts.includes('HB')) {
    const ypc = nz(p.rush) && nz(p.rushAtt) ? avg(p.rush, p.rushAtt) : null;
    return seg(
      dur,
      nz(p.rushAtt) ? `${p.rushAtt} ATT`  : null,
      nz(p.rush)    ? `${p.rush} YDS`     : null,
      ypc           ? `${ypc} YPC`        : null,
      nz(p.rushTD)  ? `${p.rushTD} TD`   : null,
    );
  }

  // ── Wide Receiver / Tight End ────────────────────────────────────────────────
  if (off === 'WR' || off === 'TE' || posParts.includes('WR') || posParts.includes('TE')) {
    const ypr = nz(p.recYds) && nz(p.rec) ? avg(p.recYds, p.rec) : null;
    return seg(
      dur,
      nz(p.rec)    ? `${p.rec} REC`    : null,
      nz(p.recYds) ? `${p.recYds} YDS` : null,
      ypr          ? `${ypr} YPR`      : null,
      nz(p.recTD)  ? `${p.recTD} TD`  : null,
    );
  }

  // ── Kicker / Punter (no game stats in sheet) ────────────────────────────────
  return dur || '';
}

/** Full option label: "Smith, John (WR)  |  DUR 8 | 85 REC | 1200 YDS | 14.1 YPR | 8 TD" */
export function playerOptionLabel(p: PlayerLabelInput): string {
  const last  = p.last  || p.name || '';
  const first = p.first || '';
  const pos   = (p.position || p.pos || '??').toUpperCase();
  const stats = playerOptionStats(p);
  return `${last}, ${first} (${pos})${stats ? '  |  ' + stats : ''}`;
}
