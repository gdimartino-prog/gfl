import { NextResponse } from 'next/server';
import { isPrivileged } from '@/lib/auth';
import { db } from '@/lib/db';
import { auditLog } from '@/schema';
import { eq, desc } from 'drizzle-orm';

// Gemini 2.5 Flash pricing (per million tokens, non-thinking mode)
const INPUT_COST_PER_M = 0.075;
const OUTPUT_COST_PER_M = 0.30;
const CHARS_PER_TOKEN = 4;
// Fixed prompt template overhead (chars) added to every press-box call
const PROMPT_OVERHEAD_CHARS = 650;
// Estimated output tokens per generated story (4-5 paragraphs)
const EST_OUTPUT_TOKENS = 800;

function estimateCost(inputChars: number) {
  const inputTokens = Math.ceil((inputChars + PROMPT_OVERHEAD_CHARS) / CHARS_PER_TOKEN);
  const inputCost = (inputTokens / 1_000_000) * INPUT_COST_PER_M;
  const outputCost = (EST_OUTPUT_TOKENS / 1_000_000) * OUTPUT_COST_PER_M;
  return { inputTokens, outputTokens: EST_OUTPUT_TOKENS, totalCost: inputCost + outputCost };
}

export async function GET() {
  if (!(await isPrivileged())) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 403 });
  }

  const rows = await db.select()
    .from(auditLog)
    .where(eq(auditLog.action, 'PRESS_BOX_STORY'))
    .orderBy(desc(auditLog.timestamp));

  const events = rows.map(r => {
    const charsMatch = r.details?.match(/chars=(\d+)/);
    const fileMatch = r.details?.match(/file=(.+?)\s+chars=/);
    const inputChars = charsMatch ? parseInt(charsMatch[1], 10) : 0;
    const { inputTokens, outputTokens, totalCost } = estimateCost(inputChars);
    return {
      id: r.id,
      timestamp: r.timestamp,
      coach: r.coach,
      team: r.team,
      leagueId: r.leagueId,
      fileName: fileMatch ? fileMatch[1] : r.details,
      inputChars,
      inputTokens,
      outputTokens,
      estimatedCostUsd: totalCost,
    };
  });

  const totalCost = events.reduce((sum, e) => sum + e.estimatedCostUsd, 0);

  // Usage by coach
  const byCoach: Record<string, { coach: string; team: string; uses: number; totalCost: number }> = {};
  for (const e of events) {
    const key = e.team ?? e.coach ?? 'Unknown';
    if (!byCoach[key]) byCoach[key] = { coach: e.coach ?? '', team: e.team ?? '', uses: 0, totalCost: 0 };
    byCoach[key].uses++;
    byCoach[key].totalCost += e.estimatedCostUsd;
  }

  return NextResponse.json({
    events,
    summary: {
      totalUses: events.length,
      totalCostUsd: totalCost,
      byCoach: Object.values(byCoach).sort((a, b) => b.uses - a.uses),
      model: 'gemini-2.5-flash',
      costNote: 'Estimated from stored input chars. Output tokens fixed at ~800/story.',
    },
  });
}
