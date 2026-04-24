'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { useSession } from 'next-auth/react';
import { Trash2, ShoppingCart, ChevronRight } from 'lucide-react';
import PlayerCard from '@/components/PlayerCard';
import { useConfirm } from '@/components/ConfirmDialog';
import { Player } from '../../types';

interface TradeBlockPlayer {
  playerId: string;
  playerName: string;
  team: string;
  position: string;
  asking: string;
}

export default function TradeBlockPage() {
  const { data: session } = useSession();
  const [players, setPlayers] = useState<TradeBlockPlayer[]>([]);
  const [loading, setLoading] = useState(true);
  const [teamNameMap, setTeamNameMap] = useState<Record<string, string>>({});
  const [isCommissioner, setIsCommissioner] = useState(false);
  const [confirm, ConfirmDialog] = useConfirm();
  const [viewingPlayer, setViewingPlayer] = useState<Player | null>(null);
  const [season, setSeason] = useState('');

  useEffect(() => {
    fetch('/api/rules').then(r => r.json()).then((rules: { setting: string; value: string }[]) => {
      if (!Array.isArray(rules)) return;
      const yr = rules.find(r => r.setting === 'cuts_year')?.value;
      if (yr) setSeason(yr);
    }).catch(() => {});
  }, []);

  useEffect(() => {
    const fetchTeamNames = async () => {
      try {
        const res = await fetch('/api/teams');
        const teamsData = await res.json();
        const map: Record<string, string> = {};
        teamsData.forEach((team: { short: string; team: string; nickname: string }) => {
          map[team.short.toUpperCase()] = `${team.team} ${team.nickname}`;
        });
        setTeamNameMap(map);
        // Check if current user is commissioner
        const sessionTeamshort = (session?.user as { id?: string })?.id;
        if (sessionTeamshort) {
          const myTeam = teamsData.find((t: { short: string; commissioner?: boolean }) =>
            t.short.toUpperCase() === sessionTeamshort.toUpperCase()
          );
          setIsCommissioner(myTeam?.commissioner ?? false);
        }
      } catch (error) {
        console.error("Failed to fetch team names:", error);
      }
    };
    fetchTeamNames();
  }, [session]);

  const fetchTradeBlock = async () => {
    try {
      setLoading(true);
      const res = await fetch('/api/trade-block');
      if (!res.ok) {
        console.error("Failed to fetch trade block:", await res.text());
        setPlayers([]);
        return;
      }
      const data = await res.json();
      if (Array.isArray(data)) {
        setPlayers(data);
      } else {
        console.error("API returned unexpected data format:", data);
        setPlayers([]);
      }
    } catch (error) {
      console.error("Failed to fetch trade block:", error);
      setPlayers([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchTradeBlock();
  }, []);

  const handleRemoveFromBlock = async (playerId: string) => {
    if (!await confirm("Remove this player from the trade block?", { confirmLabel: 'Remove', destructive: true })) return;

    try {
      const response = await fetch(`/api/trade-block?playerId=${playerId}`, {
        method: 'DELETE',
      });

      if (response.ok) {
        alert("Player removed from the trade block.");
        fetchTradeBlock();
      } else {
        const errorData = await response.json();
        alert(`Failed to remove player: ${errorData.message}`);
      }
    } catch (error) {
      console.error("Failed to remove from trade block:", error);
      alert("An error occurred while removing the player from the trade block.");
    }
  };

  const handlePlayerDetails = useCallback((p: { identity: string }) => {
    fetch(`/api/players/details/${encodeURIComponent(p.identity)}`)
      .then(r => r.json())
      .then(setViewingPlayer);
  }, []);

  const isPrivileged = () => {
    if (!session?.user) return false;
    const role = (session.user as { role?: string })?.role;
    return role === 'admin' || role === 'superuser';
  };

  const canManage = (team: string) => {
    if (!session?.user) return false;
    if (isPrivileged() || isCommissioner) return true;
    const sessionUserId = (session.user as { id?: string })?.id;
    return sessionUserId === team;
  };

  return (
    <div className="max-w-7xl mx-auto p-4 md:p-8 space-y-10 bg-gray-50 min-h-screen text-slate-900 text-left">
      <ConfirmDialog />
      {viewingPlayer && <PlayerCard data={viewingPlayer} onClose={() => setViewingPlayer(null)} />}

      <header className="flex flex-col md:flex-row justify-between items-start md:items-end gap-6 border-b border-slate-200 pb-8">
        <div>
          <h1 className="text-6xl font-black italic uppercase tracking-tighter text-slate-900 leading-none">Trade <span className="text-blue-600">Block</span></h1>
          <p className="text-[11px] font-black text-slate-400 uppercase tracking-[0.2em] italic mt-3 flex items-center gap-2"><ShoppingCart size={14} className="text-emerald-500" /> Open Market{season ? ` • Season ${season}` : ''}</p>
        </div>
      </header>

      {loading ? (
        <div className="text-center p-20 font-black animate-pulse text-slate-400 uppercase italic">Loading Trade Block...</div>
      ) : (
        <div className="bg-white rounded-[2.5rem] shadow-xl border border-slate-100 overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-slate-900 text-white text-[9px] font-black uppercase tracking-[0.2em]">
                  <th className="px-8 py-5">Player</th>
                  <th className="px-8 py-5">Team</th>
                  <th className="px-8 py-5">Position</th>
                  <th className="px-8 py-5">Asking</th>
                  <th className="px-8 py-5 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-50">
                {players.filter(p => p.playerId).length === 0 && (
                  <tr>
                    <td colSpan={5} className="px-8 py-16 text-center font-black uppercase italic text-slate-400 text-sm tracking-widest">
                      No players on the trade block
                    </td>
                  </tr>
                )}
                {players.filter(p => p.playerId).map((player) => (
                  <tr key={player.playerId} className="hover:bg-slate-50 transition-colors group">
                    <td className="px-8 py-6">
                      <a
                        href={`https://www.google.com/search?q=${encodeURIComponent(player.playerName)}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="font-black text-slate-900 uppercase italic tracking-tight text-lg leading-none hover:text-blue-600"
                      >
                        {player.playerName}
                      </a>
                    </td>
                    <td className="px-8 py-6 text-slate-500 font-bold text-xs uppercase">{teamNameMap[player.team.toUpperCase()] || player.team}</td>
                    <td className="px-8 py-6 text-slate-500 font-bold text-xs uppercase">{player.position}</td>
                    <td className="px-8 py-6 text-slate-500 font-bold text-xs">{player.asking}</td>
                    <td className="px-8 py-6">
                      <div className="flex items-center justify-end gap-2">
                        {canManage(player.team) && (
                          <button
                            onClick={() => handleRemoveFromBlock(player.playerId)}
                            className="flex items-center gap-2 px-3 py-2 rounded-lg bg-red-100 text-red-600 hover:bg-red-200 transition-colors text-xs font-bold"
                            title="Remove from Trade Block"
                          >
                            <Trash2 size={14} />
                          </button>
                        )}
                        <button
                          onClick={() => handlePlayerDetails({ identity: player.playerId })}
                          className="flex items-center justify-center w-10 h-10 rounded-xl bg-slate-100 text-slate-400 group-hover:bg-blue-600 group-hover:text-white active:scale-95 transition-all shadow-sm"
                          title="View Player Details"
                        >
                          <ChevronRight size={20} />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
