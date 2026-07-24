import { NextResponse } from 'next/server';
import { unstable_cache } from 'next/cache';

async function fetchNewsIds(): Promise<string[]> {
  try {
    const res = await fetch(
      'https://site.api.espn.com/apis/site/v2/sports/football/nfl/news?limit=100&lang=en',
      { cache: 'no-store' },
    );
    if (!res.ok) return [];
    const data = await res.json();
    const ids = new Set<string>();
    for (const article of (data.articles ?? [])) {
      for (const athlete of (article.athletes ?? [])) {
        const id = String(athlete.id ?? '');
        if (/^\d+$/.test(id)) ids.add(id);
      }
    }
    return Array.from(ids);
  } catch {
    return [];
  }
}

const _cached = unstable_cache(fetchNewsIds, ['espn-news-v1'], { revalidate: 3600, tags: ['espn-news'] });

export async function GET() {
  const ids = await _cached();
  return NextResponse.json({ ids }, {
    headers: { 'Cache-Control': 'public, max-age=3600, stale-while-revalidate=600' },
  });
}
