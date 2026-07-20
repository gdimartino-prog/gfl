/**
 * Upload Player-Photos-YYYY.zip to Vercel Blob (public, permanent URL).
 *
 * RUN (once per season):
 *   node --env-file=.env.local --import tsx scripts/upload-player-photos-blob.ts
 *
 * After it prints the URL, add it to .env.local:
 *   PLAYER_PHOTOS_BLOB_URL=https://...
 *
 * Then add the same var to your Vercel project dashboard environment variables
 * so the download card appears in production.
 */

import { put } from '@vercel/blob';
import fs from 'fs';
import path from 'path';

const DOWNLOADS = path.join(process.env.USERPROFILE ?? 'C:\\Users\\George', 'Downloads');

// Look for Player-Photos-YYYY.zip in Downloads
const files = fs.readdirSync(DOWNLOADS).filter(f => /^Player-Photos-\d{4}\.zip$/i.test(f));
if (files.length === 0) {
  console.error('No Player-Photos-YYYY.zip found in', DOWNLOADS);
  process.exit(1);
}

// Use the most recent year if multiple exist
const zipName = files.sort().at(-1)!;
const zipPath = path.join(DOWNLOADS, zipName);
console.log(`Uploading: ${zipPath}  (${(fs.statSync(zipPath).size / 1_048_576).toFixed(1)} MB)`);

const fileBuffer = fs.createReadStream(zipPath);
const blob = await put(zipName, fileBuffer, {
  access: 'public',
  contentType: 'application/zip',
});

console.log('\nUpload complete!');
console.log(`  URL:  ${blob.url}`);
console.log(`\nAdd to .env.local:\n  PLAYER_PHOTOS_BLOB_URL=${blob.url}`);
console.log(`\nAdd the same var to your Vercel dashboard environment variables.`);

process.exit(0);
