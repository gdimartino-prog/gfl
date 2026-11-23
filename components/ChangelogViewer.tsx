'use client';

import { useEffect, useMemo, useState } from 'react';
import { Search, X } from 'lucide-react';
import type { ChangelogCategory, ChangelogEntry } from '@/types';
import {
  CHANGELOG_CATEGORIES,
  CHANGELOG_SEEN_EVENT,
  CHANGELOG_STORAGE_KEY,
  formatChangelogDate,
} from '@/lib/changelog';

interface ChangelogViewerProps {
  entries: ChangelogEntry[];
}

const CATEGORY_BADGE_CLASSES: Record<ChangelogCategory, string> = {
  Transactions: 'bg-emerald-50 text-emerald-800 border-emerald-200',
  Rosters: 'bg-blue-50 text-blue-800 border-blue-200',
  Polls: 'bg-indigo-50 text-indigo-800 border-indigo-200',
  'Schedule & Stats': 'bg-amber-50 text-amber-900 border-amber-200',
  Draft: 'bg-purple-50 text-purple-800 border-purple-200',
  'Account & Settings': 'bg-slate-100 text-slate-800 border-slate-300',
  Commissioner: 'bg-rose-50 text-rose-800 border-rose-200',
  General: 'bg-sky-50 text-sky-800 border-sky-200',
};

export default function ChangelogViewer({ entries }: ChangelogViewerProps) {
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<'All' | ChangelogCategory>('All');

  const latestId = entries[0]?.id ?? null;

  useEffect(() => {
    if (!latestId) return;
    try {
      window.localStorage.setItem(CHANGELOG_STORAGE_KEY, latestId);
      window.dispatchEvent(new Event(CHANGELOG_SEEN_EVENT));
    } catch {
      // Ignore storage errors (private browsing / disabled storage)
    }
  }, [latestId]);

  const categoryCounts = useMemo(() => {
    const counts = new Map<ChangelogCategory, number>();
    for (const entry of entries) {
      counts.set(entry.category, (counts.get(entry.category) ?? 0) + 1);
    }
    return CHANGELOG_CATEGORIES.filter((cat) => (counts.get(cat) ?? 0) > 0).map((cat) => ({
      category: cat,
      count: counts.get(cat) ?? 0,
    }));
  }, [entries]);

  const normalizedQuery = searchQuery.trim().toLowerCase();

  const filteredEntries = useMemo(() => {
    return entries.filter((entry) => {
      if (selectedCategory !== 'All' && entry.category !== selectedCategory) {
        return false;
      }
      if (!normalizedQuery) {
        return true;
      }
      const formattedDate = formatChangelogDate(entry.date).toLowerCase();
      return (
        entry.title.toLowerCase().includes(normalizedQuery) ||
        entry.summary.toLowerCase().includes(normalizedQuery) ||
        entry.category.toLowerCase().includes(normalizedQuery) ||
        formattedDate.includes(normalizedQuery) ||
        entry.date.toLowerCase().includes(normalizedQuery)
      );
    });
  }, [entries, selectedCategory, normalizedQuery]);

  const groupedByDate = useMemo(() => {
    const groups: { date: string; formattedDate: string; items: ChangelogEntry[] }[] = [];
    const byDate = new Map<string, ChangelogEntry[]>();

    for (const entry of filteredEntries) {
      let bucket = byDate.get(entry.date);
      if (!bucket) {
        bucket = [];
        byDate.set(entry.date, bucket);
        groups.push({
          date: entry.date,
          formattedDate: formatChangelogDate(entry.date),
          items: bucket,
        });
      }
      bucket.push(entry);
    }

    return groups;
  }, [filteredEntries]);

  const hasActiveFilters = selectedCategory !== 'All' || searchQuery.trim().length > 0;

  const clearFilters = () => {
    setSelectedCategory('All');
    setSearchQuery('');
  };

  return (
    <div className="space-y-8">
      {/* FILTER BAR */}
      <section
        aria-label="Filter updates"
        className="bg-white rounded-2xl border border-slate-200 shadow-sm p-4 md:p-6 space-y-4"
      >
        <div className="relative">
          <Search
            size={16}
            className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none"
            aria-hidden="true"
          />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search updates by feature, page, or keyword..."
            aria-label="Search updates"
            className="w-full min-h-[44px] pl-11 pr-12 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm font-medium text-slate-900 placeholder:text-slate-500 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:bg-white transition-all"
          />
          {searchQuery.length > 0 && (
            <button
              type="button"
              onClick={() => setSearchQuery('')}
              aria-label="Clear search"
              className="absolute right-1 top-1/2 -translate-y-1/2 min-h-[44px] min-w-[44px] inline-flex items-center justify-center text-slate-500 hover:text-slate-800 rounded-lg transition-colors"
            >
              <X size={16} />
            </button>
          )}
        </div>

        <div className="flex flex-wrap items-center gap-2" role="group" aria-label="Filter by category">
          <button
            type="button"
            onClick={() => setSelectedCategory('All')}
            aria-pressed={selectedCategory === 'All'}
            className={`min-h-[44px] px-4 py-2 rounded-full text-xs font-black uppercase tracking-wider border transition-all ${
              selectedCategory === 'All'
                ? 'bg-slate-900 text-white border-slate-900 shadow-sm'
                : 'bg-white text-slate-700 border-slate-200 hover:border-blue-300'
            }`}
          >
            All ({entries.length})
          </button>

          {categoryCounts.map(({ category, count }) => {
            const isActive = selectedCategory === category;
            return (
              <button
                key={category}
                type="button"
                onClick={() => setSelectedCategory(category)}
                aria-pressed={isActive}
                className={`min-h-[44px] px-4 py-2 rounded-full text-xs font-black uppercase tracking-wider border transition-all ${
                  isActive
                    ? 'bg-slate-900 text-white border-slate-900 shadow-sm'
                    : 'bg-white text-slate-700 border-slate-200 hover:border-blue-300'
                }`}
              >
                {category} ({count})
              </button>
            );
          })}
        </div>
      </section>

      {/* TIMELINE */}
      {groupedByDate.length === 0 ? (
        <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-10 text-center space-y-4">
          <p className="text-base font-bold text-slate-800">
            No updates match your current filter.
          </p>
          <p className="text-sm text-slate-600">
            Try another keyword or clear your category filter to view all league updates.
          </p>
          {hasActiveFilters && (
            <button
              type="button"
              onClick={clearFilters}
              className="min-h-[44px] px-5 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-xs font-black uppercase tracking-widest transition-colors"
            >
              Clear filters
            </button>
          )}
        </div>
      ) : (
        <div className="space-y-8">
          {groupedByDate.map((group) => (
            <section key={group.date} aria-labelledby={`changelog-date-${group.date}`} className="space-y-4">
              <div className="flex items-center gap-3 px-1">
                <h2
                  id={`changelog-date-${group.date}`}
                  className="text-xs font-black uppercase tracking-[0.2em] text-slate-600"
                >
                  <time dateTime={group.date}>{group.formattedDate}</time>
                </h2>
                {group.items.length > 1 && (
                  <span className="text-[11px] font-bold text-slate-600 bg-slate-200/70 px-2.5 py-0.5 rounded-full">
                    {group.items.length} updates
                  </span>
                )}
                <div className="flex-1 h-px bg-slate-200" aria-hidden="true" />
              </div>

              <div className="space-y-4">
                {group.items.map((entry) => {
                  const isLatest = entry.id === latestId;
                  return (
                    <article
                      key={entry.id}
                      className="bg-white rounded-2xl border border-slate-200 shadow-sm p-5 md:p-6 transition-shadow hover:shadow-md"
                    >
                      <div className="flex flex-wrap items-center gap-2 mb-3">
                        <span
                          className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-[11px] font-black uppercase tracking-wider border ${CATEGORY_BADGE_CLASSES[entry.category]}`}
                        >
                          {entry.category}
                        </span>

                        {isLatest && (
                          <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-[11px] font-black uppercase tracking-wider bg-blue-600 text-white">
                            Latest
                          </span>
                        )}

                        {entry.audience === 'commissioners' && (
                          <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-[11px] font-bold uppercase tracking-wider bg-slate-100 text-slate-700 border border-slate-200">
                            Commissioner Tool
                          </span>
                        )}
                      </div>

                      <h3 className="text-lg font-black text-slate-900 tracking-tight leading-snug">
                        {entry.title}
                      </h3>
                      <p className="text-sm md:text-[15px] text-slate-600 leading-relaxed mt-1.5">
                        {entry.summary}
                      </p>
                    </article>
                  );
                })}
              </div>
            </section>
          ))}
        </div>
      )}
    </div>
  );
}
