import fs from 'fs';
import path from 'path';
import { remark } from 'remark';
import html from 'remark-html';
import { BookOpen } from 'lucide-react';

export default async function ManualPage() {
  const fullPath = path.resolve(process.cwd(), 'USER_MANUAL.md');
  const fileContents = fs.readFileSync(fullPath, 'utf8');

  const processedContent = await remark()
    .use(html, { sanitize: false })
    .process(fileContents);

  const contentHtml = processedContent.toString();

  const navItems = [
    { href: '#getting-started', label: '1. Getting Started' },
    { href: '#home-page', label: '2. Home Page' },
    { href: '#rosters', label: '3. Team Rosters' },
    { href: '#standings', label: '4. League Standings' },
    { href: '#schedule', label: '5. League Schedule' },
    { href: '#draft-board', label: '6. Draft Board' },
    { href: '#transactions', label: '7. Transactions' },
    { href: '#cuts', label: '8. Roster Cuts' },
    { href: '#trade-block', label: '9. Trade Block' },
    { href: '#coaching-hub', label: '10. Coaching Hub' },
    { href: '#press-box', label: '11. Press Box' },
    { href: '#resources', label: '12. League Resources' },
    { href: '#directory', label: '13. League Directory' },
    { href: '#constitution', label: '14. Constitution & Rules' },
    { href: '#settings', label: '15. Franchise Settings' },
    { href: '#commissioner', label: '16. Commissioner Panel' },
    { href: '#league-switcher', label: '17. League Switcher' },
  ];

  return (
    <div className="max-w-7xl mx-auto p-6 md:p-12 min-h-screen bg-gray-50 scroll-smooth">
      <div className="flex flex-col lg:flex-row gap-12">

        {/* SIDEBAR */}
        <aside className="lg:w-1/4">
          <div className="sticky top-8 bg-white p-6 rounded-2xl shadow-sm border border-slate-200">
            <div className="flex items-center gap-2 mb-4">
              <BookOpen size={14} className="text-blue-600" />
              <h3 className="text-xs font-black text-blue-600 uppercase tracking-widest">
                User Manual
              </h3>
            </div>
            <nav className="flex flex-col gap-1 text-sm font-bold text-slate-600">
              {navItems.map((item) => (
                <a
                  key={item.href}
                  href={item.href}
                  className="hover:text-blue-600 transition-colors py-1 leading-tight"
                >
                  {item.label}
                </a>
              ))}
            </nav>
          </div>
        </aside>

        {/* CONTENT */}
        <main className="lg:w-3/4 bg-white p-8 md:p-16 rounded-3xl shadow-sm border border-slate-100">
          <div className="mb-12 border-b border-slate-100 pb-8">
            <h1 className="text-5xl font-black text-slate-900 tracking-tighter uppercase leading-none">
              Front Office <span className="text-blue-600">User Manual</span>
            </h1>
            <p className="text-[11px] font-black text-slate-400 uppercase tracking-[0.2em] italic mt-3">
              2026 Season Guide — GFL League Manager
            </p>
          </div>

          <article
            className="prose prose-slate max-w-none prose-headings:scroll-mt-24 prose-h2:text-2xl prose-h2:font-black prose-h2:uppercase prose-h2:tracking-tight prose-h3:font-black prose-h3:text-blue-900 prose-table:text-sm prose-td:py-2 prose-th:py-2 prose-code:text-blue-700 prose-code:bg-blue-50 prose-code:px-1.5 prose-code:rounded prose-code:font-mono prose-code:text-xs prose-blockquote:border-blue-300 prose-blockquote:text-slate-600 prose-strong:text-slate-900"
            dangerouslySetInnerHTML={{ __html: contentHtml }}
          />
        </main>
      </div>
    </div>
  );
}
