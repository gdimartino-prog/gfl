import { isAdmin } from '@/lib/auth';
import { processPlayersFile, processStandingsFile, processScheduleFile } from '@/lib/maintenance';
import { getLeagueId } from '@/lib/getLeagueId';
import { logSystemEvent } from '@/lib/db-helpers';

export const dynamic = 'force-dynamic';

export async function POST(request: Request) {
  const admin = await isAdmin();
  if (!admin) {
    return new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 403 });
  }

  const leagueId = await getLeagueId();
  const data = await request.formData();
  const files: File[] = data.getAll('files') as unknown as File[];

  if (!files || files.length === 0) {
    return new Response(JSON.stringify({ error: 'No files found' }), { status: 400 });
  }

  const encoder = new TextEncoder();
  const stream = new ReadableStream({
    async start(controller) {
      const send = (event: Record<string, unknown>) => {
        controller.enqueue(encoder.encode(`data: ${JSON.stringify(event)}\n\n`));
      };

      try {
        for (const file of files) {
          const fileName = file.name;
          const lowerName = fileName.toLowerCase();
          const fileContent = await file.text();

          send({ type: 'file_start', file: fileName });

          try {
            if (lowerName.includes('standings')) {
              const result = await processStandingsFile(fileContent, leagueId);
              if (result.success) logSystemEvent('admin', 'admin', 'IMPORT_STANDINGS', `Imported standings: ${fileName}`, leagueId);
              send({ type: 'file_done', file: fileName, success: result.success, message: result.message });
            } else if (lowerName.includes('schedule')) {
              const result = await processScheduleFile(fileContent, leagueId);
              if (result.success) logSystemEvent('admin', 'admin', 'IMPORT_SCHEDULE', `Imported schedule: ${fileName}`, leagueId);
              send({ type: 'file_done', file: fileName, success: result.success, message: result.message });
            } else if (lowerName.endsWith('.csv')) {
              const result = await processPlayersFile(fileContent, leagueId, (current, total) => {
                // Send every 25 records to avoid flooding the stream
                if (current % 25 === 0 || current === total) {
                  send({ type: 'progress', file: fileName, current, total });
                }
              });
              if (result.success) logSystemEvent('admin', 'admin', 'IMPORT_PLAYERS', `Imported players: ${fileName}`, leagueId);
              send({ type: 'file_done', file: fileName, success: result.success, message: result.message });
            } else {
              send({ type: 'file_done', file: fileName, success: false, message: 'Unsupported file type' });
            }
          } catch (err) {
            const msg = err instanceof Error ? err.message : 'Unknown error';
            send({ type: 'file_done', file: fileName, success: false, message: msg });
          }
        }

        send({ type: 'done' });
      } finally {
        controller.close();
      }
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
