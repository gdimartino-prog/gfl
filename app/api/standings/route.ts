import { getStandings } from '@/lib/getStandings';
import { getLeagueId } from '@/lib/getLeagueId';
import { NextResponse } from 'next/server';

export async function GET() {
  try {
    const leagueId = await getLeagueId();
    const data = await getStandings(leagueId);
    return NextResponse.json(data);
  } catch (error) {
    console.error('API /standings failed:', error);
    return NextResponse.json([], { status: 200 });
  }
}
