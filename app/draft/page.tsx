'use client';

import React, { useState, useEffect } from 'react';

// Force fresh data on every visit
export const dynamic = 'force-dynamic';

export default function DraftPage() {
  const [picks, setPicks] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');

  useEffect(() => {
    fetch('/api/draft-picks')
      .then((res) => res.json())
      .then((data) => {
        // Sort by Overall Pick Number (Column D / Index 3)
        const sorted = Array.isArray(data) 
          ? data.sort((a, b) => Number(a.overall) - Number(b.overall))
          : [];
        setPicks(sorted);
        setLoading(false);
      })
      .catch((err) => {
        console.error("Error loading draft picks:", err);
        setLoading(false);
      });
  }, []);

  // Filter picks based on search (Team name or Round)
  const filteredPicks = picks.filter(p => 
    p.currentOwner?.toLowerCase().includes(searchTerm.toLowerCase()) ||
    p.originalTeam?.toLowerCase().includes(searchTerm.toLowerCase()) ||
    p.round?.toString() === searchTerm
  );

  return (
    <div className="max-w-7xl mx-auto p-4 md:p-8 space-y-6 bg-gray-50 min-h-screen text-slate-900 font-sans">
      {/* HEADER & SEARCH */}
      <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-100 flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <h1 className="text-2xl font-black italic tracking-tighter text-slate-900">
            GFL <span className="text-blue-600 underline decoration-amber-400">DRAFT BOARD</span>
          </h1>
          <p className="text-xs font-bold text-gray-400 uppercase tracking-widest mt-1">Selection Order & Trade Tracking</p>
        </div>
        
        <div className="w-full md:w-64">
          <input 
            type="text"
            placeholder="Search Team or Round..."
            className="w-full p-2.5 border rounded-lg bg-gray-50 text-sm focus:ring-2 focus:ring-blue-500 outline-none transition-all"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />
        </div>
      </div>

      {loading ? (
        <div className="flex justify-center py-20 text-blue-600">
          <div className="w-10 h-10 border-4 border-current border-t-transparent rounded-full animate-spin"></div>
        </div>
      ) : (
        <div className="bg-white rounded-xl shadow-md border border-gray-200 overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-slate-900 text-white uppercase text-[10px] tracking-widest">
                  <th className="px-6 py-4 font-bold">Overall</th>
                  <th className="px-6 py-4 font-bold">Round</th>
                  <th className="px-6 py-4 font-bold">Current Owner</th>
                  <th className="px-6 py-4 font-bold">Original Team</th>
                  <th className="px-6 py-4 font-bold text-center">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {filteredPicks.map((pick, i) => {
                  const isTraded = pick.originalTeam?.toLowerCase() !== pick.currentOwner?.toLowerCase();
                  
                  return (
                    <tr key={i} className={`hover:bg-blue-50/50 transition-colors ${isTraded ? 'bg-amber-50/30' : ''}`}>
                      {/* Overall Column */}
                      <td className="px-6 py-4">
                        <span className="text-2xl font-black text-slate-300 tabular-nums">
                          #{pick.overall}
                        </span>
                      </td>

                      {/* Round Column */}
                      <td className="px-6 py-4">
                        <div className="flex flex-col">
                          <span className="text-[10px] font-bold text-slate-400 uppercase">Round</span>
                          <span className="font-bold text-slate-700 text-lg">{pick.round}</span>
                        </div>
                      </td>

                      {/* Current Owner Column */}
                      <td className="px-6 py-4">
                        <div className="flex flex-col">
                          <span className="font-black text-slate-900 uppercase text-base tracking-tight">
                            {pick.currentOwner}
                          </span>
                          {isTraded && (
                            <span className="text-[9px] font-bold text-amber-600 uppercase flex items-center gap-1">
                              <span className="w-1.5 h-1.5 bg-amber-400 rounded-full animate-pulse"></span>
                              Acquired via Trade
                            </span>
                          )}
                        </div>
                      </td>

                      {/* Original Team Column */}
                      <td className="px-6 py-4">
                        <span className="text-sm font-medium text-slate-400 italic">
                          {isTraded ? `Originally: ${pick.originalTeam}` : '—'}
                        </span>
                      </td>

                      {/* Status Column */}
                      <td className="px-6 py-4 text-center">
                        <span className={`inline-block px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-tight ${
                          pick.status === 'Active' 
                            ? 'bg-green-100 text-green-700' 
                            : 'bg-gray-100 text-gray-400'
                        }`}>
                          {pick.status}
                        </span>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
          
          {filteredPicks.length === 0 && (
            <div className="py-20 text-center text-gray-400 font-medium italic">
              No picks found matching your search.
            </div>
          )}
        </div>
      )}
    </div>
  );
}