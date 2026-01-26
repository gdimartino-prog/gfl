import { google } from 'googleapis';

// 1. Logic to fetch the real Google Sheet update time
async function getSheetLastUpdated() {
  try {
    const auth = new google.auth.GoogleAuth({
      credentials: JSON.parse(process.env.GOOGLE_SHEETS_JSON!),
      scopes: ['https://www.googleapis.com/auth/drive.metadata.readonly'],
    });
    const drive = google.drive({ version: 'v3', auth });
    const response = await drive.files.get({
      fileId: process.env.SPREADSHEET_ID,
      fields: 'modifiedTime',
    });
    return response.data.modifiedTime;
  } catch (error) {
    console.error("Footer Sync Error:", error);
    return new Date().toISOString(); // Fallback to now if it fails
  }
}

export default async function Footer() {
  const lastUpdated = await getSheetLastUpdated();
  
  const formattedDate = new Date(lastUpdated!).toLocaleString('en-US', {
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
    hour12: true,
  });

  return (
    <footer className="w-full py-10 border-t border-slate-200 bg-white mt-auto">
      <div className="max-w-7xl mx-auto px-6 flex flex-col md:flex-row justify-between items-center gap-4">
        
        {/* Branding Section */}
        <div className="flex flex-col text-center md:text-left">
          <span className="text-xl font-black tracking-tighter text-slate-900 leading-none uppercase italic">
            GFL<span className="text-blue-600">MANAGER</span>
          </span>
          <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mt-1">
            © 2026 Gridiron Football League
          </p>
        </div>

        {/* Sync Status Section - Now showing GOOGLE SHEET time */}
        <div className="flex items-center gap-3 bg-slate-50 px-4 py-2 rounded-full border border-slate-100">
          <span className="relative flex h-2 w-2">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
            <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500"></span>
          </span>
          <span className="text-[10px] font-black uppercase tracking-tight text-slate-500">
            Roster Sync: <span className="text-slate-900">{formattedDate}</span>
          </span>
        </div>
      </div>
    </footer>
  );
}