// components/SelectionModal.tsx
'use client';

import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';

interface Player {
  identity: string;
  first: string;
  last: string;
  position: string;
  team: string; 
  age?: number; // Added age to support scouting identity
}

interface DraftPick {
  overall: number;
  year: number;
  round: number;
  currentOwner: string;
  currentOwnerCode: string;
  originalTeam: string;
  status: string;
  draftedPlayer: string;
  timestamp: string;
}

interface SelectionModalProps {
  pick: any;
  onClose: () => void;
  onComplete: () => void;
  onScout?: (player: any) => void; // <--- Add this line (the '?' makes it optional)
}

export default function SelectionModal({ pick, onClose, onComplete, onScout }: SelectionModalProps) {
  const router = useRouter();
  const [players, setPlayers] = useState<Player[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [loadingPlayers, setLoadingPlayers] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetch('/api/players')
      .then(res => res.json())
      .then(data => {
        setPlayers(data.filter((p: Player) => p.team.trim().toUpperCase() === 'FA'));
        setLoadingPlayers(false);
      })
      .catch(err => {
        console.error("Failed to load free agents:", err);
        setError("Failed to load free agents.");
        setLoadingPlayers(false);
      });
  }, []);

  const filteredPlayers = players.filter(p =>
    `${p.first} ${p.last}`.toLowerCase().includes(searchTerm.toLowerCase()) ||
    p.position.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const handleSelect = async (player: Player) => {
    setIsSubmitting(true);
    setError(null);
    try {
      const res = await fetch('/api/draft-selection', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          overallPick: pick.overall,
          playerIdentity: player.identity,
          playerName: `${player.first} ${player.last}`,
          playerPosition: player.position,
          newOwnerCode: pick.currentOwnerCode
        }),
      });
      if (!res.ok) throw new Error('Failed to draft player');
      onComplete(); 
      router.refresh();
    } catch (err: any) {
      setError(err.message);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-slate-900/90 backdrop-blur-md z-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl w-full max-w-md shadow-2xl border border-white/20 overflow-hidden">
        {/* MODAL HEADER */}
        <div className="bg-blue-600 p-6 text-white">
          <div className="flex justify-between items-center mb-2">
             <span className="text-[10px] font-black uppercase tracking-widest bg-blue-500 px-2 py-1 rounded-md">Pick #{pick.overall}</span>
             <button onClick={onClose} className="text-white/70 hover:text-white transition-colors text-xl">✕</button>
          </div>
          <h2 className="text-2xl font-black italic uppercase tracking-tighter">Draft Selection</h2>
          <p className="text-blue-100 text-xs font-bold uppercase tracking-widest">On the Clock: {pick.currentOwner}</p>
        </div>

        {/* SEARCH & LIST */}
        <div className="p-6 space-y-4">
          <input 
            type="text"
            placeholder="Search Free Agents..."
            className="w-full p-4 bg-slate-50 border-2 border-slate-100 rounded-xl focus:border-blue-500 outline-none font-bold text-slate-800 transition-all placeholder-slate-400"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            autoFocus
            disabled={isSubmitting || loadingPlayers}
          />

          <div className="max-h-80 overflow-y-auto rounded-xl border border-slate-100 divide-y divide-slate-50">
            {loadingPlayers ? (
               <div className="p-10 text-center text-blue-600 animate-pulse">Loading...</div>
            ) : filteredPlayers.map(p => (
              <div key={p.identity} className="p-4 flex justify-between items-center hover:bg-slate-50 transition-colors">
                <div className="flex flex-col">
                  {/* --- HYPERLINK ON NAME --- */}
                  <a 
                    href={`https://www.google.com/search?q=${encodeURIComponent(p.first + ' ' + p.last + ' NFL Scouting')}`}
                    target="_blank" 
                    rel="noopener noreferrer"
                    className="font-black text-slate-800 uppercase tracking-tight hover:text-blue-600 hover:underline decoration-2 underline-offset-4"
                  >
                    {p.first} {p.last}
                  </a>
                  <div className="text-[10px] font-bold text-slate-400 uppercase">{p.position}</div>
                </div>
                
                <div className="flex items-center gap-2">
                  {/* --- SCOUT/DETAILS BUTTON --- */}
                  <button 
                    onClick={() => onScout?.(p)}
                    className="text-[10px] font-black text-blue-600 uppercase bg-blue-50 px-3 py-2 rounded-lg hover:bg-blue-100 transition-all"
                  >
                    Scout
                  </button>

                  <button 
                    disabled={isSubmitting}
                    onClick={() => handleSelect(p)}
                    className="bg-slate-800 text-white text-[10px] font-black px-3 py-2 rounded-lg hover:bg-blue-600 transition-all disabled:opacity-50"
                  >
                    {isSubmitting ? '...' : 'DRAFT'}
                  </button>
                </div>
              </div>
            ))}
          </div>
          <button onClick={onClose} className="w-full py-2 text-slate-400 font-bold text-xs uppercase tracking-widest">Cancel</button>
        </div>
      </div>
    </div>
  );
}