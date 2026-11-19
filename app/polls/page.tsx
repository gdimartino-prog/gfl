import { redirect } from 'next/navigation';
import { auth } from '@/auth';
import { getLeagueId } from '@/lib/getLeagueId';
import { getPollsForViewer } from '@/lib/polls';
import PollsClient from './components/PollsClient';

export default async function PollsPage() {
  const session = await auth();
  if (!session?.user) {
    redirect('/login');
  }

  const leagueId = await getLeagueId();
  const initialData = await getPollsForViewer(session, leagueId);

  return <PollsClient initialData={initialData} />;
}
