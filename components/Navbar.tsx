'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useState, useEffect } from 'react';
import { Menu, X, LogOut, ShieldCheck, Users } from 'lucide-react';
import { useSession, signOut } from "next-auth/react";

export default function Navbar() {
  const { data: session, status } = useSession();
  const pathname = usePathname();
  const [isOpen, setIsOpen] = useState(false);
  const [draftYear, setDraftYear] = useState<string>('2026');
  const [currentSeason, setCurrentSeason] = useState<string>('2025');

  useEffect(() => {
    async function fetchRules() {
      try {
        const res = await fetch('/api/rules', { cache: 'no-store' });
        const rules = await res.json();
        if (Array.isArray(rules)) {
          const dYear = rules.find(r => r.setting === 'draft_year');
          const cYear = rules.find(r => r.setting === 'cuts_year');
          if (dYear?.value) setDraftYear(dYear.value);
          if (cYear?.value) setCurrentSeason(cYear.value);
        }
      } catch (err) {
        console.error("Navbar rules fetch error:", err);
      }
    }
    fetchRules();
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
    { name: 'COA Hub', href: '/coaching' }, 
    { name: 'Draft Board', href: '/draft' },
    { name: 'Cuts', href: '/cuts' },
    { name: 'Resources', href: '/resources' },
    { name: 'Directory', href: '/directory' },
    { name: 'Constitution', href: '/rules' }, 
  ];

  return (
    <nav className="w-full bg-slate-900 text-white shadow-2xl sticky top-0 z-[100] border-b border-slate-800">
      <div className="max-w-7xl mx-auto px-4 h-16 flex items-center justify-between">
        
        {/* LOGO SECTION */}
        <div className="flex items-center">
          <Link href="/" className="flex items-center gap-2 group mr-4 shrink-0">
            <div className="bg-blue-600 p-1.5 rounded-lg group-hover:rotate-12 transition-transform shadow-lg shadow-blue-500/20">
              <ShieldCheck size={18} className="text-white" />
            </div>
            <span className="text-xl font-black italic tracking-tighter uppercase hidden sm:inline-block">
              GFL<span className="text-blue-400">MANAGER</span>
            </span>
          </Link>
          
          {/* DESKTOP NAV - NO WRAP & SLEEK INDICATOR */}
          <div className="hidden xl:flex items-center h-16">
            {navItems.map((item) => {
              const isActive = pathname === item.href;
              const isRules = item.href === '/rules';

              return (
                <Link
                  key={item.name}
                  href={item.href}
                  className={`relative h-full flex items-center px-2.5 text-[9px] uppercase font-black tracking-tight whitespace-nowrap transition-all hover:text-blue-400 ${
                    isActive 
                      ? 'text-blue-400' 
                      : isRules 
                        ? 'text-slate-500 italic hover:text-slate-300' 
                        : 'text-slate-400'
                  }`}
                >
                  <span className="relative z-10">
                    {item.name === 'Draft Board' ? `${draftYear} Draft` : item.name}
                  </span>
                  
                  {/* ACTIVE INDICATOR LINE */}
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
                    {(session.user as any)?.team || session.user?.name}
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
          </div>

          <button 
            className="xl:hidden p-2 text-slate-300 hover:text-white"
            onClick={() => setIsOpen(!isOpen)}
          >
            {isOpen ? <X size={20} /> : <Menu size={20} />}
          </button>
        </div>
      </div>

      {/* MOBILE MENU */}
      {isOpen && (
        <div className="xl:hidden bg-slate-900 border-t border-slate-800 animate-in slide-in-from-top duration-200">
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
                {item.name === 'Draft Board' ? `${draftYear} Draft` : item.name}
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