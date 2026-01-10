//need to save Constition from google doc as md file via file->download menu to update content


import fs from 'fs';
import path from 'path';
import { remark } from 'remark';
import html from 'remark-html';
import toc from 'remark-toc';
import slug from 'rehype-slug';

export default async function RulesPage() {
  //const fullPath = path.join(process.cwd(), 'app/content/constitution.md');
  const fullPath = path.resolve(process.cwd(), 'app', 'content', 'constitution.md');
  const fileContents = fs.readFileSync(fullPath, 'utf8');

  // Convert Markdown to HTML with TOC and Slugs (for anchor links)
  const processedContent = await remark()
    .use(toc, { heading: 'contents|table of contents|toc' }) // Looks for a "# Contents" header
    .use(html)
    .process(fileContents);
    
  const contentHtml = processedContent.toString();

  return (
    <div className="max-w-7xl mx-auto p-6 md:p-12 min-h-screen bg-gray-50">
      <div className="flex flex-col lg:flex-row gap-12">
        
        {/* LEFT COLUMN: Sticky Navigation */}
        <aside className="lg:w-1/4">
          <div className="sticky top-8 bg-white p-6 rounded-2xl shadow-sm border border-slate-200">
            <h3 className="text-xs font-black text-blue-600 uppercase tracking-widest mb-4">
              Constitution Sections
            </h3>
            <nav className="space-y-2 text-sm font-bold text-slate-600">
              {/* These can be hardcoded or extracted. Let's start simple: */}
              <a href="#article-i-league-structure" className="block hover:text-blue-600">I. League Structure</a>
              <a href="#article-ii-roster-settings" className="block hover:text-blue-600">II. Roster Settings</a>
              <a href="#article-iii-scoring" className="block hover:text-blue-600">III. Scoring</a>
              <a href="#article-iv-drafting" className="block hover:text-blue-600">IV. Drafting</a>
              <a href="#article-v-trades" className="block hover:text-blue-600">V. Trades</a>
            </nav>
          </div>
        </aside>

        {/* RIGHT COLUMN: The Rules */}
        <main className="lg:w-3/4 bg-white p-8 md:p-16 rounded-3xl shadow-sm border border-slate-100">
          <div className="mb-12 border-b border-slate-100 pb-8">
            <h1 className="text-5xl font-black text-slate-900 tracking-tighter uppercase">
              League Constitution
            </h1>
            <p className="text-slate-400 font-mono text-xs mt-4 uppercase tracking-widest">
              Standard Operating Procedure • 2026 Edition
            </p>
          </div>

          <article 
            className="prose prose-slate prose-headings:font-black prose-h2:text-2xl prose-h2:border-b prose-h2:pb-2 prose-a:text-blue-600 max-w-none prose-img:rounded-xl"
            dangerouslySetInnerHTML={{ __html: contentHtml }} 
          />
        </main>
      </div>
    </div>
  );
}