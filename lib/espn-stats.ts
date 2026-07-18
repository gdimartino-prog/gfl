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
      if (new URL(ref).hostname !== 'sports.core.api.espn.com') return null;
    } catch {
      return null;
    }
    const teamRes = await fetch(ref, { next: { revalidate: 86400 } });
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
