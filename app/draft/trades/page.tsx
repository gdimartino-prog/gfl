import { getPickTransferHistory } from '@/lib/draftPicks';
import { getLeagueId } from '@/lib/getLeagueId';
import { ArrowRight } from 'lucide-react';

export const dynamic = 'force-dynamic';

export default async function TradedPicksPage() {
  const leagueId = await getLeagueId();
  const transfers = await getPickTransferHistory(leagueId);

  // Group by year + draftType
  const groups = new Map<string, typeof transfers>();
  for (const t of transfers) {
    const key = `${t.year}|${t.draftType}`;
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key)!.push(t);
  }

  const draftLabel = (type: string) =>
    type === 'rookie' ? 'Rookie Draft' : 'Free Agent Draft';

  return (
    <div className="max-w-4xl mx-auto px-6 py-12 space-y-10">
      <div>
        <h1 className="text-3xl font-black uppercase tracking-tight text-slate-900">Traded Draft Picks</h1>
        <p className="text-sm text-slate-500 mt-1 font-medium">All picks that have changed ownership via trade.</p>
      </div>

      {groups.size === 0 && (
        <div className="text-center py-20 text-slate-400 font-black uppercase tracking-widest">No traded picks recorded.</div>
      )}

      {Array.from(groups.entries()).map(([key, rows]) => {
        const [year, draftType] = key.split('|');
        return (
          <div key={key} className="bg-white rounded-3xl shadow-xl border border-slate-100 overflow-hidden">
            <div className="bg-slate-900 px-8 py-5 flex items-center justify-between">
              <div>
                <span className="text-white font-black text-lg uppercase tracking-tight">{year} {draftLabel(draftType)}</span>
              </div>
              <span className="text-slate-400 text-[10px] font-black uppercase tracking-widest">{rows.length} traded picks</span>
            </div>

            <table className="w-full text-left border-separate border-spacing-0">
              <thead>
                <tr className="bg-slate-50 text-slate-400 text-[9px] font-black uppercase tracking-[0.25em]">
                  <th className="px-8 py-4">Round</th>
                  <th className="px-8 py-4">Original Owner</th>
                  <th className="px-4 py-4"></th>
                  <th className="px-8 py-4">Current Owner</th>
                  <th className="px-8 py-4 text-right">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-50">
                {rows.map(t => (
                  <tr key={`${t.round}-${t.originalTeam}`} className="hover:bg-slate-50/50 transition-colors">
                    <td className="px-8 py-5">
                      <span className="text-2xl font-black italic text-slate-200">{t.round}</span>
                    </td>
                    <td className="px-8 py-5">
                      <span className="text-sm font-black uppercase text-slate-500">{t.originalTeamName}</span>
                    </td>
                    <td className="px-4 py-5">
                      <ArrowRight size={14} className="text-slate-300" />
                    </td>
                    <td className="px-8 py-5">
                      <span className="text-sm font-black uppercase text-slate-900">{t.currentTeamName}</span>
                    </td>
                    <td className="px-8 py-5 text-right">
                      {t.isDrafted ? (
                        <div className="inline-flex flex-col items-end">
                          <span className="text-[10px] font-black uppercase text-emerald-600 border border-emerald-100 bg-emerald-50 px-3 py-1.5 rounded-full tracking-widest">Used</span>
                          {t.draftedPlayer && (
                            <span className="text-[9px] font-black text-slate-400 uppercase mt-1">{t.draftedPlayer}</span>
                          )}
                        </div>
                      ) : (
                        <span className="text-[10px] font-black uppercase text-amber-600 border border-amber-100 bg-amber-50 px-3 py-1.5 rounded-full tracking-widest">Available</span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        );
      })}
    </div>
  );
}
