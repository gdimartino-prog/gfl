import { unstable_cache } from 'next/cache';

const TEAM_CODES = [
  'ARZ','ATL','BAL','BUF','CAR','CHI','CIN','CLE','DAL','DEN',
  'DET','GB','HOU','IND','JAX','KC','LV','LAC','LAR','MIA',
  'MIN','NE','NO','NYG','NYJ','PHI','PIT','SF','SEA','TB',
  'TEN','WAS',
];

const TEAM_FULL_NAMES: Record<string, string> = {
  ARZ: 'Arizona Cardinals', ATL: 'Atlanta Falcons', BAL: 'Baltimore Ravens',
  BUF: 'Buffalo Bills', CAR: 'Carolina Panthers', CHI: 'Chicago Bears',
  CIN: 'Cincinnati Bengals', CLE: 'Cleveland Browns', DAL: 'Dallas Cowboys',
  DEN: 'Denver Broncos', DET: 'Detroit Lions', GB: 'Green Bay Packers',
  HOU: 'Houston Texans', IND: 'Indianapolis Colts', JAX: 'Jacksonville Jaguars',
  KC: 'Kansas City Chiefs', LV: 'Las Vegas Raiders', LAC: 'Los Angeles Chargers',
  LAR: 'Los Angeles Rams', MIA: 'Miami Dolphins', MIN: 'Minnesota Vikings',
  NE: 'New England Patriots', NO: 'New Orleans Saints', NYG: 'New York Giants',
  NYJ: 'New York Jets', PHI: 'Philadelphia Eagles', PIT: 'Pittsburgh Steelers',
  SF: 'San Francisco 49ers', SEA: 'Seattle Seahawks', TB: 'Tampa Bay Buccaneers',
  TEN: 'Tennessee Titans', WAS: 'Washington Commanders',
};

export type DepthChartEntry = {
  teamCode: string;
  teamName: string;
  position: string;
  depthRank: number;
  rawName: string;
  normalizedName: string;
};

/**
 * Normalize an Ourlads name string (e.g. "Lawrence, Trevor 21/1") to match
 * how GFL players' first+last fields will be normalized for lookup.
 * Order: strip suffixes → flip "Last, First" → lower → keep a-z + spaces → collapse.
 */
function normalizeOurladsName(raw: string): string {
  let s = raw;
  // Strip trailing draft/transaction tags: " 21/1", " SF25", " CF26", " T/LV", " U/Atl", " P/Car", etc.
  s = s.replace(/\s+\d+\/\d+\s*$/, '');
  s = s.replace(/\s+[A-Z]{1,3}\/?[A-Za-z]{1,3}\d*\*?\s*$/, '');
  s = s.replace(/\s+[A-Z]{2,4}\d{2}\*?\s*$/, '');
  // Flip "Last, First" → "First Last"
  if (s.includes(',')) {
    const [last, ...rest] = s.split(',');
    s = rest.join(',').trim() + ' ' + last.trim();
  }
  return s.toLowerCase().replace(/[^a-z\s]/g, '').replace(/\s+/g, ' ').trim();
}

async function fetchTeamDepth(teamCode: string): Promise<DepthChartEntry[]> {
  const url = `https://www.ourlads.com/nfldepthcharts/depthchart/${teamCode}`;
  try {
    const res = await fetch(url, {
      headers: { 'User-Agent': 'Mozilla/5.0 (GFL scout/1.0)' },
      signal: AbortSignal.timeout(8000),
    });
    if (!res.ok) return [];
    const html = await res.text();

    const entries: DepthChartEntry[] = [];
    const rowRegex = /<tr\s+class='row-dc-(?:wht|grey)'>([\s\S]*?)<\/tr>/g;
    const teamName = TEAM_FULL_NAMES[teamCode] ?? teamCode;

    let rowMatch: RegExpExecArray | null;
    while ((rowMatch = rowRegex.exec(html)) !== null) {
      const rowHtml = rowMatch[1];
      // Position is the first <td> with content like LWR / RB / MLB / NB / RT etc.
      const posMatch = rowHtml.match(/<td[^>]*>([A-Z]{1,4})<\/td>/);
      if (!posMatch) continue;
      const position = posMatch[1];

      // Each depth slot is an <a> link. Empty slots have empty inner text; we
      // count them so the rank stays correct.
      const nameRegex = /<a [^>]*>([^<]*)<\/a>/g;
      let rank = 0;
      let nameMatch: RegExpExecArray | null;
      while ((nameMatch = nameRegex.exec(rowHtml)) !== null) {
        rank++;
        const name = nameMatch[1].trim();
        if (!name) continue;
        // Defensive hardening: cap name length and strip control chars so a
        // malformed/malicious Ourlads response can't break downstream prompt
        // construction or DOM rendering.
        const safeName = name.replace(/[\x00-\x1f\x7f]/g, '').slice(0, 80);
        entries.push({
          teamCode,
          teamName,
          position,
          depthRank: rank,
          rawName: safeName,
          normalizedName: normalizeOurladsName(safeName),
        });
      }
    }
    return entries;
  } catch {
    return [];
  }
}

const _getAllDepthCharts = unstable_cache(
  async (): Promise<DepthChartEntry[]> => {
    // Promise.allSettled so one slow team doesn't poison the whole batch.
    const settled = await Promise.allSettled(TEAM_CODES.map(t => fetchTeamDepth(t)));
    const successes = settled.filter((s): s is PromiseFulfilledResult<DepthChartEntry[]> => s.status === 'fulfilled' && s.value.length > 0);
    // Don't cache a degraded snapshot — only persist when ≥90% of teams returned
    // usable data. Below that threshold we throw so unstable_cache skips the
    // write and the next caller retries.
    if (successes.length < Math.ceil(TEAM_CODES.length * 0.9)) {
      throw new Error(`Ourlads partial fetch: only ${successes.length}/${TEAM_CODES.length} teams returned data — skipping cache write`);
    }
    return successes.flatMap(s => s.value);
  },
  ['ourlads-depth-charts-all'],
  { revalidate: 86400, tags: ['ourlads'] },
);

/**
 * Build a lookup from normalized player name → best depth chart entry.
 * A player can appear multiple times on a team (e.g. RB1 and KR1) — we keep
 * the entry from the most offense/defense-relevant position (lowest depthRank
 * on a non-ST position, falling back to ST).
 */
export async function buildDepthChartIndex(): Promise<Map<string, DepthChartEntry>> {
  const all = await _getAllDepthCharts();
  const idx = new Map<string, DepthChartEntry>();
  const ST_POSITIONS = new Set(['KR', 'PR', 'KO', 'H', 'LS', 'PT', 'PK']);
  for (const e of all) {
    const existing = idx.get(e.normalizedName);
    if (!existing) {
      idx.set(e.normalizedName, e);
      continue;
    }
    // Prefer a non-special-teams listing if one exists for this player.
    const existingIsST = ST_POSITIONS.has(existing.position);
    const newIsST = ST_POSITIONS.has(e.position);
    if (existingIsST && !newIsST) {
      idx.set(e.normalizedName, e);
    } else if (existingIsST === newIsST && e.depthRank < existing.depthRank) {
      idx.set(e.normalizedName, e);
    }
  }
  return idx;
}

export function depthRankLabel(position: string, rank: number): string {
  // Map raw position + rank to a human-readable role (e.g. RB #2 → "RB2", LWR #1 → "WR1").
  const wrPos = /WR$/.test(position) ? 'WR' : position;
  const norm = wrPos === 'LWR' || wrPos === 'RWR' || wrPos === 'SWR' ? 'WR' : wrPos;
  if (rank === 1) return `Starter (${norm}1)`;
  if (rank === 2) return `${norm}2 / rotational`;
  if (rank === 3) return `${norm}3 / depth`;
  return `${norm}${rank} / deep depth`;
}
