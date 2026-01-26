// components/CoachFileUpload.tsx
'use client';

import { useState } from 'react';
import { UploadCloud, FileCheck, AlertCircle } from 'lucide-react';

export default function CoachFileUpload({ teamName }: { teamName: string }) {
  const [file, setFile] = useState<File | null>(null);
  const [uploading, setUploading] = useState(false);

  const handleUpload = async () => {
    if (!file) return;
    setUploading(true);
    
    // Here you would call an API route to save the file
    // const formData = new FormData();
    // formData.append('file', file);
    // await fetch('/api/upload-coach-file', { method: 'POST', body: formData });

    setTimeout(() => { // Simulating upload
      setUploading(false);
      alert("Coach file for " + teamName + " has been synchronized!");
    }, 1500);
  };

  return (
    <div className="bg-white rounded-[2rem] p-8 border-2 border-dashed border-slate-200 text-center">
      <UploadCloud className="mx-auto text-blue-600 mb-4" size={48} />
      <h3 className="text-xl font-black uppercase italic tracking-tighter text-slate-900">
        Upload {teamName} <span className="text-blue-600">Coach File</span>
      </h3>
      <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mt-2 mb-6">
        Sync your Action! PC Roster (.coach format)
      </p>
      
      <input 
        type="file" 
        accept=".coach,.txt" 
        onChange={(e) => setFile(e.target.files?.[0] || null)}
        className="block w-full text-sm text-slate-500 file:mr-4 file:py-2 file:px-4 file:rounded-full file:border-0 file:text-[10px] file:font-black file:uppercase file:bg-blue-50 file:text-blue-700 hover:file:bg-blue-100 mb-6"
      />

      <button 
        onClick={handleUpload}
        disabled={!file || uploading}
        className={`w-full py-4 rounded-xl font-black uppercase text-[10px] tracking-widest transition-all ${!file ? 'bg-slate-100 text-slate-300' : 'bg-slate-900 text-white shadow-xl hover:bg-blue-600'}`}
      >
        {uploading ? 'Processing...' : 'Synchronize File'}
      </button>
    </div>
  );
}