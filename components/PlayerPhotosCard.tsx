"use client";

import { useState } from "react";
import { ImageIcon } from "lucide-react";

type State = 'idle' | 'running' | 'done' | 'error';

export default function PlayerPhotosCard() {
  const [state, setState] = useState<State>('idle');
  const [progress, setProgress] = useState({ ok: 0, err: 0, total: 0, dir: '' });
  const [errorMsg, setErrorMsg] = useState('');

  async function download() {
    setState('running');
    setProgress({ ok: 0, err: 0, total: 0, dir: '' });
    setErrorMsg('');
    try {
      const res = await fetch('/api/maintenance/player-photos', { method: 'POST' });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        setErrorMsg(body.error ?? 'Something went wrong.');
        setState('error');
        return;
      }
      if (!res.body) { setState('error'); return; }
      const reader = res.body.getReader();
      const dec = new TextDecoder();
      let buf = '';
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        buf += dec.decode(value, { stream: true });
        const lines = buf.split('\n');
        buf = lines.pop() ?? '';
        for (const line of lines) {
          if (!line.startsWith('data:')) continue;
          try {
            const evt = JSON.parse(line.slice(5).trim());
            if (evt.type === 'start')    setProgress(p => ({ ...p, total: evt.total, dir: evt.dir }));
            if (evt.type === 'progress') setProgress(p => ({ ...p, ok: evt.ok, err: evt.err }));
            if (evt.type === 'done')     { setProgress(p => ({ ...p, ok: evt.ok, err: evt.err, dir: evt.dir })); setState('done'); }
          } catch { /* ignore malformed lines */ }
        }
      }
    } catch {
      setState('error');
    }
  }

  return (
    <div className="block p-6 bg-white border-t-4 border-violet-500 rounded-2xl shadow-sm text-left h-full">
      <div className="text-4xl mb-4">📸</div>
      <h2 className="text-xl font-black text-gray-800 uppercase tracking-tight leading-tight">Player Photos</h2>
      <p className="text-gray-500 mt-2 text-sm leading-relaxed font-medium">
        Download ESPN headshots for all GFL players formatted for Action PC Football.
      </p>

      <div className="mt-4">
        {state === 'idle' && (
          <button
            onClick={download}
            className="flex items-center gap-2 bg-violet-600 hover:bg-violet-700 text-white px-4 py-2 rounded-xl text-[11px] font-black uppercase tracking-widest transition-all"
          >
            <ImageIcon size={13} /> Download Photos
          </button>
        )}

        {state === 'running' && (
          <div className="space-y-2">
            <div className="flex justify-between text-[10px] font-bold text-slate-500">
              <span>{progress.ok + progress.err} / {progress.total || '…'}</span>
              {progress.err > 0 && <span className="text-amber-500">{progress.err} skipped</span>}
            </div>
            <div className="h-2 bg-slate-100 rounded-full overflow-hidden">
              <div
                className="h-full bg-violet-500 transition-all duration-300"
                style={{ width: progress.total ? `${Math.round((progress.ok + progress.err) / progress.total * 100)}%` : '0%' }}
              />
            </div>
            <p className="text-[9px] text-slate-400 italic">Downloading — do not close this tab</p>
          </div>
        )}

        {state === 'done' && (
          <div className="space-y-2">
            <p className="text-[10px] font-black text-emerald-600">✓ {progress.ok} photos saved</p>
            {progress.err > 0 && <p className="text-[10px] text-amber-500">{progress.err} skipped (stale ESPN IDs)</p>}
            <div className="bg-slate-50 border border-slate-200 rounded-lg px-2.5 py-2">
              <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest mb-0.5">Saved to</p>
              <p className="text-[10px] font-mono text-slate-700 break-all">{progress.dir}</p>
            </div>
            <button onClick={() => setState('idle')} className="text-[10px] text-violet-500 hover:text-violet-700 font-black uppercase">
              Run again
            </button>
          </div>
        )}

        {state === 'error' && (
          <div className="space-y-2">
            <p className="text-[10px] text-red-500 font-bold">{errorMsg || 'Something went wrong.'}</p>
            <button onClick={() => setState('idle')} className="text-[10px] text-violet-500 hover:text-violet-700 font-black uppercase">
              Dismiss
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
