'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useState } from 'react'; // Added for mobile toggle
import { Menu, X } from 'lucide-react'; // Standard for mobile icons

export default function Navbar() {
  const pathname = usePathname();
  const [isOpen, setIsOpen] = useState(false); // State to track mobile menu

  const navItems = [
    { name: 'Front Office', href: '/' },
    { name: 'Rosters', href: '/rosters' },
    { name: 'Transactions', href: '/transactions' }, 
    { name: 'Draft Board', href: '/draft' },
    { name: 'Cuts', href: '/cuts' },
    { name: 'Resources', href: '/resources' },
    { name: 'Constitution', href: '/rules' }, 
  ];

  return (
    <nav className="w-full bg-slate-900 text-white shadow-md sticky top-0 z-[100] border-b border-slate-800">
      <div className="max-w-7xl mx-auto px-6 h-16 flex items-center justify-between">
        <div className="flex items-center gap-10">
          <Link href="/" className="text-xl font-bold tracking-tighter hover:opacity-90 transition-opacity">
            GFL<span className="text-blue-400">MANAGER</span>
          </Link>
          
          {/* DESKTOP MENU - Hidden on Mobile */}
          <div className="hidden lg:flex space-x-6">
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
                        ? 'text-slate-400 italic' 
                        : 'text-slate-300'
                  }`}
                >
                  {item.name}
                </Link>
              );
            })}
          </div>
        </div>

        {/* RIGHT SIDE: Season Badge & Mobile Toggle */}
        <div className="flex items-center gap-4">
          <div className="hidden md:block">
            <span className="text-[10px] font-black bg-blue-500/10 text-blue-400 border border-blue-500/20 px-2 py-1 rounded tracking-widest uppercase">
              Season 2026
            </span>
          </div>

          {/* MOBILE TOGGLE BUTTON */}
          <button 
            className="lg:hidden p-2 text-slate-300 hover:text-white"
            onClick={() => setIsOpen(!isOpen)}
          >
            {isOpen ? <X size={24} /> : <Menu size={24} />}
          </button>
        </div>
      </div>

      {/* MOBILE MENU - Only shows when toggled */}
      {isOpen && (
        <div className="lg:hidden bg-slate-900 border-t border-slate-800 animate-in slide-in-from-top duration-200">
          <div className="flex flex-col p-4 space-y-4">
            {navItems.map((item) => (
              <Link
                key={item.name}
                href={item.href}
                onClick={() => setIsOpen(false)} // Close menu on click
                className={`text-lg font-bold uppercase tracking-tight ${
                  pathname === item.href ? 'text-blue-400' : 'text-slate-300'
                }`}
              >
                {item.name}
              </Link>
            ))}
            {/* Mobile Badge */}
            <div className="pt-4 border-t border-slate-800">
                <span className="text-[10px] font-black text-blue-400 uppercase tracking-widest">
                    Season 2026
                </span>
            </div>
          </div>
        </div>
      )}
    </nav>
  );
}