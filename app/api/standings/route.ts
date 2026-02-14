import { getHistory } from '@/lib/getHistory';
import { NextResponse } from 'next/server';

export async function GET() {
  try {
    const history = await getHistory();
    return NextResponse.json(history);
  } catch (error) {
    console.error('API /standings failed:', error);
    return NextResponse.json({ error: 'Failed to load standings' }, { status: 500 });
  }
}