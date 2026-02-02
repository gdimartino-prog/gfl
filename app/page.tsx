import Link from 'next/link';
import WeeklyScheduleWidget from '@/components/WeeklyScheduleWidget';
import { auth } from "@/auth"; 
import LogoutButton from '@/components/LogoutButton'; 

export const dynamic = 'force-dynamic';

export default async function HomePage() {
  const session = await auth(); 

  const cards = [
    {
      title: 'Team Rosters',
      desc: 'View depth charts, roster sizes, and draft picks.',
      href: '/rosters',
      icon: '📋',
      color: 'border-blue-500',
      protected: false
    },
    {
      title: 'League Resources',
      desc: 'Download season files, player photos, and the Encyclopedia.',
      href: '/resources',
      icon: '📂',
      color: 'border-indigo-500',
      protected: false
    },
    {
      title: 'Coach (COA) Hub', // NEW CARD
      desc: 'Upload and Download team .COA files.' ,
      href: '/coaching',
      icon: '📡',
      color: 'border-blue-600',
      protected: true 
    },
    {
      title: 'Transactions',
      desc: 'Execute player adds, drops, and team trades.',
      href: '/transactions',
      icon: '🤝',
      color: 'border-green-500',
      protected: true 
    },
    {
      title: 'Roster Cuts',
      desc: 'Select protected and pullback players for the new season.',
      href: '/cuts',
      icon: '✂️',
      color: 'border-amber-500',
      protected: true
    },
    {
      title: 'Draft Board',
      desc: 'Track live selections, available players, and draft order.',
      href: '/draft',
      icon: '🏈',
      color: 'border-purple-500',
      protected: true
    },
    {
      title: 'Standings',
      desc: 'View Current Season standings and all-time league history.',
      href: '/standings',
      icon: '🏆',
      color: 'border-blue-600',
      protected: false
    },
    {
      title: 'Training',
      desc: 'Find nearby recovery facilities for player "rehabilitation".',
      href: 'https://www.google.com/search?q=asian+massage+spa+near+me',
      icon: '💆‍♂️',
      color: 'border-emerald-500',
      isExternal: true,
      protected: false
    },
    {
      title: 'Classic GFL Site',
      desc: 'Access legacy records, old standings, and historical data.',
      href: 'https://sites.google.com/view/gfl1/home',
      icon: '🏛️',
      color: 'border-slate-500',
      isExternal: true,
      protected: false
    },
    {
      title: 'Franchise Settings',
      desc: 'Update your coach profile and perform security password resets.',
      href: '/settings',
      icon: '⚙️',
      color: 'border-slate-600',
      protected: true
    }
  ];

  return (
    <div className="max-w-7xl mx-auto p-4 md:p-8">
      <header className="mb-12 flex flex-col md:flex-row items-start md:items-center justify-between gap-6">
        <div className="flex items-center gap-6">
          <div className="bg-white p-2 rounded-xl shadow-sm border border-slate-100">
            <img 
              src="/icon.png" 
              alt="GFL Logo" 
              className="h-20 w-auto object-contain"
            />
          </div>

          <div className="text-left">
            <h1 className="text-5xl font-black text-gray-900 tracking-tighter uppercase italic leading-none">
              Front <span className="text-blue-600">Office</span>
            </h1>
            <p className="text-gray-500 font-bold uppercase text-[10px] tracking-[0.3em] mt-3">
                GFL Manager Dashboard
            </p>
          </div>
        </div>

        {session && (
          <div className="bg-blue-50 px-4 py-2 rounded-full border border-blue-100 flex items-center gap-3">
             <span className="w-2 h-2 bg-blue-500 rounded-full animate-pulse"></span>
             <span className="text-[10px] font-black text-blue-700 uppercase tracking-widest">
               Authenticated: {session.user?.name}
             </span>
          </div>
        )}
      </header>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
        
        {/* LEFT COLUMN: Tool Cards */}
        <div className="lg:col-span-8">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {cards.map((card) => {
              const isLocked = card.protected && !session;
              const cardClasses = `block p-6 bg-white border-t-4 ${card.color} rounded-2xl shadow-sm hover:shadow-xl transition-all hover:-translate-y-1 group text-left h-full ${isLocked ? 'opacity-75 grayscale-[0.5]' : ''}`;
              
              const innerContent = (
                <>
                  <div className="flex justify-between items-start">
                    <div className="text-4xl mb-4 group-hover:rotate-12 transition-transform inline-block">
                      {isLocked ? '🔒' : card.icon}
                    </div>
                    {isLocked && (
                      <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest bg-slate-100 px-2 py-1 rounded">
                        Login Required
                      </span>
                    )}
                  </div>
                  <h2 className="text-xl font-black text-gray-800 uppercase tracking-tight leading-tight">
                    {card.title}
                  </h2>
                  <p className="text-gray-500 mt-2 text-sm leading-relaxed font-medium">
                    {card.desc}
                  </p>
                  <div className={`mt-4 text-[10px] font-black opacity-0 group-hover:opacity-100 transition-opacity uppercase tracking-widest ${card.color.replace('border-', 'text-')}`}>
                    {isLocked ? 'Unlock via Login →' : (card.isExternal ? 'External Link ↗' : 'Launch Tool →')}
                  </div>
                </>
              );

              return card.isExternal ? (
                <a key={card.title} href={card.href} target="_blank" rel="noopener noreferrer" className={cardClasses}>
                  {innerContent}
                </a>
              ) : (
                <Link key={card.title} href={isLocked ? '/login' : card.href} className={cardClasses}>
                  {innerContent}
                </Link>
              );
            })}
          </div>

          {/* AUTHORIZED FOOTER ACTIONS */}
          {session && (
            <div className="mt-8 pt-8 border-t border-slate-100 flex flex-col sm:flex-row items-center justify-end gap-4">
               <div className="flex items-center gap-6">
                 <div className="h-4 w-[1px] bg-slate-200" />
                 <LogoutButton />
               </div>
            </div>
          )}
        </div>

        {/* RIGHT COLUMN: Live Sidebar */}
        <div className="lg:col-span-4">
            <WeeklyScheduleWidget />
        </div>

      </div>
    </div>
  );
}