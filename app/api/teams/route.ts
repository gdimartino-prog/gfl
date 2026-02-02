import { NextResponse } from 'next/server';
import { getCoaches } from '@/lib/config'; // Import the helper function

export async function GET() {
  try {
    const allCoaches = await getCoaches();

    // Now simply filter for active coaches
    const activeTeams = allCoaches
      .filter(c => c.status === 'active')
      .map(c => ({
        name: c.team,
        short: c.teamshort,
        coach: c.coach,
        commissioner: c.isCommissioner,
        lastSync: c.lastSync
      }));

    return NextResponse.json(activeTeams);
  } catch (error) {
    console.error('API /teams failed:', error);
    return NextResponse.json(
      { error: 'Failed to load teams' },
      { status: 500 }
    );
  }
}