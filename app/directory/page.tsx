"use client";

import React, { useState, useEffect, useMemo } from 'react';
import { Search, Mail, Phone, ShieldCheck, ExternalLink, UserCircle } from 'lucide-react';
import Link from 'next/link';
import { formatPhone } from '@/lib/utils';
import { useSession } from 'next-auth/react';
import { Team } from '@/types';

export default function DirectoryPage() {
  // 🔒 Enforce authentication and redirect to login if not authenticated
  const { data: session, status } = useSession({ required: true });
  const [teams, setTeams] = useState<Team[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [seasonYear, setSeasonYear] = useState('2026');

  useEffect(() => {
    Promise.all([
      fetch('/api/teams').then(res => res.json()),
      fetch('/api/rules').then(res => res.json())
    ])
      .then(([teamsData, rulesData]) => {
        setTeams(teamsData);
        
        const year = rulesData.find((r: { setting: string; value: string }) => r.setting === 'cuts_year')?.value;
        if (year) setSeasonYear(year);
        
        setLoading(false);
      })
      .catch(err => {
        console.error("Failed to load directory:", err);
        setLoading(false);
      });
  }, []);

  const filteredTeams = useMemo(() => {
    return teams.filter(t => 
      t.name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      t.coach?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      t.short?.toLowerCase().includes(searchTerm.toLowerCase())
    );
  }, [teams, searchTerm]);

  if (status === "loading" || loading) {
    return (
      <div className="p-20 text-center font-black animate-pulse text-slate-400 uppercase italic">
        {status === "loading" ? "Verifying Credentials..." : "Accessing League Records..."}
      </div>
    );
  }

  return (
    <div className="max-w-7xl mx-auto p-4 md:p-8 space-y-10 bg-gray-50 min-h-screen text-slate-900 text-left">
      <header className="border-b border-slate-200 pb-8">
        <h1 className="text-6xl font-black italic uppercase tracking-tighter text-slate-900 leading-none">
          League <span className="text-blue-600">Directory</span>
        </h1>
        <p className="text-[11px] font-black text-slate-400 uppercase tracking-[0.2em] italic mt-3 flex items-center gap-2">
          <UserCircle size={14} className="text-blue-500" /> Official GFL Coach Registry • Season {seasonYear}
        </p>
      </header>

      <div className="relative">
        <Search className="absolute left-6 top-1/2 -translate-y-1/2 text-slate-400" size={20} />
        <input 
          type="text" 
          placeholder="Search by coach, team, or shortcode..." 
          value={searchTerm} 
          onChange={(e) => setSearchTerm(e.target.value)} 
          className="w-full bg-white border border-slate-200 rounded-[1.5rem] py-6 pl-16 pr-8 text-slate-800 font-bold focus:ring-2 focus:ring-blue-500 outline-none transition-all text-lg shadow-sm" 
        />
      </div>

      <div className="bg-white rounded-[2.5rem] shadow-xl border border-slate-100 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-slate-900 text-white text-[9px] font-black uppercase tracking-[0.2em]">
                <th className="px-8 py-5">Franchise</th>
                <th className="px-8 py-5">Coach</th>
                <th className="px-8 py-5">Email Address</th>
                <th className="px-8 py-5">Mobile</th>
                <th className="px-8 py-5 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-50">
              {filteredTeams.map((team, i) => (
                <tr key={i} className="hover:bg-slate-50 transition-colors group">
                  <td className="px-8 py-6">
                    <div className="flex items-center gap-3">
                      <span className="bg-slate-100 text-slate-500 font-mono text-[10px] px-2 py-1 rounded font-black">{team.short}</span>
                      <p className="font-black text-slate-900 uppercase italic tracking-tight text-lg leading-none">{team.name}</p>
                    </div>
                  </td>
                  <td className="px-8 py-6">
                    <div className="flex items-center gap-2">
                      {team.short === (session?.user as { id?: string })?.id ? (
                        <Link 
                          href="/settings" 
                          className="font-bold text-blue-600 hover:text-blue-800 uppercase text-sm flex items-center gap-1 group/name"
                          title="Edit your profile"
                        >
                          {team.coach}
                          <ExternalLink size={10} className="opacity-0 group-hover/name:opacity-100 transition-opacity" />
                        </Link>
                      ) : (
                        <p className="font-bold text-slate-700 uppercase text-sm">{team.coach}</p>
                      )}
                      {team.commissioner && (
                        <span title="League Commissioner">
                          <ShieldCheck size={14} className="text-blue-600" />
                        </span>
                      )}
                    </div>
                  </td>
                  <td className="px-8 py-6">
                    {team.email ? (
                      <a 
                        href={`mailto:${team.email}`} 
                        className="flex items-center gap-2 text-blue-600 hover:text-blue-800 font-bold text-sm transition-colors"
                      >
                        <Mail size={14} />
                        {team.email}
                      </a>
                    ) : (
                      <span className="text-slate-300 italic text-xs font-bold uppercase">Not Provided</span>
                    )}
                  </td>
                  <td className="px-8 py-6">
                    {team.mobile ? (
                      <div className="flex items-center gap-2 text-slate-600 font-mono text-sm font-bold">
                        <Phone size={14} className="text-slate-400" />
                        {formatPhone(team.mobile)}
                      </div>
                    ) : (
                      <span className="text-slate-300 italic text-xs font-bold uppercase">Not Provided</span>
                    )}
                  </td>
                  <td className="px-8 py-6 text-right">
                    <Link 
                      href={`/rosters?team=${team.short}`}
                      className="inline-flex items-center gap-2 bg-slate-100 hover:bg-blue-600 hover:text-white text-slate-500 px-4 py-2 rounded-xl text-[10px] font-black uppercase transition-all active:scale-95"
                    >
                      View Roster <ExternalLink size={12} />
                    </Link>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {filteredTeams.length === 0 && (
          <div className="p-20 text-center text-slate-400 font-black uppercase italic">
            No coaches found matching your search.
          </div>
        )}
      </div>
    </div>
  );
}