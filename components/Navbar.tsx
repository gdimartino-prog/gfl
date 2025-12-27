'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';

export default function Navbar() {
  const pathname = usePathname();

  const navItems = [
    { name: 'Front Office', href: '/' },
    { name: 'Rosters', href: '/rosters' },
    { name: 'Transactions', href: '/transactions' }, 
    { name: 'Draft Board', href: '/draft' }, // Added the new Draft Board link
  ];

  return (
    <nav className="w-full bg-slate-900 text-white shadow-md sticky top-0 z-[100]">
      <div className="max-w-7xl mx-auto px-6 h-16 flex items-center justify-between">
        <div className="flex items-center gap-10">
          <span className="text-xl font-bold tracking-tighter">
            GFL<span className="text-blue-400">MANAGER</span>
          </span>
          
          <div className="flex space-x-6">
            {navItems.map((item) => (
              <Link
                key={item.name}
                href={item.href}
                className={`text-sm font-medium transition-colors hover:text-blue-400 ${
                  pathname === item.href ? 'text-blue-400' : 'text-slate-300'
                }`}
              >
                {item.name}
              </Link>
            ))}
          </div>
        </div>
      </div>
    </nav>
  );
}