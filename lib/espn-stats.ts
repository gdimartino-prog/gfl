const ESPN_SEARCH = 'https://site.api.espn.com/apis/search/v2';
const ESPN_CORE = 'https://sports.core.api.espn.com/v2/sports/football/leagues/nfl';

function normalizeName(s: string): string {
  return s
    .toLowerCase()
    .replace(/\./g, '')             // D.J. → dj
    .replace(/'/g, '')              // To'o → Too
    .replace(/\bjr\.?\b/gi, '')     // remove Jr/Jr.
    .replace(/\bsr\.?\b/gi, '')     // remove Sr/Sr.
    .replace(/\biii\b/gi, '')       // remove III
    .replace(/\bii\b/gi, '')        // remove II
    .replace(/\biv\b/gi, '')        // remove IV
    .replace(/\s+/g, ' ')
    .trim();
}

// Search ESPN for an NFL athlete by name; returns ESPN athlete ID or null.
export async function findEspnId(firstName: string, lastName: string): Promise<string | null> {
  if (!firstName && !lastName) return null;
  try {
    // Strip suffixes from search query so "Tim Settle Jr." finds "Tim Settle"
    const cleanFirst = normalizeName(firstName);
    const cleanLast = normalizeName(lastName);
    const query = encodeURIComponent(`${cleanFirst} ${cleanLast}`.trim());
    const res = await fetch(`${ESPN_SEARCH}?query=${query}&sports=football-nfl&limit=10`, {
      next: { revalidate: 86400 * 7 },
    });
    if (!res.ok) return null;
    const data = await res.json();

    // Find the "player" result bucket
    const playerBucket = (data.results || []).find(
      (r: { type: string }) => r.type === 'player',
    );
    const contents: Array<{ uid?: string; displayName?: string }> =
      playerBucket?.contents || [];
    if (!contents.length) return null;

    // Prefer exact normalized name match; fall back to first result
    const target = normalizeName(`${firstName} ${lastName}`);
    const exact = contents.find(
      (c) => normalizeName(c.displayName || '') === target,
    );
    const best = exact || contents[0];

    // Extract numeric ID from uid: "s:20~l:28~a:4361741" → "4361741"
    const match = best?.uid?.match(/~a:(\d+)/);
    return match?.[1] ?? null;
  } catch {
    return null;
  }
}

// Fetch the NFL team abbreviation (e.g. "KC") for a given ESPN athlete ID.
export async function getNflTeam(espnId: string): Promise<string | null> {
  try {
    const athleteRes = await fetch(
      `${ESPN_CORE}/athletes/${encodeURIComponent(espnId)}`,
      { next: { revalidate: 86400 } },
    );
    if (!athleteRes.ok) return null;
    const athleteData = await athleteRes.json();
    const ref: string | undefined = athleteData?.team?.$ref;
    if (!ref) return null;
    // Validate hostname before following the $ref to prevent SSRF
    try {
      const u = new URL(ref);
      if (u.protocol !== 'https:' || u.host !== 'sports.core.api.espn.com') return null;
    } catch {
      return null;
    }
    const teamRes = await fetch(ref, { next: { revalidate: 86400 }, redirect: 'error' });
    if (!teamRes.ok) return null;
    const teamData = await teamRes.json();
    return (teamData?.abbreviation as string) ?? null;
  } catch {
    return null;
  }
}

// Fetch regular-season stats for a given ESPN athlete ID and season year.
// Returns a flat map of stat name → value (e.g. { passingYards: 3864, ... }).
export async function getEspnSeasonStats(
  espnId: string,
  year: number,
): Promise<Record<string, number> | null> {
  const currentYear = new Date().getFullYear();
  const isPast = year < currentYear;
  try {
    const res = await fetch(
      `${ESPN_CORE}/seasons/${year}/types/2/athletes/${encodeURIComponent(espnId)}/statistics`,
      { next: { revalidate: isPast ? 86400 * 30 : 3600 } },
    );
    if (!res.ok) return null;
    const data = await res.json();
    const stats: Record<string, number> = {};
    const categories: Array<{ stats: Array<{ name: string; value: number }> }> =
      data?.splits?.categories || [];
    for (const cat of categories) {
      for (const s of cat.stats || []) {
        // Keep the first occurrence — duplicate stat names across categories
        // (e.g. "interceptions" appears in both "passing" and "defensiveInterceptions")
        // should resolve to the primary category's value.
        if (s.name && typeof s.value === 'number' && !(s.name in stats)) {
          stats[s.name] = s.value;
        }
      }
    }
    return Object.keys(stats).length > 0 ? stats : null;
  } catch {
    return null;
  }
}

const ESPN_GAMELOG = 'https://site.web.api.espn.com/apis/common/v3/sports/football/nfl';

// ESPN's season-total endpoint above (`getEspnSeasonStats`) is precomputed
// by ESPN and confirmed to lag newly-finished games by hours — the gamelog
// endpoint already lists each game's line correctly the same day, so we sum
// them ourselves instead of waiting on ESPN's own rollup job. Offense/kicker
// only: gamelog has no defensive stat categories at all (checked against
// multiple active defenders, current and prior season) — returns null for
// those so the caller can fall back to getEspnSeasonStats.
export async function getEspnGamelogStats(
  espnId: string,
  year: number,
): Promise<Record<string, number> | null> {
  const currentYear = new Date().getFullYear();
  const isPast = year < currentYear;
  try {
    const res = await fetch(
      `${ESPN_GAMELOG}/athletes/${encodeURIComponent(espnId)}/gamelog?season=${year}`,
      { next: { revalidate: isPast ? 86400 * 30 : 3600 } },
    );
    if (!res.ok) return null;
    const data = await res.json();
    const names: string[] = data?.names || [];
    const seasonType = (data?.seasonTypes || []).find(
      (st: { displayName?: string }) => st?.displayName?.includes('Regular Season'),
    );
    const events: Array<{ stats?: string[] }> = seasonType?.categories?.[0]?.events || [];
    if (!names.length || !events.length) return null;

    const sums: Record<string, number> = {};
    for (const ev of events) {
      const vals = ev.stats || [];
      for (let i = 0; i < names.length; i++) {
        const key = names[i];
        const raw = vals[i];
        if (raw === undefined || raw === '-' || raw === '') continue;

        // Kicker fields come back as combined "made-attempts" strings under
        // a compound key name, e.g. "fieldGoalsMade-fieldGoalAttempts": "4-4".
        const madeAttempts = /^(-?[\d.]+)-(-?[\d.]+)$/.exec(raw);
        if (madeAttempts && key.includes('-')) {
          const [madeKey, attKey] = key.split('-');
          const made = parseFloat(madeAttempts[1]);
          const att = parseFloat(madeAttempts[2]);
          if (!Number.isNaN(made)) sums[madeKey] = (sums[madeKey] ?? 0) + made;
          if (!Number.isNaN(att)) sums[attKey] = (sums[attKey] ?? 0) + att;
          continue;
        }

        const num = parseFloat(raw);
        if (Number.isNaN(num)) continue;

        const lower = key.toLowerCase();
        if (lower.startsWith('long')) {
          // "Longest" stats are a max, not a running total.
          sums[key] = Math.max(sums[key] ?? 0, num);
        } else if (
          lower.endsWith('pct') || lower.startsWith('yardsper') ||
          lower === 'qbrating' || lower === 'adjqbr' || lower === 'fieldgoalsmadeyardsaverage'
        ) {
          // Per-game rate/average stats can't be summed — recomputed below
          // from the summed counting stats instead.
          continue;
        } else {
          sums[key] = (sums[key] ?? 0) + num;
        }
      }
    }

    if ('longFieldGoalMade' in sums) sums.longFieldGoal = sums.longFieldGoalMade;
    if (sums.passingAttempts) {
      sums.completionPct = ((sums.completions ?? 0) / sums.passingAttempts) * 100;
      sums.yardsPerPassAttempt = (sums.passingYards ?? 0) / sums.passingAttempts;
    }
    if (sums.rushingAttempts) sums.yardsPerRushAttempt = (sums.rushingYards ?? 0) / sums.rushingAttempts;
    if (sums.receptions) sums.yardsPerReception = (sums.receivingYards ?? 0) / sums.receptions;
    if (sums.fieldGoalAttempts) sums.fieldGoalPct = ((sums.fieldGoalsMade ?? 0) / sums.fieldGoalAttempts) * 100;
    if (sums.extraPointAttempts) sums.extraPointPct = ((sums.extraPointsMade ?? 0) / sums.extraPointAttempts) * 100;
    sums.gamesPlayed = events.length;

    return sums;
  } catch {
    return null;
  }
}

// Prefer the summed-from-gamelog stats (fresher, see above) and fall back to
// ESPN's season-total endpoint for positions/players gamelog doesn't cover.
export async function getFreshEspnStats(
  espnId: string,
  year: number,
): Promise<Record<string, number> | null> {
  const fromGamelog = await getEspnGamelogStats(espnId, year);
  if (fromGamelog) return fromGamelog;
  return getEspnSeasonStats(espnId, year);
}

// True if ESPN lists the athlete as a rookie (0 accrued NFL seasons). Cached
// long (14 days) since this can't change mid-season — no reason to re-check
// it on the same cadence as stats.
export async function getEspnRookieStatus(espnId: string): Promise<boolean | null> {
  try {
    const res = await fetch(
      `${ESPN_CORE}/athletes/${encodeURIComponent(espnId)}`,
      { next: { revalidate: 86400 * 14 } },
    );
    if (!res.ok) return null;
    const data = await res.json();
    const years = data?.experience?.years;
    return typeof years === 'number' ? years === 0 : null;
  } catch {
    return null;
  }
}
