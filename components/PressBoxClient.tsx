'use client';

import { useState } from 'react';
import { Copy, Check, Mail, X } from 'lucide-react';
import { Button } from './ui/button';
import { Loader2 } from 'lucide-react';

export default function PressBoxClient() {
  const [file, setFile] = useState<File | null>(null);
  const [summary, setSummary] = useState<string>('');
  const [loading, setLoading] = useState<boolean>(false);
  const [error, setError] = useState<string>('');
  const [isCopied, setIsCopied] = useState(false);
  const [isEmailOpen, setIsEmailOpen] = useState(false);
  const [emailTo, setEmailTo] = useState('');

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      const selectedFile = e.target.files[0];
      if (!['text/html', 'text/plain'].includes(selectedFile.type)) {
        setError('Please select an HTML or TXT file');
        setFile(null);
        return;
      }
      setFile(selectedFile);
      setError('');
    }
  };

  const handleGenerateSummary = async () => {
    if (!file) {
      setError('Please select a file.');
      return;
    }

    setLoading(true);
    setError('');
    setSummary('');

    const reader = new FileReader();
    reader.onload = async (e) => {
      const content = e.target?.result;
      if (typeof content === 'string') {
        try {
          const res = await fetch('/api/summarize-game', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              boxScore: content,
              useAutoContext: true,
            }),
          });

          if (!res.ok) {
            const errorData = await res.json();
            throw new Error(errorData.error || 'Failed to generate summary.');
          }

          const data = await res.json();
          setSummary(data.summary);
          setFile(null);
        } catch (err) {
          const message = err instanceof Error ? err.message : 'An unknown error occurred.';
          setError(message);
          console.error('Error:', err);
        } finally {
          setLoading(false);
        }
      }
    };
    reader.onerror = () => {
      setError('Failed to read file.');
      setLoading(false);
    };
    reader.readAsText(file);
  };

  const handleCopy = async () => {
    if (!summary) return;
    try {
      await navigator.clipboard.writeText(summary);
      setIsCopied(true);
      setTimeout(() => setIsCopied(false), 2000);
    } catch (err) {
      console.error('Failed to copy summary to clipboard:', err);
    }
  };

  const handleSendEmail = () => {
    const subject = encodeURIComponent('Game Summary');
    const body = encodeURIComponent(summary);
    window.location.href = `mailto:${emailTo}?subject=${subject}&body=${body}`;
  };

  const downloadStory = () => {
    if (!summary) return;
    const element = document.createElement('a');
    element.setAttribute('href', 'data:text/plain;charset=utf-8,' + encodeURIComponent(summary));
    element.setAttribute('download', 'game-summary.txt');
    element.style.display = 'none';
    document.body.appendChild(element);
    element.click();
    document.body.removeChild(element);
  };

  return (
    <div className="space-y-6">
      <div className="p-6 bg-white rounded-2xl shadow-md">
        <h2 className="text-2xl font-bold mb-4">Upload Box Score</h2>
        <p className="text-slate-600 mb-4">
          Select an HTML or TXT file containing a box score. The AI will automatically include league standings, schedules, and coach names for better context!
        </p>
        <div className="flex flex-col space-y-4">
          <input
            type="file"
            accept=".htm,.html,.txt"
            onChange={handleFileChange}
            disabled={loading}
            className="block w-full text-sm text-slate-500 file:mr-4 file:py-2 file:px-4 file:rounded-full file:border-0 file:text-sm file:font-semibold file:bg-blue-50 file:text-blue-700 hover:file:bg-blue-100 disabled:opacity-50"
          />
          {file && (
            <p className="text-sm text-slate-600">
              Selected: <span className="font-semibold">{file.name}</span>
            </p>
          )}
          <Button onClick={handleGenerateSummary} disabled={loading || !file} className="w-full">
            {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            {loading ? 'Generating Story...' : 'Generate Game Summary'}
          </Button>
        </div>
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
              {isCopied ? (
                <Check className="mr-2 h-4 w-4 text-emerald-500" />
              ) : (
                <Copy className="mr-2 h-4 w-4" />
              )}
              {isCopied ? 'Copied!' : 'Copy to Clipboard'}
            </Button>
          </div>
          <div className="prose prose-slate max-w-none mb-6">
            <div className="whitespace-pre-wrap text-slate-700 leading-relaxed">
              {summary}
            </div>
          </div>
          <div className="flex flex-wrap gap-4">
            <Button onClick={downloadStory}>Download Story</Button>
            <Button variant="outline" onClick={() => setIsEmailOpen(o => !o)}>
              <Mail className="mr-2 h-4 w-4" /> Email Story
            </Button>
            <Button
              onClick={() => { setSummary(''); setFile(null); setIsCopied(false); setIsEmailOpen(false); setEmailTo(''); }}
              variant="outline"
            >
              Generate Another
            </Button>
          </div>
          {isEmailOpen && (
            <div className="mt-4 p-4 bg-slate-50 border border-slate-200 rounded-xl space-y-3">
              <div className="flex items-center justify-between">
                <p className="text-sm font-bold text-slate-700 uppercase tracking-wide">Send via Email Client</p>
                <button onClick={() => setIsEmailOpen(false)} className="text-slate-400 hover:text-slate-600">
                  <X size={16} />
                </button>
              </div>
              <input
                type="text"
                placeholder="recipient@example.com, another@example.com"
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
