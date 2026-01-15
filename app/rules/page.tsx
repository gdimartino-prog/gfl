import fs from 'fs';
import path from 'path';
import { remark } from 'remark';
import html from 'remark-html';

export default async function RulesPage() {
  const fullPath = path.resolve(process.cwd(), 'app', 'content', 'constitution.md');
  const fileContents = fs.readFileSync(fullPath, 'utf8');

 const processedContent = await remark()
  .use(html, { sanitize: false }) // 👈 THIS IS THE CRITICAL FIX
  .process(fileContents);
    
  const contentHtml = processedContent.toString();

  const navItems = [
    { href: "#management", label: "I. League Structure" },
    { href: "#roster", label: "II. Roster Rules" },
    { href: "#expansion", label: "III. Expansion" },
    { href: "#trades", label: "IV. Trades" },
    { href: "#protocol", label: "V. Protocol" },
    { href: "#postseason", label: "VI. Post Season" },
    { href: "#gamerules", label: "VII. Game Rules" },
  ];

  return (
    <div className="max-w-7xl mx-auto p-6 md:p-12 min-h-screen bg-gray-50 scroll-smooth">
      <div className="flex flex-col lg:flex-row gap-12">
        
        {/* SIDEBAR */}
        <aside className="lg:w-1/4">
          <div className="sticky top-8 bg-white p-6 rounded-2xl shadow-sm border border-slate-200">
            <h3 className="text-xs font-black text-blue-600 uppercase tracking-widest mb-4">
              Constitution Sections
            </h3>
            <nav className="flex flex-col gap-2 text-sm font-bold text-slate-600">
              {navItems.map((item) => (
                <a 
                  key={item.href} 
                  href={item.href} 
                  className="hover:text-blue-600 transition-colors py-1"
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
            <h1 className="text-5xl font-black text-slate-900 tracking-tighter uppercase">
              League Constitution
            </h1>
          </div>

          <article 
            className="prose prose-slate max-w-none prose-headings:scroll-mt-24"
            dangerouslySetInnerHTML={{ __html: contentHtml }} 
          />
        </main>
      </div>
    </div>
  );
}