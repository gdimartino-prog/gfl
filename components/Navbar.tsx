'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useState, useEffect } from 'react';
import { Menu, X, LogOut, User } from 'lucide-react';
import { useSession, signOut } from "next-auth/react";

export default function Navbar() {
  const { data: session } = useSession();
  const pathname = usePathname();
  const [isOpen, setIsOpen] = useState(false);
  const [draftYear, setDraftYear] = useState<string>('2026');

  // Logic to fetch draft year from your Rules tab
  useEffect(() => {
    async function fetchRules() {
      try {
        const res = await fetch('/api/rules', { cache: 'no-store' });
        const rules = await res.json();
        if (Array.isArray(rules)) {
          const yearRule = rules.find(r => r.setting === 'draft_year');
          if (yearRule && yearRule.value) {
            setDraftYear(yearRule.value);
          }
        }
      } catch (err) {
        console.error("Navbar rules fetch error:", err);
      }
    }
    fetchRules();
  }, []);

  /**
   * THE FIX: Enhanced Logout
   * This function clears the browser's memory of the selected team
   * before terminating the session.
   */
  const handleSignOut = async () => {
    if (typeof window !== 'undefined') {
      localStorage.removeItem('gfl-selected-team');
    }
    await signOut({ callbackUrl: '/login' });
  };

  const navItems = [
    { name: 'Front Office', href: '/' },
    { name: 'Rosters', href: '/rosters' },
    { name: 'Schedule', href: '/schedule' }, 
    { name: 'Transactions', href: '/transactions' }, 
    { name: 'Draft Board', href: '/draft' },
    { name: 'Cuts', href: '/cuts' },
    { name: 'Standings', href: '/standings' },
    { name: 'Resources', href: '/resources' },
    { name: 'Constitution', href: '/rules' }, 
  ];

  return (
    <nav className="w-full bg-slate-900 text-white shadow-md sticky top-0 z-[100] border-b border-slate-800">
      <div className="max-w-7xl mx-auto px-6 h-16 flex items-center justify-between">
        <div className="flex items-center gap-6">
          <Link href="/" className="text-xl font-bold tracking-tighter hover:opacity-90 transition-opacity">
            GFL<span className="text-blue-400">MANAGER</span>
          </Link>
          
          <div className="hidden lg:flex space-x-4">
            {navItems.map((item) => {
              const isActive = pathname === item.href;
              const isRules = item.href === '/rules';

              return (
                <Link
                  key={item.name}
                  href={item.href}
                  className={`text-[11px] uppercase font-black tracking-wider transition-all hover:text-blue-400 ${
                    isActive 
                      ? 'text-blue-400' 
                      : isRules 
                        ? 'text-slate-400 italic' 
                        : 'text-slate-300'
                  }`}
                >
                  {item.name === 'Draft Board' ? `${draftYear} Draft` : item.name}
                </Link>
              );
            })}
          </div>
        </div>

        <div className="flex items-center gap-4">
          <div className="hidden md:flex items-center gap-4">
            {session ? (
              <div className="flex items-center gap-3 pr-4 border-r border-slate-800">
                <div className="text-right">
                  <p className="text-[9px] font-black uppercase text-slate-500 leading-none mb-0.5">Coach</p>
                  <p className="text-[11px] font-bold text-white leading-none">{session.user?.name}</p>
                </div>
                {/* Use the new handleSignOut function here */}
                <button 
                  onClick={handleSignOut}
                  className="p-2 text-slate-400 hover:text-red-400 transition-colors"
                  title="Log Out"
                >
                  <LogOut size={16} />
                </button>
              </div>
            ) : (
              <Link 
                href="/login"
                className="text-[10px] font-black uppercase tracking-widest text-blue-400 hover:text-white transition-colors"
              >
                Login
              </Link>
            )}

            <span className="text-[10px] font-black bg-blue-500/10 text-blue-400 border border-blue-500/20 px-2 py-1 rounded tracking-widest uppercase">
              Season {draftYear}
            </span>
          </div>

          <button 
            className="lg:hidden p-2 text-slate-300 hover:text-white"
            onClick={() => setIsOpen(!isOpen)}
          >
            {isOpen ? <X size={24} /> : <Menu size={24} />}
          </button>
        </div>
      </div>

      {/* MOBILE MENU */}
      {isOpen && (
        <div className="lg:hidden bg-slate-900 border-t border-slate-800 animate-in slide-in-from-top duration-200">
          <div className="flex flex-col p-4 space-y-4">
            {session && (
              <div className="flex items-center gap-3 p-3 bg-slate-800/50 rounded-xl mb-2">
                <div className="bg-blue-500/20 p-2 rounded-lg">
                  <User size={20} className="text-blue-400" />
                </div>
                <div>
                  <p className="text-[10px] font-black text-slate-500 uppercase tracking-widest leading-none">Logged in as</p>
                  <p className="text-lg font-black text-white">{session.user?.name}</p>
                </div>
              </div>
            )}

            {navItems.map((item) => (
              <Link
                key={item.name}
                href={item.href}
                onClick={() => setIsOpen(false)}
                className={`text-lg font-bold uppercase tracking-tight ${
                  pathname === item.href ? 'text-blue-400' : 'text-slate-300'
                }`}
              >
                {item.name === 'Draft Board' ? `${draftYear} Draft` : item.name}
              </Link>
            ))}

            <div className="pt-4 mt-2 border-t border-slate-800 flex justify-between items-center">
                <span className="text-[10px] font-black text-blue-400 uppercase tracking-widest">
                  Season {draftYear}
                </span>
                
                {session ? (
                  <button 
                    onClick={handleSignOut}
                    className="flex items-center gap-2 text-[10px] font-black text-red-400 uppercase tracking-widest"
                  >
                    <LogOut size={14} /> Log Out
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