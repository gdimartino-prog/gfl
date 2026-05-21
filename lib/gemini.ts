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
  const model = genAI.getGenerativeModel({
    model: 'gemini-2.5-flash',
    tools: [{ googleSearch: {} } as unknown as never],
  });

  const formatPlayerRow = (p: PlayerRatings) => {
    const subs = [p.overall && `OVR ${p.overall}`, p.runBlock && `RB ${p.runBlock}`, p.passBlock && `PB ${p.passBlock}`, p.rushYards && `RY ${p.rushYards}`, p.interceptionsVal && `INT ${p.interceptionsVal}`, p.sacksVal && `SK ${p.sacksVal}`, p.durability && `DUR ${p.durability}`].filter(Boolean).join(' / ');
    const scout = p.scouting ? ' | ' + Object.entries(p.scouting).map(([k, v]) => `${k}:${v}`).join(', ') : '';
    return `  ${p.position ?? '?'} | ${p.name} | age ${p.age ?? '?'} | ${subs}${scout}`;
  };

  const rosterTable = ctx.roster.map(formatPlayerRow).join('\n');
  const poolTable = ctx.pool.slice(0, 200).map(formatPlayerRow).join('\n');

  const recent = ctx.recentPicks
    .map(p => `  R${p.round} #${p.pick}: ${p.team} → ${p.player}`)
    .join('\n');

  const prompt = `You are an expert NFL scout and Gridiron Football League (GFL) strategist. The user is drafting players in an ongoing GFL draft and wants your recommendations for who to target with their next pick.

EVALUATE EACH CANDIDATE ON:
1. GFL position-specific sub-ratings (Run Block, Pass Block, Rush Yards, Interceptions, Sacks, Durability) and the scouting blob — these reflect actual player quality and drive simulation outcomes most.
2. IMPORTANT: do NOT over-weight the "Overall" rating — in the Action Football game engine that number functions essentially as a salary/cost indicator, not a quality score. A lower Overall with strong position-specific sub-ratings can be a much better pick than a high-Overall player with mediocre sub-ratings.
3. Real-world NFL context — current depth chart standing, projected role, injury history, scheme fit. USE GOOGLE SEARCH to confirm current information when relevant (e.g. "is X currently the starter for team Y", "recent injury status", "is X being phased out").
4. User's stated team needs and strategy
5. Roster gaps relative to the user's existing roster
6. Draft context (current round, picks until next selection — adjust scarcity calculus accordingly)

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

UNDRAFTED PLAYER POOL (showing up to 200; OVR=Overall (treat as salary/cost, NOT quality), RB=Run Block, PB=Pass Block, RY=Rush Yards, INT=Interceptions, SK=Sacks, DUR=Durability — the position-specific subs and scouting blob are the real quality signal):
${poolTable || '(empty)'}

RESPOND WITH:
**TOP 5 RECOMMENDATIONS** — for each, in this exact format:

### N. [Player Name] — [Position]
**GFL fit**: <1-2 sentences citing specific position sub-ratings and scouting attributes; only mention Overall if it's an unusually good value (low Overall + strong subs)>
**NFL outlook**: <1-2 sentences from web context — be specific about current role/depth chart/injury>
**Why for THIS team**: <1-2 sentences tied to needs/roster gaps>
**Risk**: <1 sentence: age, depth-chart, injury, scheme>

**THEN: 2-3 DEEPER SLEEPERS** the user might miss — same format, briefer.

When you cite NFL news/depth-chart/injury info pulled from the web, mark it inline like (Source: ESPN) or (Source: ProFootballTalk) so the user can see what came from research vs. base knowledge.

Be opinionated. Don't hedge. Rank in order of who you'd take first.`;

  try {
    const result = await model.generateContent(prompt);
    const response = await result.response;
    const text = response.text();
    if (!text) throw new Error('No content generated from Gemini');

    // Append a Sources section from the grounding metadata if present
    const candidate = response.candidates?.[0] as { groundingMetadata?: { groundingChunks?: Array<{ web?: { uri?: string; title?: string } }> } } | undefined;
    const chunks = candidate?.groundingMetadata?.groundingChunks ?? [];
    const sources = chunks
      .map(c => ({ uri: c?.web?.uri, title: c?.web?.title }))
      .filter((s): s is { uri: string; title: string | undefined } => !!s.uri);
    const dedup = Array.from(new Map(sources.map(s => [s.uri, s])).values());

    if (dedup.length === 0) return text;
    const list = dedup.map((s, i) => `${i + 1}. [${s.title || s.uri}](${s.uri})`).join('\n');
    return `${text}\n\n---\n**Sources**\n${list}`;
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
