import { getDriveClient } from './google-cloud';
import { unstable_cache } from 'next/cache';

export async function getSyncTime() {
  return unstable_cache(
    async () => {
      const sheetId = process.env.GOOGLE_SHEET_ID;
      try {
        const drive = getDriveClient();
        const res = await drive.files.get({
          fileId: sheetId,
          fields: 'modifiedTime',
        });
        return res.data.modifiedTime; 
      } catch (error) {
        console.error("Error fetching sync time:", error);
        return new Date().toISOString();
      }
    },
    ['sync-time'],
    { revalidate: 60 }
  )();
}