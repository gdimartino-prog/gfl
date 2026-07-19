import { NextResponse } from 'next/server';
import { isCommissioner } from '@/lib/auth';
import { db } from '@/lib/db';
import { players, rules } from '@/schema';
import { eq, and } from 'drizzle-orm';
import sharp from 'sharp';
import path from 'path';
import fs from 'fs';

const ESPN_URL = (id: string) => `https://a.espncdn.com/i/headshots/nfl/players/full/${id}.png`;
const TARGET_W = 106;
const TARGET_H = 116;

function toFilename(first: string, last: string): string {
  // Strip path separators to prevent traversal; spaces → underscore; lowercase
  const clean = (s: string) => s.trim().replace(/[/\\]/g, '').replace(/\s+/g, '_').toLowerCase();
  return `${clean(last)}_${clean(first)}.jpg`;
}

export async function POST() {
  if (!(await isCommissioner())) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 403 });
  }

  // Only works locally — Vercel would timeout on 2,000+ downloads
  if (process.env.VERCEL) {
    return NextResponse.json(
      { error: 'Player photo download only works when running locally (npm run dev).' },
      { status: 400 }
    );
  }

  // Validate year from DB before interpolating into a filesystem path
  const yearRule = await db.select({ value: rules.value }).from(rules)
    .where(and(eq(rules.leagueId, 1), eq(rules.setting, 'cuts_year')))
    .limit(1);
  const year = yearRule[0]?.value ?? String(new Date().getFullYear());
  if (!/^\d{4}$/.test(year)) {
    return NextResponse.json({ error: 'Invalid season year in rules' }, { status: 400 });
  }

  // Resolve output folder: game folder if it exists, else Downloads
  const gameDir = `C:\\dksports-data\\football\\PlayerPhotos\\GFL${year}`;
  const outDir = fs.existsSync(gameDir)
    ? gameDir
    : path.join(process.env.USERPROFILE ?? 'C:\\Users\\George', 'Downloads', 'GFL-Player-Photos');
  fs.mkdirSync(outDir, { recursive: true });
  const resolvedOutDir = path.resolve(outDir);

  const rows = await db
    .select({ first: players.first, last: players.last, espnId: players.espnId })
    .from(players)
    .where(eq(players.leagueId, 1));

  const withId = rows.filter(r => r.espnId && /^\d+$/.test(r.espnId ?? ''));

  const stream = new ReadableStream({
    async start(controller) {
      const enc = new TextEncoder();
      const send = (data: object) =>
        controller.enqueue(enc.encode(`data: ${JSON.stringify(data)}\n\n`));

      send({ type: 'start', total: withId.length, dir: outDir });

      let ok = 0, err = 0;
      for (const p of withId) {
        const filename = toFilename(p.first ?? '', p.last ?? '');
        const dest = path.join(resolvedOutDir, filename);

        // Guard against any remaining path traversal
        if (!dest.startsWith(resolvedOutDir + path.sep) && dest !== resolvedOutDir) {
          err++;
          send({ type: 'progress', ok, err, total: withId.length });
          continue;
        }

        try {
          const res = await fetch(ESPN_URL(p.espnId!));
          if (!res.ok) throw new Error(`HTTP ${res.status}`);

          // Reject unexpectedly large responses (>2 MB) before buffering
          const contentLength = Number(res.headers.get('content-length') ?? 0);
          if (contentLength > 2_000_000) throw new Error('Response too large');

          const buf = Buffer.from(await res.arrayBuffer());
          if (buf.byteLength > 2_000_000) throw new Error('Body too large');

          await sharp(buf)
            .flatten({ background: { r: 255, g: 255, b: 255 } })
            .resize(TARGET_W, TARGET_H, { fit: 'cover', position: 'attention' })
            .jpeg({ quality: 92 })
            .toFile(dest);
          ok++;
        } catch {
          err++;
        }
        send({ type: 'progress', ok, err, total: withId.length });
      }

      send({ type: 'done', ok, err, dir: outDir });
      controller.close();
    },
  });

  return new Response(stream, {
    headers: {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      'Connection': 'keep-alive',
    },
  });
}
