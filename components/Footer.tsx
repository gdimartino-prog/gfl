import { sheets, SHEET_ID } from '@/lib/googleSheets';

async function getPlayerSyncTime() {
  try {
    const response = await sheets.spreadsheets.values.get({
      spreadsheetId: SHEET_ID,
      range: 'Rules!A:B', 
    });

    const rows = response.data.values || [];
    // Looks for the row you labeled 'player_sync'
    const syncRow = rows.find(row => row[0] === 'player_sync');
    
    return syncRow ? syncRow[1] : null;
  } catch (error) {
    console.error("Footer Sync Fetch Error:", error);
    return null;
  }
}

// This captures the time when the application module is initialized.
// In a production build, this effectively represents the build/deployment time.
const APP_BUILD_TIME = new Date().toLocaleString('en-US', {
  month: 'short',
  day: 'numeric',
  hour: 'numeric',
  minute: '2-digit',
  hour12: true
});

export default async function Footer() {
  const syncTime = await getPlayerSyncTime();
  
  // If the cell is empty or error occurs, show a default or "LIVE"
  const displayDate = syncTime ? syncTime.toUpperCase() : "Player Synced date unavailable";

  return (
    <footer className="w-full py-10 border-t border-slate-200 bg-white">
      <div className="max-w-7xl mx-auto px-6 flex flex-col md:flex-row justify-between items-center gap-4">
        <div className="flex flex-col text-center md:text-left">
          <span className="text-xl font-black tracking-tighter text-slate-900 leading-none italic uppercase">
            GFL<span className="text-blue-600">MANAGER</span>
          </span>
          <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mt-1">
            © 2026 Gridiron Football League
          </p>
        </div>

        <div className="flex flex-col sm:flex-row items-center gap-3">
          <div className="flex items-center gap-3 bg-slate-50 px-4 py-2 rounded-full border border-slate-100 shadow-sm">
            <span className="relative flex h-2 w-2">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
              <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500"></span>
            </span>
            <span className="text-[10px] font-black uppercase tracking-tight text-slate-500">
              Player Data Sync: <span className="text-slate-900">{displayDate}</span>
            </span>
          </div>

          <div className="flex items-center gap-3 bg-slate-50 px-4 py-2 rounded-full border border-slate-100 shadow-sm">
            <span className="relative flex h-2 w-2">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-blue-400 opacity-75"></span>
              <span className="relative inline-flex rounded-full h-2 w-2 bg-blue-500"></span>
            </span>
            <span className="text-[10px] font-black uppercase tracking-tight text-slate-500">
              App Build: <span className="text-slate-900">{APP_BUILD_TIME}</span>
            </span>
          </div>
        </div>
      </div>
    </footer>
  );
}