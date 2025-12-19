// app/api/draft-picks/route.ts
import { NextResponse } from 'next/server';
import { getAllDraftPicks } from '@/lib/draftPicks';

export async function GET() {
  try {
    const picks = await getAllDraftPicks();

    return NextResponse.json({
      success: true,
      picks,
    });
  } catch (err: any) {
    console.error('GET /api/draft-picks error:', err);

    return NextResponse.json(
      { success: false, error: err.message || 'Failed to load draft picks' },
      { status: 500 }
    );
  }
}
