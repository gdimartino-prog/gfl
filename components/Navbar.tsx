'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useState, useEffect } from 'react';
import { Menu, X, LogOut, ShieldCheck, ChevronDown } from 'lucide-react';
import { useSession, signOut } from "next-auth/react";
import { useLeague } from '@/context/LeagueContext';

export default function Navbar() {
  const { data: session, status } = useSession();
  const pathname = usePathname();
  const [isOpen, setIsOpen] = useState(false);
  const [leagueOpen, setLeagueOpen] = useState(false);
  const [currentSeason, setCurrentSeason] = useState<string>('2025');
  const { currentLeague, availableLeagues, setLeague } = useLeague();
  const leagueName = currentLeague?.slug.toUpperCase() ?? 'Football League';

  useEffect(() => {
    async function fetchData() {
      try {
        const rulesRes = await fetch('/api/rules', { cache: 'no-store' });
        const rules = await rulesRes.json();
        if (Array.isArray(rules)) {
          const cYear = rules.find(r => r.setting === 'cuts_year');
          if (cYear?.value) setCurrentSeason(cYear.value);
        }
      } catch (err) {
        console.error("Navbar fetch error:", err);
      }
    }
    fetchData();
  }, []);

  const handleSignOut = async () => {
    if (typeof window !== 'undefined') {
      localStorage.removeItem('gfl-selected-team');
    }
    await signOut({ callbackUrl: '/login' });
  };

  const navItems = [
    { name: 'Rosters', href: '/rosters' },
    { name: 'Schedule', href: '/schedule' },
    { name: 'Standings', href: '/standings' },
    { name: 'Transactions', href: '/transactions' },
    { name: 'Trade Block', href: '/trade-block' },
    { name: 'COA Hub', href: '/coaching' },
    { name: 'Draft Board', href: '/draft' },
    { name: 'Free Agents', href: '/free-agents' },
    { name: 'Cuts', href: '/cuts' },
    { name: 'Press Box', href: '/press-box' },
    { name: 'Resources', href: '/resources' },
    { name: 'Directory', href: '/directory' },
    { name: 'Constitution', href: '/rules' },
    { name: 'Manual', href: '/manual' },
  ];

  return (
    <nav className="w-full bg-slate-900 text-white shadow-2xl sticky top-0 z-[100] border-b border-slate-800">
      <div className="max-w-7xl mx-auto px-4 h-16 flex items-center justify-between">

        {/* LOGO SECTION */}
        <div className="flex items-center flex-1 min-w-0">
          <Link href="/" className="flex items-center gap-2 group mr-4 shrink-0">
            <div className="bg-blue-600 p-1.5 rounded-lg group-hover:rotate-12 transition-transform shadow-lg shadow-blue-500/20">
              <ShieldCheck size={18} className="text-white" />
            </div>
            <span className="text-xl font-black italic tracking-tighter uppercase hidden sm:inline-block">
              {leagueName} <span className="text-blue-400">Manager</span>
            </span>
          </Link>

          {/* DESKTOP NAV */}
          <div className="hidden 2xl:flex items-center h-16 overflow-hidden">
            {navItems.map((item) => {
              const isActive = pathname === item.href;
              const isRules = item.href === '/rules';

              return (
                <Link
                  key={item.name}
                  href={item.href}
                  className={`relative h-full flex items-center px-1.5 text-[8px] uppercase font-black tracking-tight whitespace-nowrap transition-all hover:text-blue-400 ${
                    isActive
                      ? 'text-blue-400'
                      : isRules
                        ? 'text-slate-500 italic hover:text-slate-300'
                        : 'text-slate-400'
                  }`}
                >
                  <span className="relative z-10">
                    {item.name}
                  </span>

                  {isActive && (
                    <div className="absolute bottom-0 left-1 right-1 h-[2px] bg-blue-400 rounded-full animate-in fade-in slide-in-from-bottom-1 duration-300" />
                  )}
                </Link>
              );
            })}
          </div>
        </div>

        {/* AUTH & SESSION SECTION */}
        <div className="flex items-center gap-3 shrink-0">
          <div className="hidden md:flex items-center gap-4">
            {status === "authenticated" && session ? (
              <div className="flex items-center gap-3 pr-3 border-r border-slate-800">
                <div className="text-right">
                  <p className="text-[7px] font-black uppercase text-slate-500 tracking-widest leading-none mb-1">Authenticated</p>
                  <p className="text-[10px] font-black text-white uppercase italic whitespace-nowrap">
                    {(session.user as { team?: string; name?: string }).team || session.user?.name}
                  </p>
                </div>
                <button
                  onClick={handleSignOut}
                  className="p-1.5 bg-slate-800/50 text-slate-400 hover:text-red-400 hover:bg-red-400/10 rounded-lg transition-all"
                  title="Logout"
                >
                  <LogOut size={12} />
                </button>
              </div>
            ) : status === "unauthenticated" ? (
              <Link
                href="/login"
                className="text-[9px] font-black uppercase tracking-widest text-blue-400 hover:text-white transition-colors"
              >
                Login
              </Link>
            ) : null}

            <div className="bg-slate-800 px-2 py-0.5 rounded-full border border-slate-700 hidden lg:block">
              <span className="text-[8px] font-black text-slate-500 uppercase tracking-widest">
                {currentSeason}
              </span>
            </div>

            {/* League Switcher — only visible when user has multiple leagues */}
            {availableLeagues.length > 1 && currentLeague && (
              <div className="relative hidden lg:block">
                <button
                  onClick={() => setLeagueOpen(o => !o)}
                  className="flex items-center gap-1 bg-blue-600/20 border border-blue-600/40 px-2 py-0.5 rounded-full text-[8px] font-black uppercase tracking-widest text-blue-400 hover:bg-blue-600/30 transition-all"
                >
                  {currentLeague.slug.toUpperCase()}
                  <ChevronDown size={8} />
                </button>
                {leagueOpen && (
                  <div className="absolute right-0 top-full mt-1 bg-slate-800 border border-slate-700 rounded-lg shadow-xl z-50 min-w-[140px] py-1">
                    {availableLeagues.map(lg => (
                      <button
                        key={lg.id}
                        onClick={() => { setLeague(lg); setLeagueOpen(false); window.location.reload(); }}
                        className={`w-full text-left px-3 py-1.5 text-[9px] font-black uppercase tracking-wider transition-colors ${
                          lg.id === currentLeague.id
                            ? 'text-blue-400 bg-blue-600/10'
                            : 'text-slate-300 hover:text-white hover:bg-slate-700'
                        }`}
                      >
                        {lg.name}
                      </button>
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>

          <button
            className="2xl:hidden p-2 text-slate-300 hover:text-white"
            onClick={() => setIsOpen(!isOpen)}
          >
            {isOpen ? <X size={20} /> : <Menu size={20} />}
          </button>
        </div>
      </div>

      {/* MOBILE MENU */}
      {isOpen && (
        <div className="2xl:hidden bg-slate-900 border-t border-slate-800 animate-in slide-in-from-top duration-200">
          <div className="flex flex-col p-6 space-y-4">
            {navItems.map((item) => (
              <Link
                key={item.name}
                href={item.href}
                onClick={() => setIsOpen(false)}
                className={`text-lg font-black uppercase italic tracking-tighter whitespace-nowrap ${
                  pathname === item.href ? 'text-blue-400' : 'text-slate-300'
                }`}
              >
                {item.name}
              </Link>
            ))}

            <div className="pt-6 mt-2 border-t border-slate-800">
              {session ? (
                <button
                  onClick={handleSignOut}
                  className="flex items-center gap-2 text-[10px] font-black text-red-400 uppercase tracking-widest"
                >
                  <LogOut size={14} /> Logout {session.user?.name}
                </button>
              ) : (
                <Link
                  href="/login"
                  onClick={() => setIsOpen(false)}
                  className="text-[10px] font-black text-blue-400 uppercase tracking-widest"
                >
                  Coach Login →
                </Link>
              )}
            </div>
          </div>
        </div>
      )}
    </nav>
  );
}
