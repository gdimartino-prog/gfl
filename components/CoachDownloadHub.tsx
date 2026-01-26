// components/CoachDownloadHub.tsx
import { 
  UploadCloud, 
  FileCheck, // <-- Add this one
  ShieldAlert, 
  Download, 
  Clock, 
  Loader2, 
  RefreshCw, 
  File 
} from 'lucide-react';


const mockFiles = [
  { team: 'Giants', fileUrl: '#', updated: '2 hours ago' },
  { team: 'Eagles', fileUrl: '#', updated: '1 day ago' },
  { team: 'Cowboys', fileUrl: '#', updated: '15 mins ago' },
];

export default function CoachDownloadHub() {
  return (
    <div className="bg-slate-900 rounded-[2.5rem] p-8 text-left shadow-2xl border border-slate-800">
      <h3 className="font-black text-white text-[10px] tracking-[0.3em] uppercase mb-8 flex items-center gap-2">
        <FileCheck size={14} className="text-emerald-500" /> Game-Day Downloads
      </h3>
      <div className="space-y-4">
        {mockFiles.map((f) => (
          <div key={f.team} className="bg-slate-800/50 border border-slate-700/50 p-5 rounded-[1.5rem] flex items-center justify-between group">
            <div>
              <p className="text-white font-black text-sm uppercase italic tracking-tighter">{f.team}</p>
              <div className="flex items-center gap-2 mt-1">
                <Clock size={10} className="text-slate-500" />
                <span className="text-[9px] font-black text-slate-500 uppercase tracking-widest">{f.updated}</span>
              </div>
            </div>
            <a 
              href={f.fileUrl} 
              className="w-10 h-10 rounded-xl bg-blue-600 text-white flex items-center justify-center hover:bg-emerald-500 transition-all shadow-lg"
            >
              <Download size={18} />
            </a>
          </div>
        ))}
      </div>
    </div>
  );
}