// components/SelectionModal.tsx
'use client';

import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation'; // Import useRouter for page refresh

// Define the shape of a Player object from your API
interface Player {
  identity: string;
  first: string;
  last: string;
  position: string;
  team: string; // Should be 'FA' for free agents
}

// Define the shape of a Draft Pick being passed to the modal
interface DraftPick {
  overall: number;
  year: number;
  round: number;
  currentOwner: string; // Full team name
  currentOwnerCode: string; // Short code, e.g., "DAL"
  originalTeam: string;
  status: string;
  draftedPlayer: string; // Column G
  timestamp: string; // Column H
}

interface SelectionModalProps {
  pick: DraftPick;
  onClose: () => void;
  // onComplete will be called to signal the parent page to refresh its data
  onComplete: () => void;
}

export default function SelectionModal({ pick, onClose, onComplete }: SelectionModalProps) {
  const router = useRouter(); // Initialize router for refreshing page data
  const [players, setPlayers] = useState<Player[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [loadingPlayers, setLoadingPlayers] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    // Fetch only Free Agents when the modal opens
    fetch('/api/players')
      .then(res => res.json())
      .then(data => {
        setPlayers(data.filter((p: Player) => p.team.trim().toUpperCase() === 'FA'));
        setLoadingPlayers(false);
      })
      .catch(err => {
        console.error("Failed to load free agents:", err);
        setError("Failed to load free agents. Please try again.");
        setLoadingPlayers(false);
      });
  }, []);

  // Filter players based on search term
  const filteredPlayers = players.filter(p =>
    `${p.first} ${p.last}`.toLowerCase().includes(searchTerm.toLowerCase()) ||
    p.position.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const handleSelect = async (player: Player) => {
    setIsSubmitting(true);
    setError(null); // Clear previous errors

    try {
      const res = await fetch('/api/draft-selection', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          overallPick: pick.overall, // Unique identifier for the pick
          playerIdentity: player.identity, // Unique identifier for the player
          playerName: `${player.first} ${player.last}`, // "First Last"
          playerPosition: player.position,
          newOwnerCode: pick.currentOwnerCode // The short code of the team making the pick
        }),
      });

      if (!res.ok) {
        const errorData = await res.json();
        throw new Error(errorData.error || 'Failed to draft player');
      }

      // If successful, signal parent to refresh and close modal
      onComplete(); 
      router.refresh(); // Force a re-fetch of server components on the DraftPage
    } catch (err: any) {
      console.error("Draft failed:", err.message);
      setError(err.message || "An unexpected error occurred during draft.");
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

          <div className="max-h-64 overflow-y-auto rounded-xl border border-slate-100 divide-y divide-slate-50">
            {loadingPlayers ? (
              <div className="p-10 text-center text-blue-600 animate-pulse">
                <div className="w-8 h-8 border-4 border-current border-t-transparent rounded-full animate-spin mx-auto mb-3"></div>
                Loading Free Agents...
              </div>
            ) : error ? (
              <div className="p-10 text-center text-red-600 font-bold">{error}</div>
            ) : filteredPlayers.length > 0 ? filteredPlayers.map(p => (
              <button 
                key={p.identity}
                disabled={isSubmitting} // Disable during submission
                onClick={() => handleSelect(p)}
                className="w-full p-4 text-left hover:bg-blue-50 flex justify-between items-center group transition-all disabled:opacity-50 disabled:cursor-not-allowed"
              >
                <div>
                  <div className="font-black text-slate-800 uppercase tracking-tight group-hover:text-blue-600">
                    {p.first} {p.last}
                  </div>
                  <div className="text-[10px] font-bold text-slate-400 uppercase">{p.position}</div>
                </div>
                {isSubmitting ? (
                  <span className="text-blue-600 text-[10px] font-black px-2 py-1 rounded">Drafting...</span>
                ) : (
                  <div className="bg-slate-100 text-[10px] font-black px-2 py-1 rounded group-hover:bg-blue-600 group-hover:text-white transition-colors">
                    SELECT
                  </div>
                )}
              </button>
            )) : (
              <div className="p-10 text-center text-slate-400 font-bold italic">No matching Free Agents found.</div>
            )}
          </div>
          {error && <div className="text-red-500 text-sm text-center font-bold mt-4">{error}</div>}
          <button 
            onClick={onClose}
            disabled={isSubmitting} // Prevent closing during submission
            className="w-full py-3 text-slate-400 font-bold text-xs uppercase tracking-widest hover:text-slate-600 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            Cancel Selection
          </button>
        </div>
      </div>
    </div>
  );
}