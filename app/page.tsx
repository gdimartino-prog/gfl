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
        <h1 className="text-4xl font-black text-gray-900">Front Office</h1>
        <p className="text-gray-500">Manage your league operations and personnel.</p>
      </header>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {cards.map((card) => (
          <Link 
            key={card.title} 
            href={card.href}
            className={`block p-6 bg-white border-t-4 ${card.color} rounded-xl shadow-sm hover:shadow-md transition-shadow group`}
          >
            <div className="text-4xl mb-4 group-hover:scale-110 transition-transform inline-block">
              {card.icon}
            </div>
            <h2 className="text-xl font-bold text-gray-800">{card.title}</h2>
            <p className="text-gray-600 mt-2 text-sm">{card.desc}</p>
          </Link>
        ))}
      </div>
    </div>
  );
}