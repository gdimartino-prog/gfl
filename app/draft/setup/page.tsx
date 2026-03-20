import { redirect } from 'next/navigation';
import { isAdmin, isCommissioner } from '@/lib/auth';
import DraftSetupClient from '@/components/DraftSetupClient';

export default async function DraftSetupPage() {
  const admin = await isAdmin();
  const commish = await isCommissioner();
  if (!admin && !commish) redirect('/');
  return <DraftSetupClient />;
}
