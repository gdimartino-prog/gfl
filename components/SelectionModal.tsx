'use client';

import React, { useState, useMemo, useEffect } from 'react';
import { X, Search, UserPlus } from 'lucide-react';

interface SelectionModalProps {
  pick: any;
  coach: string;
  onClose: () => void;
  onComplete: () => void;
  onScout: (player: any) => void;
}

export default function SelectionModal({ pick, coach, onClose, onComplete, onScout }: SelectionModalProps) {
  const [players, setPlayers] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    setLoading(true);
    fetch('/api/players?view=light', { cache: 'no-store' })
      .then(res => res.json())
      .then(data => {
        setPlayers(data.filter((p: any) => p.team === 'FA'));
        setLoading(false);
      });
  }, []);

  const filteredPlayers = useMemo(() => {
    return players.filter(p => {
      const name = (p.name || `${p.first} ${p.last}`).toLowerCase();
      return name.includes(searchTerm.toLowerCase());
    }).slice(0, 50);
  }, [players, searchTerm]);

  const handleSelect = async (player: any) => {
    if (!confirm(`Draft ${player.name || player.last} to ${pick.currentOwner}?`)) return;
    setIsSubmitting(true);
    try {
      const res = await fetch('/api/draft-selection', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          // 🚀 CHANGED: 'overall' to 'overallPick' to match your API route
          overallPick: pick.overall, 
          playerIdentity: player.identity,
          playerName: player.name || `${player.first} ${player.last}`,
          // 🚀 ADDED: These are required by your draft-selection logic
          playerPosition: player.pos || player.position || 'N/A',
          //newOwnerCode: pick.currentOwner,
          newOwnerCode: pick.currentOwnerCode || pick.currentOwner,
          coachName: coach || 'Unknown Coach'
        })
      });
      
      if (res.ok) {
        onComplete();
      } else {
        const errorData = await res.json();
        alert(`Failed to save selection: ${errorData.error || 'Unknown error'}`);
      }
    } catch (err) { 
      console.error(err); 
      alert("Network error: Failed to reach the server.");
    } finally { 
      setIsSubmitting(false); 
    }
  };


  return (
    <div className="fixed inset-0 z-[110] flex items-center justify-center p-4 sm:p-6">
      <div className="absolute inset-0 bg-slate-900/60 backdrop-blur-md" onClick={onClose} />
      
      <div className="relative w-full max-w-xl bg-white rounded-[3rem] shadow-2xl overflow-hidden flex flex-col max-h-[85vh]">
        
        {/* 🚀 HEADER: Restored Round # and enlarged Team Name */}
        <div className="p-8 bg-blue-600 text-white flex justify-between items-start">
          <div>
            <div className="flex gap-2">
              <span className="bg-white/20 px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-widest">
                Pick #{pick.overall}
              </span>
              <span className="bg-white/20 px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-widest">
                Round {pick.round}
              </span>
            </div>
            <h2 className="text-5xl font-black uppercase italic tracking-tighter leading-none mt-4">
              Draft Selection
            </h2>
            <p className="text-[12px] font-black uppercase tracking-widest opacity-80 mt-2">
              On the Clock: <span className="text-white opacity-100">{pick.currentOwner}</span>
            </p>
          </div>
          <button onClick={onClose} className="text-white/50 hover:text-white transition-colors">
            <X size={28} />
          </button>
        </div>

        {/* Search */}
        <div className="p-6">
          <div className="relative">
            <Search className="absolute left-6 top-1/2 -translate-y-1/2 text-slate-400" size={20} />
            <input 
              autoFocus
              type="text" 
              placeholder="Search Free Agents..." 
              className="w-full p-6 pl-16 bg-slate-50 border-none rounded-3xl font-bold text-slate-900 focus:ring-2 focus:ring-blue-500/20 transition-all text-lg"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
          </div>
        </div>

        {/* Player List */}
        <div className="flex-1 overflow-y-auto px-6 pb-4 space-y-3">
          {loading ? (
            <div className="text-center py-20 font-black uppercase text-slate-300 animate-pulse italic">Scanning personnel...</div>
          ) : filteredPlayers.map((p, i) => {
            const displayName = p.name || `${p.first || ''} ${p.last || ''}`.trim();
            return (
              <div key={p.identity || i} className="flex items-center justify-between p-6 bg-slate-50/50 rounded-[2.5rem] border border-transparent hover:border-blue-100 hover:bg-white transition-all group">
                <div className="flex flex-col">
                  <a 
                    href={`https://www.google.com/search?q=${encodeURIComponent(displayName)}`} 
                    target="_blank" 
                    rel="noopener noreferrer" 
                    className="font-black text-slate-900 uppercase text-xl italic hover:text-blue-600 transition-all"
                  >
                    {displayName}
                  </a>
                  <span className="text-[10px] font-black text-slate-400 uppercase mt-1 tracking-widest">
                    {p.pos || p.position} • Age {p.age}
                  </span>
                </div>
                
                <div className="flex gap-2">
                  {/* 🚀 SCOUT BUTTON: Now turns blue on hover */}
                  <button 
                    onClick={() => onScout(p)} 
                    className="bg-white border border-slate-200 text-slate-500 font-black uppercase text-[9px] px-5 py-3 rounded-2xl hover:bg-blue-600 hover:text-white hover:border-blue-600 transition-all shadow-sm active:scale-95"
                  >
                    Scout
                  </button>
                  <button 
                    disabled={isSubmitting}
                    onClick={() => handleSelect(p)} 
                    className="bg-blue-600 text-white font-black uppercase text-[10px] px-6 py-3 rounded-2xl hover:bg-blue-700 flex items-center gap-2 shadow-lg shadow-blue-500/30 transition-all active:scale-95"
                  >
                    <UserPlus size={16} /> Draft
                  </button>
                </div>
              </div>
            );
          })}
        </div>

        <div className="p-6 border-t bg-white text-center">
          <button onClick={onClose} className="text-[11px] font-black uppercase tracking-[0.2em] text-slate-400 hover:text-slate-600">
            Cancel Selection
          </button>
        </div>
      </div>
    </div>
  );
}