import { GoogleGenerativeAI } from '@google/generative-ai';

export const getGeminiClient = () => {
  const apiKey = process.env.GOOGLE_GENERATIVE_AI_KEY;

  if (!apiKey) {
    throw new Error(
      'Missing GOOGLE_GENERATIVE_AI_KEY in environment variables. ' +
      'Please add your Gemini API key to .env.local'
    );
  }

  return new GoogleGenerativeAI(apiKey);
};

export async function generateBoxScoreStory(
  boxScoreContent: string,
  standings?: string,
  schedule?: string,
  coachNames?: { [coachName: string]: string }
): Promise<string> {
  const genAI = getGeminiClient();
  const model = genAI.getGenerativeModel({ model: 'gemini-2.5-flash' });

  let additionalContext = '';

  if (standings) {
    additionalContext += `\n\nCurrent Standings:\n${standings}`;
  }

  if (schedule) {
    additionalContext += `\n\nUpcoming Schedule:\n${schedule}`;
  }

  let coachHumor = '';
  if (coachNames && Object.keys(coachNames).length > 0) {
    coachHumor = `\n\nCoach Information (make light-hearted references to these coaches and their teams):`;
    for (const [coachName, teamName] of Object.entries(coachNames)) {
      coachHumor += `\n- ${coachName} coaches ${teamName}`;
    }
  }

  const prompt = `You are an expert sports writer covering professional football. Write an engaging, detailed sports column about the game that is witty, entertaining, and somewhat humorous (especially when mentioning coaches by name).

Include:
- Key plays and turning points
- Outstanding individual performances
- Strategic observations
- Game impact and implications
- Light-hearted humor about the coaches (use their actual names)
- Context from standings and what this game means for playoff positioning
- Engaging narrative and storytelling

Box Score:
${boxScoreContent}${additionalContext}${coachHumor}

Write a compelling 4-5 paragraph sports column that's entertaining and funny!`;

  try {
    const result = await model.generateContent(prompt);
    const response = await result.response;
    const text = response.text();

    if (!text) {
      throw new Error('No content generated from Gemini');
    }

    return text;
  } catch (error) {
    const errorMsg = error instanceof Error ? error.message : String(error);
    console.error('Gemini generation error:', errorMsg);
    throw error;
  }
}

type PlayerRatings = {
  name: string; position: string | null; age: number | null; overall: string | null;
  runBlock: string | null; passBlock: string | null; rushYards: string | null;
  interceptionsVal: string | null; sacksVal: string | null; durability: string | null;
  scouting?: Record<string, string> | null;
};
type ScoutRoster = PlayerRatings[];
type ScoutPool = PlayerRatings[];

export type ScoutContext = {
  teamName: string;
  teamShort: string;
  draftYear: number;
  currentRound: number | null;
  picksUntilNext: number | null;
  recentPicks: { round: number; pick: number; team: string; player: string }[];
  roster: ScoutRoster;
  pool: ScoutPool;
  rulesSummary: string;
  needsText: string;
};

export async function getDraftScoutRecommendations(ctx: ScoutContext): Promise<string> {
  const genAI = getGeminiClient();
  // Enable Google Search grounding so the model can pull current depth charts,
  // injury news, beat-reporter takes, etc.
  // Gemini 2.5+ uses the `google_search` tool (snake_case in the REST payload;
  // camelCase variants are rejected silently). The legacy SDK ships types for
  // `googleSearchRetrieval` only, so we bypass with `as unknown as never` and
  // pass both spellings to maximize the chance one is honored.
  const model = genAI.getGenerativeModel({
    model: 'gemini-2.5-flash',
    tools: [
      { google_search: {} },
      { googleSearch: {} },
    ] as unknown as never,
  });

  const formatPlayerRow = (p: PlayerRatings) => {
    const subs = [p.overall && `OVR ${p.overall}`, p.runBlock && `RB ${p.runBlock}`, p.passBlock && `PB ${p.passBlock}`, p.rushYards && `RY ${p.rushYards}`, p.interceptionsVal && `INT ${p.interceptionsVal}`, p.sacksVal && `SK ${p.sacksVal}`, p.durability && `DUR ${p.durability}`].filter(Boolean).join(' / ');
    const scout = p.scouting ? ' | ' + Object.entries(p.scouting).map(([k, v]) => `${k}:${v}`).join(', ') : '';
    return `  ${p.position ?? '?'} | ${p.name} | age ${p.age ?? '?'} | ${subs}${scout}`;
  };

  const rosterTable = ctx.roster.map(formatPlayerRow).join('\n');
  const poolTable = ctx.pool.slice(0, 400).map(formatPlayerRow).join('\n');

  const recent = ctx.recentPicks
    .map(p => `  R${p.round} #${p.pick}: ${p.team} → ${p.player}`)
    .join('\n');

  const prompt = `You are an expert NFL scout and Gridiron Football League (GFL) strategist. The user is drafting players in an ongoing GFL draft and wants your recommendations for who to target with their next pick.

MANDATORY GOOGLE SEARCH USAGE:
Before writing ANY recommendation, you MUST perform Google Search queries for each player you plan to recommend. Your training data is stale and will not reflect the current 2026 NFL season. Do not rely on training data for depth charts, injury status, or current team — these MUST come from live web search results. At a minimum, for each of the 5 top recs and 2-3 sleepers, run these searches:
  1. "site:ourlads.com [player full name]" — for current depth chart position
  2. "[player full name] depth chart 2026" — fallback for current depth chart
  3. "[player full name] injury news" OR "[player full name] 2026 season" — for current status
If a search returns zero results, try the player's full name plus their college (for rookies) or NFL team (for veterans). Only after at least one productive search may you write that player's recommendation.

HARD RULE — READ THIS FIRST:
You MUST ONLY recommend, research, or discuss players whose names appear in the "UNDRAFTED PLAYER POOL" section below. Do NOT recommend any player listed in the "CURRENT ROSTER" — they are already on the team. Do NOT recommend any player that is not in the pool, even if you remember them from training data — they are not available to be drafted. If you cannot find a good fit in the pool, say so honestly; do not invent or recall players from outside the pool list.

Your Google Search usage MUST be restricted to looking up information on players that appear in the pool. Do NOT search for or surface NFL news about players outside the pool. If a current NFL player is not in the pool, he is irrelevant to this analysis even if he is in the news.

RANKING PRIORITY ORDER (apply in this sequence when ordering the Top 5):
1. **CURRENT NFL ROLE — STARTERS FIRST**: Players who are the current Week-1 / Week-now starter on their NFL team rank highest. Then primary rotational players (RB2 with regular touches, WR2/WR3 with consistent snaps, nickel CB, 3rd-down LB). Then backups with a clear path to playing time. Then deep backups (WR4/RB3/practice-squad) only as sleepers. If two candidates look equal on GFL ratings, take the starter every time. Do NOT lead the Top 5 with a QB3 or WR4 unless you've explicitly noted there are no better-positioned players in the pool.
2. GFL fit and team-need alignment.
3. Age / long-term upside.
4. Risk profile.

EVALUATE EACH CANDIDATE ON:
1. **NFL depth-chart position** — confirmed via your Ourlads / depth-chart search (see MANDATORY GOOGLE SEARCH USAGE above). This is the dominant signal for ranking.
2. GFL position-specific sub-ratings and the scouting blob — these reflect actual player quality and drive simulation outcomes most.
2. IMPORTANT: do NOT over-weight the "Overall" rating — in the Action Football game engine that number functions essentially as a salary/cost indicator, not a quality score. A lower Overall with strong position-specific sub-ratings can be a much better pick than a high-Overall player with mediocre sub-ratings.
3. Real-world NFL context — current depth chart standing, projected role, injury history, scheme fit. USE GOOGLE SEARCH to confirm current information when relevant (e.g. "is X currently the starter for team Y", "recent injury status", "is X being phased out").
4. User's stated team needs and strategy
5. Roster gaps relative to the user's existing roster
6. Draft context (current round, picks until next selection — adjust scarcity calculus accordingly)

## GFL / ACTION FOOTBALL RATING REFERENCE
Use this when reading the pool rows and the scouting blob.

**Rating scale**: most sub-ratings are 0-10+; average is ~5-6, a 7 is good, 8+ is elite, 10+ is rare. The "Overall" is salary/cost, not quality (see above).

**QB**: pressure rating (clutch/pressure handling), audible rating (read-the-defense), scrambling frequency, comp%, INT%, TD%, sack-taken%. A QB with bad pressure rating crumbles in close games regardless of base stats.

**RB**: scheme fit is huge.
- Style (inside / outside / both) — an inside grinder is wasted behind a finesse line, and vice versa
- Short-yardage rating — short-down conversion chance
- Breakaway rating — chance of 10+ yard rips
- Keyed rating — yards lost when defense correctly keys (less negative = more dependable when keyed)
- Workhorse rating — bonus yards when defense doesn't anticipate run
- Durability rating critical for bell-cow usage

**WR**: route specialization matters.
- Routes rated up to SMLB+ (Short / Medium / Long / Bomb / deep threat). A long-route specialist is wasted in a short-pass scheme.
- Double-covered rating — reduction when double-teamed (most relevant for the team's #1)
- Higher per-catch average = more YAC and better on longer routes

**TE**: mixed role. Evaluate run block + pass block + receiving subs separately. Average TE is 4 run / 3 pass blocking.

**OL**: run block and pass block are SEPARATE ratings (0-10+, avg 6). Each point ≈ 0.1 rushing avg / 0.5 sacks per 100 atts. A 9-run / 4-pass lineman is a run-scheme fit, NOT a pass-protector — flag this explicitly when relevant.

**DL / LB / DB**: three sub-categories — pass rush, run defense, pass defense. Total points are distributed across these, so a "10-rated" pass rusher can be a 3-rated run defender. In man coverage, the specific DB vs WR matchup matters enormously. Interception ability and forced-fumble rating come from real-life stats.

**Durability** (1-10): 10 = won't miss multi-game injuries; lower = more games missed. A "+" suffix means the player stays on the field every snap; "-" means he needs rest / picks up minor injuries.

**Special-teams coverage rating**: separate scale (~3 high, -2 low). Players below 0 actively hurt return coverage even if not selected on ST.

**Penalty rating**: "+" commits fewer than average, "-" commits more.

**Usage caveat**: skill-position players degrade after overuse (mild → moderate → major penalties). A bell-cow RB without a complementary back fades down the stretch. Watchwords from the scouting blob: workhorse, bellcow, change-of-pace, complementary.

TEAM: ${ctx.teamName} (${ctx.teamShort})
DRAFT YEAR: ${ctx.draftYear}
CURRENT ROUND: ${ctx.currentRound ?? '?'}
PICKS UNTIL THEIR NEXT TURN: ${ctx.picksUntilNext ?? '?'}

USER'S STATED NEEDS / STRATEGY:
${ctx.needsText || '(none provided)'}

CURRENT ROSTER (${ctx.roster.length} players):
${rosterTable || '(empty)'}

RECENT PICKS:
${recent || '(none)'}

GFL SCORING / RULES SUMMARY:
${ctx.rulesSummary || '(no rules provided)'}

UNDRAFTED PLAYER POOL (showing up to 400; OVR=Overall (treat as salary/cost, NOT quality), RB=Run Block, PB=Pass Block, RY=Rush Yards, INT=Interceptions, SK=Sacks, DUR=Durability — the position-specific subs and scouting blob are the real quality signal):
${poolTable || '(empty)'}

## POSITION-SPECIFIC RATING TEMPLATES (use for the Ratings line below)

For each recommended player, the Ratings line MUST report ONLY the columns shown for their position group — these match the league's Free Agent Evaluation page exactly. Pull the values from the scouting blob (and the top-level OVR/DUR when listed). If a value is missing from the data, show "—". Do NOT include extra ratings outside the template.

- **QB** → Age | Att (pass attempts) | C% (completions / pass attempts as a %) | Yds (pass yards) | Int (pass interceptions) | TD (pass TD) | Sk (sacks) | Dur | Sal (= Overall)
- **RB / FB** → Age | Att (rush attempts) | RYds (rush yards) | YPC (rush yards / rush attempts) | RTD (rush TD) | Rec (receptions) | RcYd (receiving yards) | Dur | Sal
- **WR** → Age | Rec | Yds (receiving yards) | YPR (receiving yards / receptions) | Lng (receiving long) | TD (receiving TD) | Rcv (receiving) | Dur | Sal
- **TE / HB** → Age | Rec | Yds (receiving yards) | YPR | TD (receiving TD) | Rcv (receiving) | BkAv (breakaway) | Dur | Sal
- **C / G / T / OL / C-G / G-T** → Age | RBlk (run block) | PBlk (pass block) | AvgB ((RBlk + PBlk) / 2) | ShYd (short yardage) | Gms (games) | Dur | Sal
- **DT / NT / DE / DL / DE-LB** → Age | TDef (total defense) | RDef (run defense) | PDef (pass defense) | PRsh (pass rush) | Sks (sacks) | Stf (stuffs) | Dur | Sal
- **ILB / MLB / LB / OLB / LB-S** → Age | TDef | RDef | PDef | PRsh | Tkl (tackles) | Sks (sacks) | Dur | Sal
- **CB / S / SAF / FS / SS / DB** → Age | TDef | RDef | PDef | INT (interceptions) | Tkl (tackles) | Aud (audible) | Dur | Sal
- **K / K-P** → Age | FGA (field goal attempts) | FG% (field goals made / FGA as %) | Lg (field goals long) | XPA (extra point attempts) | XP% (extra points made / XPA as %) | Dur | Sal
- **P** → Age | Punts | Yds (punt yards) | Avg (punt yards / punts) | Lng (punt long) | In20 (punt inside 20) | Dur | Sal

RESPOND WITH:
**TOP 5 RECOMMENDATIONS** — for each, only choose names that appear verbatim in the UNDRAFTED PLAYER POOL above. Format each one:

### N. [Player Name] — [Position], Age [age]
**Ratings**: <render the matching position template above as a single line of "Label: value" pairs separated by " | ", e.g. for a QB: "Age: 24 | Att: 530 | C%: 64.2% | Yds: 4,210 | Int: 12 | TD: 31 | Sk: 28 | Dur: 8 | Sal: 84". Use ONLY the columns from the template for this position — no extras.>
**Depth chart**: <ONE line, formatted as "TEAM — POSITION ROLE (STATUS) [source link]". For example: "Jacksonville Jaguars — WR3 behind Brian Thomas Jr. and Gabe Davis (active) [[Ourlads](https://www.ourlads.com/nfldepthcharts/depthchart/JAX)]" or "Cleveland Browns — RB2 / rotational, splits carries with Jerome Ford (questionable, ankle) [[Ourlads](https://www.ourlads.com/nfldepthcharts/depthchart/CLE)]". The role MUST be one of: Starter / WR2 (or RB2/TE2/etc.) / WR3 (or equivalent) / Rotational / Backup / Practice Squad / IR / Released / Free Agent. **PREFERRED SOURCE for depth charts: https://www.ourlads.com/nfldepthcharts/ — search this site first via Google Search (e.g. site:ourlads.com [player name]). Fall back to ESPN, NFL.com, or team beat writers only if Ourlads doesn't have the player.** If you cannot find a current depth chart anywhere, write "Depth chart unknown — last known role: <X> (no current source)".>
**NFL scouting report**: <THIS IS THE PRIMARY OUTPUT — 4-6 substantive sentences of real-world scouting based on Google Search research. Cover, where applicable: recent target share / snap share / touches / usage trends, injury history over the last 12 months and any current durability concerns, scheme fit and playstyle (run/pass scheme, route tree, coverage scheme, blocking style), notable strengths and weaknesses as described by beat writers or analysts, college background only if recent (rookie/sophomore), and projected trajectory for the rest of the 2026 season. Be specific — name the coordinator's scheme if relevant. Do NOT repeat the depth-chart info from the line above — assume the reader has it. You MUST cite at least one real source for each player; render citations as inline markdown links inside the prose (e.g. "[ProFootballTalk](https://...) reported he led the team in red-zone targets last week"). If you genuinely could not find any web source for this player, end the section with "(no current web source — base knowledge only)" so the user knows it isn't from research.>
**GFL fit**: <1 short sentence citing 1-2 specific position sub-ratings or scouting-blob attributes that stand out; only mention Overall if it's an unusually good value (low Overall + strong subs)>
**Team fit**: <1 short sentence tying to user's stated needs/roster gaps — keep this brief, this is secondary to the NFL scouting report>
**Risk**: <1 sentence: age, depth-chart, injury, scheme>

**THEN: 2-3 DEEPER SLEEPERS** the user might miss — same format. The NFL scouting report stays the focus (still 3-5 sentences with at least one inline source link); GFL fit and Team fit can be a single short sentence each.

OUTPUT EMPHASIS: roughly 60-70% of each recommendation's word count should live in the **NFL scouting report** section. The GFL-fit and Team-fit lines are short supporting context, not the main event. If you find yourself writing more about why the player fits the team than about who the player actually is in the NFL, you are doing it wrong — rewrite to lead with the NFL scouting depth.

When you cite NFL news/depth-chart/injury info pulled from the web, render it as an inline markdown link "[label](https://...)" pointing to the actual page you used (NOT a vertexaisearch redirect — use the underlying publisher URL). Preferred sources, in order: **Ourlads.com (https://www.ourlads.com/nfldepthcharts/) for depth charts**, then ESPN, NFL.com, ProFootballTalk, The Athletic, team beat writers. Do not invent URLs — only link to pages you actually consulted via Google Search this turn. Every recommendation's NFL scouting report MUST either contain at least one such inline link or end with the explicit "(no current web source — base knowledge only)" tag.

Be opinionated. Don't hedge. Rank in order of who you'd take first.`;

  try {
    const result = await model.generateContent(prompt);
    const response = await result.response;
    const text = response.text();
    if (!text) throw new Error('No content generated from Gemini');

    // Pull grounding metadata: chunks (the cited pages) + supports (which text
    // spans cite which chunks). The SDK's type definitions have known issues
    // (typo'd "groundingChunckIndices" and segment typed as string instead of
    // an object), so we read everything as `unknown` and defensively probe both
    // spellings at runtime.
    const candidate = response.candidates?.[0] as { groundingMetadata?: unknown } | undefined;
    const gm = (candidate?.groundingMetadata ?? {}) as Record<string, unknown>;

    // Probe every plausible spelling — the SDK doesn't normalise field names
    // and the wire format sometimes uses snake_case.
    const chunksAny =
      gm.groundingChunks ??
      gm.grounding_chunks ??
      gm.groundingChunksList ??
      gm.chunks ??
      [];
    const supportsAny =
      gm.groundingSupports ??
      gm.grounding_supports ??
      [];
    const chunks = (Array.isArray(chunksAny) ? chunksAny : []) as Array<{ web?: { uri?: string; title?: string } }>;
    const supportsRaw = (Array.isArray(supportsAny) ? supportsAny : []) as Array<Record<string, unknown>>;

    // Vercel only surfaces the first console.log per invocation in `vercel logs`,
    // so pack everything into one line. Also probe the candidate root for chunks
    // in case they're a sibling of groundingMetadata, not nested under it.
    const candidateRoot = (candidate ?? {}) as Record<string, unknown>;
    const diag = {
      gmKeys: Object.keys(gm),
      candidateKeys: Object.keys(candidateRoot),
      chunksFound: chunks.length,
      supportsFound: supportsRaw.length,
      gmFull: JSON.stringify(gm).slice(0, 6000),
    };
    console.log('[scout] grounding diag:', JSON.stringify(diag));

    // Dedup chunks by URI and build a chunkIndex → finalSourceIndex map
    const finalSources: { uri: string; title: string | undefined }[] = [];
    const uriToFinal = new Map<string, number>();
    const chunkIdxToFinal = new Map<number, number>();
    chunks.forEach((c, i) => {
      const uri = c?.web?.uri;
      if (!uri) return;
      let finalIdx = uriToFinal.get(uri);
      if (finalIdx == null) {
        finalIdx = finalSources.length;
        finalSources.push({ uri, title: c.web?.title });
        uriToFinal.set(uri, finalIdx);
      }
      chunkIdxToFinal.set(i, finalIdx);
    });

    // Normalise each support: pick whichever spelling of the indices field is
    // present, and accept segment as either an object or (per stale SDK types)
    // a JSON string.
    type NormalisedSupport = { endIndex: number; indices: number[] };
    const supports: NormalisedSupport[] = supportsRaw.flatMap(s => {
      const segRaw = s.segment;
      let seg: { endIndex?: number } | null = null;
      if (segRaw && typeof segRaw === 'object') {
        seg = segRaw as { endIndex?: number };
      } else if (typeof segRaw === 'string') {
        try { seg = JSON.parse(segRaw); } catch { seg = null; }
      }
      const endIndex = seg?.endIndex;
      const indices = (s.groundingChunkIndices ?? s.groundingChunckIndices ?? s.grounding_chunk_indices) as number[] | undefined;
      if (typeof endIndex !== 'number' || !Array.isArray(indices) || indices.length === 0) return [];
      return [{ endIndex, indices }];
    });

    // Inject inline citations at each support's endIndex.
    // Walk in descending endIndex order so earlier insertions don't shift later indices.
    let annotated = text;
    const sortedSupports = [...supports].sort((a, b) => b.endIndex - a.endIndex);
    for (const sup of sortedSupports) {
      const seen = new Set<number>();
      const markers: string[] = [];
      for (const i of sup.indices) {
        const finalIdx = chunkIdxToFinal.get(i);
        if (finalIdx == null || seen.has(finalIdx)) continue;
        seen.add(finalIdx);
        markers.push(`[[${finalIdx + 1}]](${finalSources[finalIdx].uri})`);
      }
      if (markers.length === 0) continue;
      const safeEnd = Math.min(Math.max(0, sup.endIndex), annotated.length);
      annotated = annotated.slice(0, safeEnd) + ' ' + markers.join(' ') + annotated.slice(safeEnd);
    }

    if (finalSources.length === 0) return annotated;
    const list = finalSources.map((s, i) => `${i + 1}. [${s.title || s.uri}](${s.uri})`).join('\n');
    return `${annotated}\n\n---\n**Sources**\n${list}`;
  } catch (error) {
    const msg = error instanceof Error ? error.message : String(error);
    console.error('Gemini scout error:', msg);
    throw error;
  }
}

export function extractTextFromHtml(html: string): string {
  let text = html.replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '');
  text = text.replace(/<style\b[^<]*(?:(?!<\/style>)<[^<]*)*<\/style>/gi, '');

  text = text
    .replace(/&nbsp;/g, ' ')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&amp;/g, '&')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'");

  text = text.replace(/<[^>]*>/g, '');
  text = text.replace(/\s+/g, ' ').trim();

  return text;
}
