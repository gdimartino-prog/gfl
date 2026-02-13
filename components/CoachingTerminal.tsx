'use client';

import { useState, useRef, useEffect } from 'react';
import { UploadCloud, FileCheck, ShieldAlert, Download, Clock, Loader2, RefreshCw, File } from 'lucide-react';

interface CoachFile {
  pathname: string;
  url: string;
  downloadUrl: string;
  uploadedAt: string;
}

export default function CoachingTerminal({ teamName }: { teamName: string }) {
  const inputFileRef = useRef<HTMLInputElement>(null);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [blob, setBlob] = useState<{ url: string } | null>(null);
  const [uploading, setUploading] = useState(false);
  const [allFiles, setAllFiles] = useState<CoachFile[]>([]);
  const [loadingFiles, setLoadingFiles] = useState(true);

  const fetchFiles = async () => {
    setLoadingFiles(true);
    try {
      const response = await fetch('/api/upload');
      const data = await response.json();
      
      // Filter for .COA files (case-insensitive)
      const coachFiles = data.filter((f: CoachFile) => f.pathname.toLowerCase().endsWith('.coa'));
      
      // SORT ALPHABETICALLY A-Z
      coachFiles.sort((a: CoachFile, b: CoachFile) => {
        const nameA = (a.pathname.split('/').pop() || '').toLowerCase();
        const nameB = (b.pathname.split('/').pop() || '').toLowerCase();
        return nameA.localeCompare(nameB);
      });

      setAllFiles(coachFiles);
    } catch (error) {
      console.error("Failed to load files", error);
    } finally {
      setLoadingFiles(false);
    }
  };

  useEffect(() => {
    fetchFiles();
  }, [blob]);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      setSelectedFile(e.target.files[0]);
      setBlob(null); 
    }
  };

  const handleSync = async () => {
    if (!selectedFile) return;
    setUploading(true);

    try {
      const safeFileName = teamName.replace(/\s+/g, '_').toUpperCase();
      const response = await fetch(`/api/upload?filename=${safeFileName}.COA`, {
        method: 'POST',
        body: selectedFile,
      });
      const newBlob = await response.json();
      setBlob(newBlob);
      setSelectedFile(null); 
    } catch (error) {
      console.error("Upload failed", error);
    } finally {
      setUploading(false);
    }
  };

  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-10 text-left">
      
      {/* UPLOAD PANEL */}
      <div className="bg-white rounded-[2.5rem] p-10 shadow-xl border border-slate-100">
        <div className="flex items-center gap-4 mb-8">
            <div className="bg-blue-600 p-4 rounded-2xl shadow-lg shadow-blue-500/20">
                <UploadCloud size={32} className="text-white" />
            </div>
            <div>
                <h3 className="text-2xl font-black uppercase italic tracking-tighter leading-none text-slate-900">
                  Upload <span className="text-blue-600">Coach File</span>
                </h3>
                <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mt-2">
                  {teamName} • ACTION! PC SYNC
                </p>
            </div>
        </div>

        <div className="space-y-6">
            <div className={`group relative border-2 border-dashed rounded-[2rem] p-10 transition-all text-center ${selectedFile ? 'border-blue-500 bg-blue-50/30' : 'border-slate-200 bg-slate-50/50 hover:border-blue-500'}`}>
                <input 
                    name="file" 
                    ref={inputFileRef} 
                    type="file" 
                    accept=".COA,.coa"
                    onChange={handleFileChange}
                    required 
                    className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
                />
                
                {selectedFile ? (
                  <div className="flex flex-col items-center animate-in fade-in zoom-in duration-200">
                    <File className="text-blue-600 mb-2" size={24} />
                    <p className="text-sm font-black text-blue-900 uppercase italic leading-none">{selectedFile.name}</p>
                    <p className="text-[10px] font-bold text-blue-400 uppercase mt-1">Ready to Sync</p>
                  </div>
                ) : (
                  <p className="text-sm font-black text-slate-400 uppercase tracking-tight group-hover:text-blue-600">
                      Click to select .COA File
                  </p>
                )}
            </div>

            <button 
                onClick={handleSync}
                disabled={uploading || !selectedFile}
                className={`w-full py-6 rounded-2xl font-black uppercase text-[11px] tracking-[0.2em] italic transition-all shadow-xl flex items-center justify-center gap-3 ${
                  uploading || !selectedFile ? 'bg-slate-100 text-slate-300 cursor-not-allowed' : 'bg-slate-900 text-white hover:bg-blue-600'
                }`}
            >
                {uploading ? <Loader2 size={16} className="animate-spin" /> : 'Sync Game-Day Roster'}
            </button>
        </div>

        {blob && (
            <div className="mt-8 p-6 bg-emerald-50 rounded-2xl border border-emerald-100 flex items-center justify-between">
                <div className="flex items-center gap-3">
                    <FileCheck className="text-emerald-500" />
                    <span className="text-[10px] font-black text-emerald-600 uppercase tracking-widest">GFL Terminal Verified</span>
                </div>
                <a href={blob.url} target="_blank" rel="noopener noreferrer" className="text-[10px] font-black text-blue-600 underline uppercase italic">Preview</a>
            </div>
        )}
      </div>

      {/* LIVE DOWNLOAD HUB - ALPHABETICAL WITH TIMESTAMP */}
      <div className="bg-slate-900 rounded-[2.5rem] p-10 shadow-2xl border border-slate-800 flex flex-col min-h-[500px]">
         <div className="flex justify-between items-center mb-10">
            <h3 className="font-black text-white text-[10px] tracking-[0.3em] uppercase flex items-center gap-3">
               <ShieldAlert size={16} className="text-amber-500" /> Opponent Intelligence
            </h3>
            <button onClick={fetchFiles} className="text-slate-500 hover:text-white transition-colors p-2">
              <RefreshCw size={14} className={loadingFiles ? "animate-spin" : ""} />
            </button>
         </div>
         
         <div className="space-y-4 overflow-y-auto pr-2 custom-scrollbar">
            {loadingFiles && allFiles.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-20 text-slate-600">
                <Loader2 className="animate-spin mb-4" />
                <p className="text-[10px] font-black uppercase tracking-widest">Scanning Intelligence...</p>
              </div>
            ) : allFiles.length === 0 ? (
                <div className="text-center py-20 border-2 border-dashed border-slate-800 rounded-[2rem]">
                  <p className="text-[10px] font-black text-slate-600 uppercase tracking-widest">No active files found</p>
                </div>
            ) : (
              allFiles.map((file) => {
                const displayName = (file.pathname.split('/').pop() || '').replace(/\.(coa|COA)$/, '').replace(/_/g, ' ');
                return (
                  <div key={file.url} className="bg-slate-800/50 border border-slate-700/50 p-6 rounded-[2rem] flex items-center justify-between group hover:border-blue-500/50 transition-all">
                      <div>
                          <p className="text-white font-black text-lg uppercase italic tracking-tighter leading-none mb-2">{displayName}</p>
                          <div className="flex items-center gap-2 text-slate-500">
                              <Clock size={12} />
                              <span className="text-[9px] font-black uppercase tracking-widest leading-none">
                                {new Date(file.uploadedAt).toLocaleString('en-US', {
                                    month: 'short',
                                    day: 'numeric',
                                    hour: 'numeric',
                                    minute: '2-digit',
                                    hour12: true
                                })}
                              </span>
                          </div>
                      </div>
                      <a 
                        href={file.downloadUrl} 
                        download={`${displayName.replace(/\s+/g, '_')}.COA`}
                        className="w-12 h-12 rounded-2xl bg-blue-600 text-white flex items-center justify-center hover:bg-emerald-500 transition-all shadow-lg active:scale-95"
                      >
                          <Download size={20} />
                      </a>
                  </div>
                );
              })
            )}
         </div>
      </div>
    </div>
  );
}