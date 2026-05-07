'use client';
import { DraftPick } from '@/types';

interface Props {
  picks: DraftPick[];
  yearFilter: string;
  draftTypeFilter: 'free_agent' | 'rookie' | 'all';
  onClockPick: DraftPick | undefined;
  timeLeft: string;
  getFullTeamName: (short: string) => string;
}

export default function DraftGridView({ picks, yearFilter, draftTypeFilter, onClockPick, timeLeft, getFullTeamName }: Props) {
  const yearPicks = picks.filter(p =>
    String(p.year) === yearFilter &&
    (draftTypeFilter === 'all' || p.draftType === draftTypeFilter)
  );

  const rounds = [...new Set(yearPicks.map(p => p.round))].sort((a, b) => a - b);

  // Order columns by first pick overall in the draft (teams that pick first appear first)
  const ownerShortsInOrder = (() => {
    const seen = new Set<string>();
    [...yearPicks]
      .sort((a, b) => (a.overall ?? 0) - (b.overall ?? 0))
      .forEach(p => { if (p.currentOwner) seen.add(p.currentOwner); });
    return Array.from(seen);
  })();

  // Build grid: grid[round][teamShort] = DraftPick[]
  const grid: Record<number, Record<string, DraftPick[]>> = {};
  for (const round of rounds) {
    grid[round] = {};
    for (const short of ownerShortsInOrder) {
      grid[round][short] = yearPicks.filter(p => p.round === round && p.currentOwner === short)
        .sort((a, b) => (a.overall ?? 0) - (b.overall ?? 0));
    }
  }

  const renderCell = (cellPicks: DraftPick[]) => {
    if (cellPicks.length === 0) {
      return <div className="h-full flex items-center justify-center text-slate-700 text-[10px]">—</div>;
    }
    return (
      <div className="flex flex-col gap-1">
        {cellPicks.map(pick => {
          const isDrafted = !!pick.draftedPlayer && !pick.draftedPlayer.includes('SKIPPED');
          const isSkipped = pick.draftedPlayer?.includes('SKIPPED');
          const isPassed = pick.status === 'Passed';
          const isOnClock = onClockPick?.overall === pick.overall && onClockPick?.year === pick.year;
          const isTraded = pick.originalTeam && pick.currentOwner &&
            pick.originalTeam.toUpperCase() !== getFullTeamName(pick.currentOwner).toUpperCase();

          let bg = 'bg-slate-800 border-slate-700 text-slate-300';
          if (isOnClock) bg = 'bg-blue-500 border-blue-300 text-white shadow-[0_0_12px_rgba(59,130,246,0.6)] animate-pulse';
          else if (isDrafted) bg = 'bg-emerald-900/70 border-emerald-700 text-emerald-100';
          else if (isPassed) bg = 'bg-amber-900/60 border-amber-700 text-amber-200';
          else if (isSkipped) bg = 'bg-orange-900/60 border-orange-700 text-orange-200';
          else if (isTraded) bg = 'bg-slate-700 border-slate-600 text-slate-200';

          return (
            <div key={pick.overall} className={`rounded p-1.5 border text-[9px] leading-tight ${bg}`}>
              {isOnClock ? (
                <>
                  <div className="font-black text-white uppercase tracking-tight">⚡ On the Clock</div>
                  <div className="font-mono text-yellow-200 font-bold mt-0.5">{timeLeft}</div>
                  <div className="text-blue-200 mt-0.5">Pick #{pick.overall}</div>
                </>
              ) : isDrafted ? (
                <>
                  {pick.draftedPlayerPosition && (
                    <span className="font-black text-emerald-400 uppercase mr-1">{pick.draftedPlayerPosition}</span>
                  )}
                  <a
                    href={`https://www.google.com/search?q=${encodeURIComponent(pick.draftedPlayer.split(' - ')[0].trim())}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="font-bold hover:text-emerald-300 hover:underline transition-colors"
                  >
                    {pick.draftedPlayer}
                  </a>
                  {isTraded && <div className="text-slate-400 mt-0.5 text-[8px]">via {pick.originalTeam}</div>}
                </>
              ) : isPassed ? (
                <>
                  <div className="font-bold">Passed</div>
                  <div className="text-[8px] text-slate-400">Pick #{pick.overall}</div>
                </>
              ) : isSkipped ? (
                <>
                  <div className="font-bold">Expired</div>
                  <div className="text-[8px] text-slate-400">Pick #{pick.overall}</div>
                </>
              ) : (
                <>
                  <div className="font-bold text-slate-400">Pick #{pick.overall}</div>
                  {isTraded && <div className="text-blue-400 text-[8px]">via {pick.originalTeam}</div>}
                </>
              )}
            </div>
          );
        })}
      </div>
    );
  };

  if (yearPicks.length === 0) {
    return (
      <div className="p-20 text-center text-slate-500 font-black uppercase italic">
        No picks found for {yearFilter}.
      </div>
    );
  }

  return (
    <div className="overflow-x-auto rounded-2xl border border-slate-200 shadow-xl bg-slate-950">
      <table className="border-collapse w-full" style={{ minWidth: `${ownerShortsInOrder.length * 120 + 64}px` }}>
        <thead>
          <tr className="bg-slate-900 border-b border-slate-800">
            <th className="sticky left-0 z-20 bg-slate-900 px-4 py-3 text-left text-[10px] font-black text-slate-500 uppercase tracking-widest w-14 border-r border-slate-800">
              Rd
            </th>
            {ownerShortsInOrder.map(short => (
              <th key={short} className="px-2 py-3 text-[9px] font-black text-slate-300 uppercase tracking-tight text-center border-l border-slate-800 min-w-[110px]">
                {getFullTeamName(short)}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rounds.map((round, ri) => (
            <tr key={round} className={`border-t border-slate-800 ${ri % 2 === 0 ? 'bg-slate-950' : 'bg-slate-900/30'}`}>
              <td className="sticky left-0 z-10 px-4 py-3 border-r border-slate-800 bg-inherit">
                <span className="text-2xl font-black italic text-slate-600">{round}</span>
              </td>
              {ownerShortsInOrder.map(short => (
                <td key={short} className="px-1.5 py-1.5 align-top border-l border-slate-800 min-w-[110px]">
                  {renderCell(grid[round][short])}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
