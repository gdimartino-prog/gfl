'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useState, useEffect } from 'react';
import { Menu, X, LogOut, User, ShieldCheck, Zap } from 'lucide-react'; // Added Zap for a "Hub" feel
import { useSession, signOut } from "next-auth/react";

export default function Navbar() {
  const { data: session, status } = useSession();
  const pathname = usePathname();
  const [isOpen, setIsOpen] = useState(false);
  const [draftYear, setDraftYear] = useState<string>('2026');

  useEffect(() => {
    async function fetchRules() {
      try {
        const res = await fetch('/api/rules', { cache: 'no-store' });
        const rules = await res.json();
        if (Array.isArray(rules)) {
          const yearRule = rules.find(r => r.setting === 'draft_year');
          if (yearRule?.value) setDraftYear(yearRule.value);
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

  // UPDATED NAV ITEMS
  const navItems = [
    { name: 'Front Office', href: '/' },
    { name: 'Rosters', href: '/rosters' },
    { name: 'Schedule', href: '/schedule' }, 
    { name: 'Transactions', href: '/transactions' }, 
    { name: 'Draft Board', href: '/draft' },
    { name: 'Cuts', href: '/cuts' },
    { name: 'Standings', href: '/standings' },
    { name: 'Coaching Hub', href: '/coaching' }, // NEW ITEM
    { name: 'Resources', href: '/resources' },
    { name: 'Constitution', href: '/rules' }, 
  ];

  return (
    <nav className="w-full bg-slate-900 text-white shadow-2xl sticky top-0 z-[100] border-b border-slate-800">
      <div className="max-w-7xl mx-auto px-6 h-16 flex items-center justify-between">
        <div className="flex items-center gap-6">
          <Link href="/" className="flex items-center gap-2 group mr-2">
            <div className="bg-blue-600 p-1 rounded-lg group-hover:rotate-12 transition-transform">
              <ShieldCheck size={16} className="text-white" />
            </div>
            <span className="text-lg font-black italic tracking-tighter uppercase">
              GFL<span className="text-blue-400">MANAGER</span>
            </span>
          </Link>
          
          <div className="hidden lg:flex space-x-4">
            {navItems.map((item) => {
              const isActive = pathname === item.href;
              const isRules = item.href === '/rules';
              const isNew = item.name === 'Coaching Hub'; // For special styling

              return (
                <Link
                  key={item.name}
                  href={item.href}
                  className={`text-[10px] uppercase font-black tracking-widest transition-all hover:text-blue-400 flex items-center gap-1 ${
                    isActive 
                      ? 'text-blue-400 underline underline-offset-8 decoration-2' 
                      : isRules 
                        ? 'text-slate-500 italic' 
                        : isNew
                          ? 'text-emerald-400' // Highlight the new feature
                          : 'text-slate-400'
                  }`}
                >
                  {isNew && <Zap size={10} className="animate-pulse" />}
                  {item.name === 'Draft Board' ? `${draftYear} Draft` : item.name}
                </Link>
              );
            })}
          </div>
        </div>

        {/* Auth section stays the same as your original provided code */}
        <div className="flex items-center gap-4">
          <div className="hidden md:flex items-center gap-4">
            {status === "authenticated" && session ? (
              <div className="flex items-center gap-3 pr-4 border-r border-slate-800">
                <div className="text-right">
                  <p className="text-[8px] font-black uppercase text-slate-500 tracking-widest leading-none mb-1">Authenticated</p>
                  <p className="text-[11px] font-black text-white uppercase italic">{session.user?.name}</p>
                </div>
                <button 
                  onClick={handleSignOut}
                  className="p-2 bg-slate-800/50 text-slate-400 hover:text-red-400 hover:bg-red-400/10 rounded-lg transition-all"
                  title="Logout"
                >
                  <LogOut size={14} />
                </button>
              </div>
            ) : status === "unauthenticated" ? (
              <Link 
                href="/login"
                className="text-[10px] font-black uppercase tracking-widest text-blue-400 hover:text-white transition-colors"
              >
                Login
              </Link>
            ) : null}

            <div className="bg-slate-800 px-2 py-1 rounded border border-slate-700">
               <span className="text-[9px] font-black text-slate-300 uppercase tracking-widest">
                 Season {draftYear}
               </span>
            </div>
          </div>

          <button 
            className="lg:hidden p-2 text-slate-300 hover:text-white"
            onClick={() => setIsOpen(!isOpen)}
          >
            {isOpen ? <X size={24} /> : <Menu size={24} />}
          </button>
        </div>
      </div>

      {/* MOBILE MENU UPDATED */}
      {isOpen && (
        <div className="lg:hidden bg-slate-900 border-t border-slate-800 animate-in slide-in-from-top duration-200">
          <div className="flex flex-col p-6 space-y-4">
            {session && (
              <div className="flex items-center gap-4 p-3 bg-slate-800/50 rounded-xl mb-2">
                <div className="bg-blue-600 p-2 rounded-lg">
                  <User size={18} className="text-white" />
                </div>
                <div>
                  <p className="text-[9px] font-black text-slate-500 uppercase tracking-widest leading-none mb-1">Coach</p>
                  <p className="text-lg font-black text-white italic uppercase">{session.user?.name}</p>
                </div>
              </div>
            )}

            {navItems.map((item) => (
              <Link
                key={item.name}
                href={item.href}
                onClick={() => setIsOpen(false)}
                className={`text-lg font-black uppercase italic tracking-tighter flex items-center gap-2 ${
                  pathname === item.href ? 'text-blue-400' : 'text-slate-300'
                }`}
              >
                {item.name === 'Coaching Hub' && <Zap size={16} className="text-emerald-400" />}
                {item.name === 'Draft Board' ? `${draftYear} Draft` : item.name}
              </Link>
            ))}

            {/* Logout/Login logic remains the same */}
            <div className="pt-4 mt-2 border-t border-slate-800 flex justify-between items-center">
                {session ? (
                  <button 
                    onClick={handleSignOut}
                    className="flex items-center gap-2 text-[10px] font-black text-red-400 uppercase tracking-widest"
                  >
                    <LogOut size={14} /> Logout
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