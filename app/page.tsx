import Link from 'next/link';

export default function HomePage() {
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
      desc: 'Select your protected and pullback players for the new season.',
      href: '/cuts',
      icon: '✂️',
      color: 'border-amber-500' // New gold color for the offseason tool
    },
    {
      title: 'Draft Board',
      desc: 'Track live selections, available players, and draft order.',
      href: '/draft',
      icon: '🏈',
      color: 'border-purple-500'
    },
    {
      title: 'League Settings',
      desc: 'Manage team names and league rules.',
      href: '#',
      icon: '⚙️',
      color: 'border-gray-500'
    }
  ];

  return (
    <div className="max-w-7xl mx-auto p-8">
      <header className="mb-12">
        <h1 className="text-4xl font-black text-gray-900 tracking-tight text-left uppercase">Front Office</h1>
        <p className="text-gray-500 text-left">Manage your league operations and personnel.</p>
      </header>

      {/* Grid updated to auto-fill to handle 5 cards cleanly */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5 gap-6">
        {cards.map((card) => (
          <Link 
            key={card.title} 
            href={card.href}
            className={`block p-6 bg-white border-t-4 ${card.color} rounded-xl shadow-sm hover:shadow-md transition-all hover:-translate-y-1 group text-left`}
          >
            <div className="text-4xl mb-4 group-hover:rotate-12 transition-transform inline-block">
              {card.icon}
            </div>
            <h2 className="text-xl font-bold text-gray-800 uppercase tracking-tight leading-tight">
              {card.title}
            </h2>
            <p className="text-gray-600 mt-2 text-sm leading-relaxed">
              {card.desc}
            </p>
            <div className={`mt-4 text-[10px] font-black opacity-0 group-hover:opacity-100 transition-opacity uppercase tracking-widest ${card.color.replace('border-', 'text-')}`}>
              Launch Tool →
            </div>
          </Link>
        ))}
      </div>
    </div>
  );
}