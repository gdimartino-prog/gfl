import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/auth';

export async function GET(req: NextRequest) {
  const session = await auth();
  if (!session?.user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const q = req.nextUrl.searchParams.get('q')?.trim();
  if (!q) return NextResponse.json({ results: [] });

  try {
    const res = await fetch(
      `https://site.api.espn.com/apis/search/v2?query=${encodeURIComponent(q)}&sports=football-nfl&limit=10`,
      { next: { revalidate: 60 } },
    );
    if (!res.ok) return NextResponse.json({ results: [] });
    const data = await res.json();
    const playerBucket = (data.results || []).find(
      (r: { type: string }) => r.type === 'player',
    );
    const contents: Array<{ uid?: string; displayName?: string; subtitle?: string; image?: { default?: string } }> =
      playerBucket?.contents || [];

    const results = contents
      .map((c) => {
        const match = c.uid?.match(/~a:(\d+)/);
        if (!match) return null;
        return {
          espnId: match[1],
          name: c.displayName || '',
          team: c.subtitle || '',
          headshot: c.image?.default || null,
        };
      })
      .filter(Boolean);

    return NextResponse.json({ results }, { headers: { 'Cache-Control': 'private, max-age=60' } });
  } catch {
    return NextResponse.json({ results: [] });
  }
}
