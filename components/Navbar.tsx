'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';

export default function Navbar() {
  const pathname = usePathname();

  const navItems = [
    { name: 'Front Office', href: '/' },
    { name: 'Rosters', href: '/rosters' },
    { name: 'Transactions', href: '/transactions' }, 
    { name: 'Draft Board', href: '/draft' },
    { name: 'Cuts', href: '/cuts' },
    // NEW: Added Constitution to the main array
    { name: 'Constitution', href: '/rules' }, 
  ];

  return (
    <nav className="w-full bg-slate-900 text-white shadow-md sticky top-0 z-[100] border-b border-slate-800">
      <div className="max-w-7xl mx-auto px-6 h-16 flex items-center justify-between">
        <div className="flex items-center gap-10">
          <Link href="/" className="text-xl font-bold tracking-tighter hover:opacity-90 transition-opacity">
            GFL<span className="text-blue-400">MANAGER</span>
          </Link>
          
          <div className="flex space-x-6">
            {navItems.map((item) => {
              const isActive = pathname === item.href;
              const isRules = item.href === '/rules';

              return (
                <Link
                  key={item.name}
                  href={item.href}
                  className={`text-sm font-medium transition-all hover:text-blue-400 ${
                    isActive 
                      ? 'text-blue-400' 
                      : isRules 
                        ? 'text-slate-400 italic' // Subtly distinguish the rules link
                        : 'text-slate-300'
                  }`}
                >
                  {item.name}
                </Link>
              );
            })}
          </div>
        </div>

        {/* Optional: Add a small badge or year indicator to the right */}
        <div className="hidden md:block">
          <span className="text-[10px] font-black bg-blue-500/10 text-blue-400 border border-blue-500/20 px-2 py-1 rounded tracking-widest uppercase">
            Season 2026
          </span>
        </div>
      </div>
    </nav>
  );
}