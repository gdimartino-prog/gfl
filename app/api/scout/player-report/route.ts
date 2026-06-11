import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/auth';
import { db } from '@/lib/db';
import { players, teams } from '@/schema';
import { and, eq, sql } from 'drizzle-orm';
import { getLeagueId } from '@/lib/getLeagueId';
import { streamPlayerReport, buildPlayerReportPrompt } from '@/lib/gemini';
import { tokenBucket } from '@/lib/rateLimit';
import { logSystemEvent } from '@/lib/db-helpers';
import { remark } from 'remark';
import remarkHtml from 'remark-html';
import remarkGfm from 'remark-gfm';

export const maxDuration = 60;

export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session?.user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  try {
    const body = await req.json();
    const playerName: string = (body.playerName || '').toString().trim().slice(0, 200);
    const teamShortIn: string | null = body.teamShort ? String(body.teamShort).toUpperCase() : null;
    const modeIn = typeof body.mode === 'string' ? body.mode : 'run';
    const mode: 'run' | 'copy' = modeIn === 'copy' ? 'copy' : 'run';

    if (!playerName) return NextResponse.json({ error: 'playerName is required' }, { status: 400 });

    // Rate limit only applies to 'run' mode — copy mode has no API cost.
    if (mode === 'run') {
      const rateKey = `player-report:${(session.user as { id?: string }).id || session.user.email || 'anon'}`;
      const rl = tokenBucket(rateKey, 10, 3600);
      if (!rl.ok) {
        return NextResponse.json(
          { error: `Rate limit exceeded. Try again in ${rl.retryAfterSec}s.` },
          { status: 429, headers: { 'Retry-After': String(rl.retryAfterSec) } },
        );
      }
    }

    const leagueId = await getLeagueId();

    // Single join query: validates the player exists in the DB (guards against prompt
    // injection via arbitrary playerName strings) and fetches position in one round-trip.
    const playerRow = await db
      .select({ position: players.position })
      .from(players)
      .innerJoin(teams, eq(players.teamId, teams.id))
      .where(and(
        eq(players.leagueId, leagueId),
        teamShortIn ? sql`upper(${teams.teamshort}) = ${teamShortIn}` : undefined,
        sql`lower(${players.name}) = ${playerName.toLowerCase()}`,
      ))
      .limit(1);

    if (!playerRow[0]) {
      return NextResponse.json({ error: 'Player not found' }, { status: 404 });
    }
    const position = playerRow[0].position ?? null;

    const callerCoachName = session.user.name || 'Unknown Coach';
    const callerTeamshort = (session.user as { id?: string }).id || '';

    if (mode === 'copy') {
      const promptText = buildPlayerReportPrompt(playerName, position);
      await logSystemEvent(callerCoachName, callerTeamshort, 'SCOUT_PLAYER_REPORT_COPY', `player=${playerName} team=${teamShortIn ?? 'unknown'}`, leagueId);
      return NextResponse.json({ mode, promptText });
    }

    const encoder = new TextEncoder();
    const stream = new ReadableStream<Uint8Array>({
      async start(controller) {
        const send = (ev: Record<string, unknown>) => {
          controller.enqueue(encoder.encode(JSON.stringify(ev) + '\n'));
        };
        let success = false;
        try {
          send({ type: 'start', playerName, position });
          for await (const ev of streamPlayerReport(playerName, position)) {
            if (ev.type === 'text') {
              send(ev);
            } else if (ev.type === 'complete') {
              const processed = await remark().use(remarkGfm).use(remarkHtml, { sanitize: true }).process(ev.annotated);
              send({ type: 'complete', annotated: ev.annotated, html: String(processed) });
              success = true;
            } else {
              send(ev);
            }
          }
        } catch (e) {
          const msg = e instanceof Error ? e.message : String(e);
          console.error('[scout/player-report stream]', msg);
          send({ type: 'error', error: 'Report generation failed. Please try again.' });
        } finally {
          try {
            await logSystemEvent(
              callerCoachName,
              callerTeamshort,
              success ? 'SCOUT_PLAYER_REPORT' : 'SCOUT_PLAYER_REPORT_FAILED',
              `player=${playerName} team=${teamShortIn ?? 'unknown'}`,
              leagueId,
            );
          } catch (e) {
            console.error('[scout/player-report audit]', e);
          }
          controller.close();
        }
      },
    });

    return new Response(stream, {
      headers: {
        'Content-Type': 'application/x-ndjson; charset=utf-8',
        'Cache-Control': 'no-cache, no-transform',
        'X-Accel-Buffering': 'no',
      },
    });
  } catch (error) {
    const msg = error instanceof Error ? error.message : String(error);
    console.error('[scout/player-report]', msg);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
