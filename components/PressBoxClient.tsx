'use client';

import { useState, useRef, useCallback } from 'react';
import { Copy, Check, Mail, X, UploadCloud } from 'lucide-react';
import { Button } from './ui/button';
import { Loader2 } from 'lucide-react';

const ACCEPTED = ['text/html', 'text/plain'];

export default function PressBoxClient() {
  const [file, setFile] = useState<File | null>(null);
  const [summary, setSummary] = useState<string>('');
  const [loading, setLoading] = useState<boolean>(false);
  const [error, setError] = useState<string>('');
  const [isCopied, setIsCopied] = useState(false);
  const [isEmailOpen, setIsEmailOpen] = useState(false);
  const [emailTo, setEmailTo] = useState('');
  const [isDragging, setIsDragging] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  const acceptFile = useCallback((f: File) => {
    if (!ACCEPTED.includes(f.type) && !f.name.match(/\.(htm|html|txt)$/i)) {
      setError('Please select an HTML or TXT file');
      setFile(null);
      return;
    }
    setFile(f);
    setError('');
  }, []);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files?.[0]) acceptFile(e.target.files[0]);
  };

  const handleDragOver = (e: React.DragEvent) => { e.preventDefault(); setIsDragging(true); };
  const handleDragLeave = (e: React.DragEvent) => { e.preventDefault(); setIsDragging(false); };
  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    const dropped = e.dataTransfer.files[0];
    if (dropped) acceptFile(dropped);
  };

  const handleGenerateSummary = async () => {
    if (!file) { setError('Please select a file.'); return; }
    setLoading(true);
    setError('');
    setSummary('');

    try {
      const formData = new FormData();
      formData.append('file', file);

      const res = await fetch('/api/press-box', { method: 'POST', body: formData });

      if (!res.ok) {
        const errorData = await res.json().catch(() => ({ error: 'Failed to generate summary.' }));
        throw new Error(errorData.error || 'Failed to generate summary.');
      }

      const data = await res.json();
      setSummary(data.story);
      setFile(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'An unknown error occurred.');
    } finally {
      setLoading(false);
    }
  };

  const handleCopy = async () => {
    if (!summary) return;
    try {
      await navigator.clipboard.writeText(summary);
      setIsCopied(true);
      setTimeout(() => setIsCopied(false), 2000);
    } catch {}
  };

  const handleSendEmail = () => {
    window.location.href = `mailto:${emailTo}?subject=${encodeURIComponent('Game Summary')}&body=${encodeURIComponent(summary)}`;
  };

  const downloadStory = () => {
    if (!summary) return;
    const a = document.createElement('a');
    a.href = 'data:text/plain;charset=utf-8,' + encodeURIComponent(summary);
    a.download = 'game-summary.txt';
    a.click();
  };

  const reset = () => { setSummary(''); setFile(null); setIsCopied(false); setIsEmailOpen(false); setEmailTo(''); setError(''); };

  return (
    <div className="space-y-6">
      <div className="p-6 bg-white rounded-2xl shadow-md">
        <h2 className="text-2xl font-bold mb-4">Upload Box Score</h2>
        <p className="text-slate-600 mb-4">
          Drop an HTML or TXT box score file — the AI will include league standings, schedules, and coach names for better context.
        </p>

        {/* Drop zone */}
        <div
          onDragOver={handleDragOver}
          onDragEnter={handleDragOver}
          onDragLeave={handleDragLeave}
          onDrop={handleDrop}
          onClick={() => !loading && inputRef.current?.click()}
          className={`flex flex-col items-center justify-center gap-3 border-2 border-dashed rounded-xl p-10 cursor-pointer transition-colors ${
            isDragging ? 'border-blue-500 bg-blue-50' : 'border-slate-300 bg-slate-50 hover:border-blue-400 hover:bg-blue-50/40'
          } ${loading ? 'pointer-events-none opacity-50' : ''}`}
        >
          <UploadCloud size={36} className={isDragging ? 'text-blue-500' : 'text-slate-400'} />
          {file ? (
            <p className="text-sm font-semibold text-slate-700">{file.name}</p>
          ) : (
            <>
              <p className="text-sm font-semibold text-slate-600">Drop file here or click to browse</p>
              <p className="text-xs text-slate-400">.html, .htm, .txt</p>
            </>
          )}
          <input
            ref={inputRef}
            type="file"
            accept=".htm,.html,.txt"
            onChange={handleFileChange}
            disabled={loading}
            className="hidden"
          />
        </div>

        <Button onClick={handleGenerateSummary} disabled={loading || !file} className="w-full mt-4">
          {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
          {loading ? 'Generating Story...' : 'Generate Game Summary'}
        </Button>

        {error && (
          <div className="mt-4 p-4 bg-red-50 border border-red-200 rounded-lg text-red-800">
            <p className="font-semibold">Error</p>
            <p className="text-sm">{error}</p>
          </div>
        )}
      </div>

      {summary && (
        <div className="p-6 bg-white rounded-2xl shadow-md">
          <div className="flex justify-between items-center mb-4">
            <h2 className="text-2xl font-bold">Game Summary</h2>
            <Button onClick={handleCopy} variant="outline" size="sm" disabled={isCopied}>
              {isCopied ? <Check className="mr-2 h-4 w-4 text-emerald-500" /> : <Copy className="mr-2 h-4 w-4" />}
              {isCopied ? 'Copied!' : 'Copy to Clipboard'}
            </Button>
          </div>
          <div className="prose prose-slate max-w-none mb-6">
            <div className="whitespace-pre-wrap text-slate-700 leading-relaxed">{summary}</div>
          </div>
          <div className="flex flex-wrap gap-4">
            <Button onClick={downloadStory}>Download Story</Button>
            <Button variant="outline" onClick={() => setIsEmailOpen(o => !o)}>
              <Mail className="mr-2 h-4 w-4" /> Email Story
            </Button>
            <Button variant="outline" onClick={reset}>Generate Another</Button>
          </div>
          {isEmailOpen && (
            <div className="mt-4 p-4 bg-slate-50 border border-slate-200 rounded-xl space-y-3">
              <div className="flex items-center justify-between">
                <p className="text-sm font-bold text-slate-700 uppercase tracking-wide">Send via Email Client</p>
                <button onClick={() => setIsEmailOpen(false)} className="text-slate-400 hover:text-slate-600"><X size={16} /></button>
              </div>
              <input
                type="text"
                placeholder="recipient@example.com"
                value={emailTo}
                onChange={e => setEmailTo(e.target.value)}
                className="w-full border border-slate-200 rounded-lg px-4 py-2 text-sm text-slate-800 focus:ring-2 focus:ring-blue-500 outline-none"
              />
              <Button onClick={handleSendEmail} disabled={!emailTo.trim()} className="w-full">
                <Mail className="mr-2 h-4 w-4" /> Open in Email Client
              </Button>
              <p className="text-xs text-slate-400">Opens your default email app with the story pre-filled.</p>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
