/**
 * GFL Action PC Football — Player Photo Downloader
 * =================================================
 * Downloads ESPN headshots for every GFL player with an espnId and saves them
 * in the format Action PC Football expects: lastname_firstname.jpg
 *
 * Photo specs (Action PC Football community standard):
 *   - Size:   106 × 116 px
 *   - Format: JPEG, quality 92
 *   - Crop:   attention-based (Sharp finds the face automatically)
 *   - Names:  DB first/last values, spaces → underscore, lowercase
 *             apostrophes / periods / hyphens preserved exactly as in DB
 *             e.g. "De'Von Achane"  → achane_de'von.jpg
 *                  "T.J. Watt"      → watt_t.j..jpg
 *                  "Banks Jr."      → banks_jr._kelvin.jpg
 *
 * After running, copy everything from OUT_DIR into:
 *   C:\dksports-data\football\PlayerPhotos\GFL{YEAR}\
 *
 * RUN:
 *   node --env-file=.env.local --import tsx scripts/download-player-photos.ts
 *
 * Players with no ESPN ID are listed at the end — link them via the Scout page
 * and re-run to pick up their photos.
 */

import { db } from '../lib/db';
import { players } from '../schema';
import { eq } from 'drizzle-orm';
import sharp from 'sharp';
import path from 'path';
import fs from 'fs';

// ── Config ────────────────────────────────────────────────────────────────────
const LEAGUE_ID = 1;
const OUT_DIR   = path.join(process.env.USERPROFILE || 'C:\\Users\\George', 'Downloads', 'GFL-Player-Photos');
const TARGET_W  = 106;
const TARGET_H  = 116;
const ESPN_URL  = (id: string) => `https://a.espncdn.com/i/headshots/nfl/players/full/${id}.png`;
// ─────────────────────────────────────────────────────────────────────────────

/** Filename-safe slug that matches DB names exactly.
 *  Only converts spaces → underscore and lowercases.
 *  Preserves apostrophes, periods, hyphens (all valid in Windows filenames). */
function toFilename(first: string, last: string): string {
  const clean = (s: string) => s.trim().replace(/\s+/g, '_').toLowerCase();
  return `${clean(last)}_${clean(first)}.jpg`;
}

async function downloadPhoto(espnId: string, dest: string): Promise<void> {
  const res = await fetch(ESPN_URL(espnId));
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  const buf = Buffer.from(await res.arrayBuffer());
  await sharp(buf)
    .flatten({ background: { r: 255, g: 255, b: 255 } }) // PNG transparency → white
    .resize(TARGET_W, TARGET_H, { fit: 'cover', position: 'attention' }) // smart face crop
    .jpeg({ quality: 92 })
    .toFile(dest);
}

async function main() {
  fs.mkdirSync(OUT_DIR, { recursive: true });
  console.log(`Output: ${OUT_DIR}  (${TARGET_W}×${TARGET_H} px)\n`);

  const rows = await db
    .select({ first: players.first, last: players.last, espnId: players.espnId })
    .from(players)
    .where(eq(players.leagueId, LEAGUE_ID));

  const withId = rows.filter(r => r.espnId && /^\d+$/.test(r.espnId ?? ''));
  const noId   = rows.filter(r => !r.espnId || !/^\d+$/.test(r.espnId ?? ''));

  console.log(`Players with ESPN ID : ${withId.length}`);
  console.log(`Players without ESPN ID (skipped): ${noId.length}\n`);

  let ok = 0, err = 0;

  for (const p of withId) {
    const filename = toFilename(p.first ?? '', p.last ?? '');
    const dest = path.join(OUT_DIR, filename);
    try {
      await downloadPhoto(p.espnId!, dest);
      console.log(`  ok   ${filename}`);
      ok++;
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : String(e);
      console.warn(`  ERR  ${filename}  — ${msg}`);
      err++;
    }
  }

  console.log(`\nDone. ${ok} downloaded, ${err} errors (404 = stale ESPN ID — re-link via Scout page).`);

  if (noId.length) {
    console.log(`\nNo ESPN ID — no photo downloaded for these players:`);
    for (const p of noId) console.log(`  ${p.last}, ${p.first}`);
  }

  process.exit(0);
}

main().catch(e => { console.error(e); process.exit(1); });
