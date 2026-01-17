import Link from 'next/link';
import WeeklyScheduleWidget from '@/components/WeeklyScheduleWidget';

export const dynamic = 'force-dynamic';

export default async function HomePage() {
  const cards = [
    {
      title: 'Team Rosters',
      desc: 'View depth charts, roster sizes, and draft picks.',
      href: '/rosters',
      icon: '📋',
      color: 'border-blue-500'
    },
    {
      title: 'Transactions',
      desc: 'Execute player adds, drops, and team trades.',
      href: '/transactions',
      icon: '🤝',
      color: 'border-green-500'
    },
    {
      title: 'Roster Cuts',
      desc: 'Select protected and pullback players for the new season.',
      href: '/cuts',
      icon: '✂️',
      color: 'border-amber-500'
    },
    {
      title: 'Draft Board',
      desc: 'Track live selections, available players, and draft order.',
      href: '/draft',
      icon: '🏈',
      color: 'border-purple-500'
    },
    {
      title: 'Standings',
      desc: 'View Current Season standings and all-time league history.',
      href: '/standings',
      icon: '🏆',
      color: 'border-blue-600',
    },
    {
      title: 'Training',
      desc: 'Find nearby recovery facilities for player "rehabilitation".',
      href: 'https://www.google.com/search?q=asian+massage+spa+near+me',
      icon: '💆‍♂️',
      color: 'border-emerald-500',
      isExternal: true
    },
    {
      title: 'Classic GFL Site',
      desc: 'Access legacy records, old standings, and historical data.',
      href: 'https://sites.google.com/view/gfl1/home',
      icon: '🏛️',
      color: 'border-slate-500',
      isExternal: true
    },
    {
      title: 'League Resources',
      desc: 'Download season files, player photos, and the Encyclopedia.',
      href: '/resources',
      icon: '📂',
      color: 'border-indigo-500'
    }
  ];

  return (
    <div className="max-w-7xl mx-auto p-4 md:p-8">
      <header className="mb-12">
        <h1 className="text-5xl font-black text-gray-900 tracking-tighter text-left uppercase italic leading-none">
          Front <span className="text-blue-600">Office</span>
        </h1>
        <p className="text-gray-500 text-left font-bold uppercase text-[10px] tracking-[0.3em] mt-3">
            GFL Manager Dashboard
        </p>
      </header>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
        
        {/* LEFT COLUMN: Tool Cards (8 Cols) */}
        <div className="lg:col-span-8">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {cards.map((card) => {
              const cardClasses = `block p-6 bg-white border-t-4 ${card.color} rounded-2xl shadow-sm hover:shadow-xl transition-all hover:-translate-y-1 group text-left h-full`;
              
              const innerContent = (
                <>
                  <div className="text-4xl mb-4 group-hover:rotate-12 transition-transform inline-block">
                    {card.icon}
                  </div>
                  <h2 className="text-xl font-black text-gray-800 uppercase tracking-tight leading-tight">
                    {card.title}
                  </h2>
                  <p className="text-gray-500 mt-2 text-sm leading-relaxed font-medium">
                    {card.desc}
                  </p>
                  <div className={`mt-4 text-[10px] font-black opacity-0 group-hover:opacity-100 transition-opacity uppercase tracking-widest ${card.color.replace('border-', 'text-')}`}>
                    {card.isExternal ? 'External Link ↗' : 'Launch Tool →'}
                  </div>
                </>
              );

              return card.isExternal ? (
                <a key={card.title} href={card.href} target="_blank" rel="noopener noreferrer" className={cardClasses}>
                  {innerContent}
                </a>
              ) : (
                <Link key={card.title} href={card.href} className={cardClasses}>
                  {innerContent}
                </Link>
              );
            })}
          </div>

          {/* Settings remains as a smaller utility link below */}
          <div className="mt-8 pt-8 border-t border-slate-100">
             <Link href="#" className="inline-flex items-center gap-2 text-[10px] font-black uppercase tracking-widest text-slate-400 hover:text-blue-600 transition-colors">
                <span className="text-lg">⚙️</span> League Settings
             </Link>
          </div>
        </div>

        {/* RIGHT COLUMN: Live Sidebar (4 Cols) */}
        <div className="lg:col-span-4">
            <WeeklyScheduleWidget />
        </div>

      </div>
    </div>
  );
}