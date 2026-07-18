'use client';

import { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import { useSession } from 'next-auth/react';
import { Loader2, AlertCircle, Link2, X, Search, ChevronUp, ChevronDown } from 'lucide-react';

interface PlayerStat {
  id: number;
  name: string;
  first: string | null;
  last: string | null;
  position: string | null;
  offense: string | null;
  defense: string | null;
  special: string | null;
  isIR: boolean | null;
  espnId: string | null;
  stats: Record<string, number> | null;
}

interface EspnResult {
  espnId: string;
  name: string;
  team: string;
  headshot: string | null;
}

const CURRENT_YEAR = new Date().getFullYear();
const YEARS = [CURRENT_YEAR - 1, CURRENT_YEAR];

function n(stats: Record<string, number> | null, key: string, decimals = 0): string {
  if (!stats || stats[key] === undefined) return '—';
  return stats[key].toFixed(decimals);
}

function pct(stats: Record<string, number> | null, key: string): string {
  if (!stats || stats[key] === undefined) return '—';
  return `${stats[key].toFixed(1)}%`;
}

function PosBadge({ pos }: { pos: string }) {
  const colors: Record<string, string> = {
    QB: 'bg-blue-100 text-blue-800', RB: 'bg-green-100 text-green-800',
    WR: 'bg-purple-100 text-purple-800', TE: 'bg-yellow-100 text-yellow-800',
    OL: 'bg-slate-100 text-slate-600', DL: 'bg-red-100 text-red-800',
    LB: 'bg-orange-100 text-orange-800', DB: 'bg-pink-100 text-pink-800',
    K: 'bg-teal-100 text-teal-800', P: 'bg-cyan-100 text-cyan-800',
  };
  const cls = colors[pos] || 'bg-slate-100 text-slate-600';
  return (
    <span className={`inline-block text-[9px] font-black px-1.5 py-0.5 rounded uppercase ${cls}`}>
      {pos}
    </span>
  );
}

function PlayerName({
  player,
  isCommissioner,
  onLink,
}: {
  player: PlayerStat;
  isCommissioner: boolean;
  onLink: (p: PlayerStat) => void;
}) {
  return (
    <td className="py-2 px-3 text-sm whitespace-nowrap">
      <div className="flex items-center gap-1.5">
        <a
          href={`https://www.google.com/search?q=${encodeURIComponent(player.name + ' NFL')}`}
          target="_blank"
          rel="noopener noreferrer"
          className="font-bold text-slate-800 hover:text-blue-600 transition-colors"
        >
          {player.name}
        </a>
        {player.isIR && (
          <span className="text-[9px] font-black text-red-500 uppercase">IR</span>
        )}
        {!player.espnId && isCommissioner && (
          <button
            onClick={() => onLink(player)}
            title="Link ESPN player"
            className="text-slate-300 hover:text-blue-500 transition-colors"
          >
            <Link2 size={11} />
          </button>
        )}
        {!player.espnId && !isCommissioner && (
          <span className="text-[9px] text-slate-300">(not found)</span>
        )}
      </div>
    </td>
  );
}

type SortState = { key: string; dir: 'asc' | 'desc' };

const DEF_POS_ORDER: Record<string, number> = {
  DL: 0, DE: 0, DT: 0, NT: 0,
  LB: 1, ILB: 1, OLB: 1, MLB: 1,
  DB: 2, CB: 2, S: 2, SS: 2, FS: 2,
};

function defPosRank(p: PlayerStat): number {
  const pos = (p.defense || p.position || '').toUpperCase();
  return DEF_POS_ORDER[pos] ?? 3;
}

function useSortedPlayers(players: PlayerStat[], sort: SortState) {
  return useMemo(() => {
    if (!sort.key) return players;
    return [...players].sort((a, b) => {
      if (sort.key === 'name') {
        const cmp = (a.name || '').localeCompare(b.name || '');
        return sort.dir === 'asc' ? cmp : -cmp;
      }
      if (sort.key === 'defPos') {
        const cmp = defPosRank(a) - defPosRank(b);
        return sort.dir === 'asc' ? cmp : -cmp;
      }
      const va = a.stats?.[sort.key] ?? -Infinity;
      const vb = b.stats?.[sort.key] ?? -Infinity;
      return sort.dir === 'desc' ? vb - va : va - vb;
    });
  }, [players, sort]);
}

function Th({ children, statKey, sort, setSort }: {
  children: React.ReactNode;
  statKey?: string;
  sort?: SortState;
  setSort?: (s: SortState) => void;
}) {
  const active = sort?.key === statKey;
  if (!statKey || !sort || !setSort) {
    return (
      <th className="py-2 px-3 text-[9px] font-black text-slate-400 uppercase tracking-widest text-right whitespace-nowrap">
        {children}
      </th>
    );
  }
  return (
    <th
      className={`py-2 px-3 text-[9px] font-black uppercase tracking-widest text-right whitespace-nowrap cursor-pointer select-none transition-colors ${active ? 'text-blue-600' : 'text-slate-400 hover:text-slate-700'}`}
      onClick={() => setSort({ key: statKey, dir: active && sort.dir === 'desc' ? 'asc' : 'desc' })}
    >
      <span className="inline-flex items-center gap-0.5 justify-end">
        {children}
        {active ? (sort.dir === 'desc' ? <ChevronDown size={10} /> : <ChevronUp size={10} />) : <ChevronDown size={10} className="opacity-20" />}
      </span>
    </th>
  );
}

function ThL({ children, statKey, sort, setSort }: {
  children: React.ReactNode;
  statKey?: string;
  sort?: SortState;
  setSort?: (s: SortState) => void;
}) {
  const active = sort?.key === statKey;
  if (!statKey || !sort || !setSort) {
    return (
      <th className="py-2 px-3 text-[9px] font-black text-slate-400 uppercase tracking-widest text-left whitespace-nowrap">
        {children}
      </th>
    );
  }
  return (
    <th
      className={`py-2 px-3 text-[9px] font-black uppercase tracking-widest text-left whitespace-nowrap cursor-pointer select-none transition-colors ${active ? 'text-blue-600' : 'text-slate-400 hover:text-slate-700'}`}
      onClick={() => setSort({ key: statKey, dir: active && sort.dir === 'desc' ? 'asc' : 'desc' })}
    >
      <span className="inline-flex items-center gap-0.5">
        {children}
        {active ? (sort.dir === 'desc' ? <ChevronDown size={10} /> : <ChevronUp size={10} />) : <ChevronDown size={10} className="opacity-20" />}
      </span>
    </th>
  );
}

function Td({ v }: { v: string }) {
  const dim = v === '—';
  return (
    <td className={`py-2 px-3 text-sm text-right tabular-nums ${dim ? 'text-slate-300' : 'text-slate-700 font-semibold'}`}>
      {v}
    </td>
  );
}

function SectionHeader({ title }: { title: string }) {
  return (
    <div className="mt-8 mb-2 px-1">
      <span className="text-[10px] font-black uppercase tracking-widest text-slate-400">{title}</span>
    </div>
  );
}

function TableWrap({ children }: { children: React.ReactNode }) {
  return (
    <div className="overflow-x-auto rounded-2xl border border-slate-200 bg-white shadow-sm">
      <table className="w-full text-left border-collapse">{children}</table>
    </div>
  );
}

interface TableProps {
  players: PlayerStat[];
  isCommissioner: boolean;
  onLink: (p: PlayerStat) => void;
}

function QbTable({ players, isCommissioner, onLink }: TableProps) {
  const [sort, setSort] = useState<SortState>({ key: 'passingYards', dir: 'desc' });
  const sorted = useSortedPlayers(players, sort);
  if (!players.length) return null;
  const s = { sort, setSort };
  return (
    <>
      <SectionHeader title="Quarterbacks" />
      <TableWrap>
        <thead className="border-b border-slate-100 bg-slate-50">
          <tr>
            <ThL statKey="name" {...s}>Player</ThL><ThL>Pos</ThL>
            <Th statKey="gamesPlayed" {...s}>GP</Th>
            <Th statKey="completions" {...s}>Cmp</Th>
            <Th statKey="passingAttempts" {...s}>Att</Th>
            <Th statKey="completionPct" {...s}>Cmp%</Th>
            <Th statKey="passingYards" {...s}>Pass Yds</Th>
            <Th statKey="passingTouchdowns" {...s}>Pass TD</Th>
            <Th statKey="interceptions" {...s}>INT</Th>
            <Th statKey="sacks" {...s}>Sacks</Th>
            <Th statKey="rushingAttempts" {...s}>Rush Att</Th>
            <Th statKey="rushingYards" {...s}>Rush Yds</Th>
            <Th statKey="rushingTouchdowns" {...s}>Rush TD</Th>
            <Th statKey="fumblesLost" {...s}>FL</Th>
          </tr>
        </thead>
        <tbody>
          {sorted.map((p) => (
            <tr key={p.id} className="border-b border-slate-50 hover:bg-slate-50 transition-colors">
              <PlayerName player={p} isCommissioner={isCommissioner} onLink={onLink} />
              <td className="py-2 px-3"><PosBadge pos={p.offense || p.position || 'QB'} /></td>
              <Td v={n(p.stats, 'gamesPlayed')} />
              <Td v={n(p.stats, 'completions')} />
              <Td v={n(p.stats, 'passingAttempts')} />
              <Td v={pct(p.stats, 'completionPct')} />
              <Td v={n(p.stats, 'passingYards')} />
              <Td v={n(p.stats, 'passingTouchdowns')} />
              <Td v={n(p.stats, 'interceptions')} />
              <Td v={n(p.stats, 'sacks')} />
              <Td v={n(p.stats, 'rushingAttempts')} />
              <Td v={n(p.stats, 'rushingYards')} />
              <Td v={n(p.stats, 'rushingTouchdowns')} />
              <Td v={n(p.stats, 'fumblesLost')} />
            </tr>
          ))}
        </tbody>
      </TableWrap>
    </>
  );
}

function RbTable({ players, isCommissioner, onLink }: TableProps) {
  const [sort, setSort] = useState<SortState>({ key: 'rushingYards', dir: 'desc' });
  const sorted = useSortedPlayers(players, sort);
  if (!players.length) return null;
  const s = { sort, setSort };
  return (
    <>
      <SectionHeader title="Running Backs" />
      <TableWrap>
        <thead className="border-b border-slate-100 bg-slate-50">
          <tr>
            <ThL statKey="name" {...s}>Player</ThL><ThL>Pos</ThL>
            <Th statKey="gamesPlayed" {...s}>GP</Th>
            <Th statKey="rushingAttempts" {...s}>Rush Att</Th>
            <Th statKey="rushingYards" {...s}>Rush Yds</Th>
            <Th statKey="yardsPerRushAttempt" {...s}>YPC</Th>
            <Th statKey="rushingTouchdowns" {...s}>Rush TD</Th>
            <Th statKey="receptions" {...s}>Rec</Th>
            <Th statKey="receivingYards" {...s}>Rec Yds</Th>
            <Th statKey="receivingTouchdowns" {...s}>Rec TD</Th>
            <Th statKey="fumblesLost" {...s}>FL</Th>
          </tr>
        </thead>
        <tbody>
          {sorted.map((p) => (
            <tr key={p.id} className="border-b border-slate-50 hover:bg-slate-50 transition-colors">
              <PlayerName player={p} isCommissioner={isCommissioner} onLink={onLink} />
              <td className="py-2 px-3"><PosBadge pos={p.offense || p.position || 'RB'} /></td>
              <Td v={n(p.stats, 'gamesPlayed')} />
              <Td v={n(p.stats, 'rushingAttempts')} />
              <Td v={n(p.stats, 'rushingYards')} />
              <Td v={n(p.stats, 'yardsPerRushAttempt', 1)} />
              <Td v={n(p.stats, 'rushingTouchdowns')} />
              <Td v={n(p.stats, 'receptions')} />
              <Td v={n(p.stats, 'receivingYards')} />
              <Td v={n(p.stats, 'receivingTouchdowns')} />
              <Td v={n(p.stats, 'fumblesLost')} />
            </tr>
          ))}
        </tbody>
      </TableWrap>
    </>
  );
}

function WrTeTable({ players, label, isCommissioner, onLink }: TableProps & { label: string }) {
  const [sort, setSort] = useState<SortState>({ key: 'receivingYards', dir: 'desc' });
  const sorted = useSortedPlayers(players, sort);
  if (!players.length) return null;
  const s = { sort, setSort };
  return (
    <>
      <SectionHeader title={label} />
      <TableWrap>
        <thead className="border-b border-slate-100 bg-slate-50">
          <tr>
            <ThL statKey="name" {...s}>Player</ThL><ThL>Pos</ThL>
            <Th statKey="gamesPlayed" {...s}>GP</Th>
            <Th statKey="receivingTargets" {...s}>Tgt</Th>
            <Th statKey="receptions" {...s}>Rec</Th>
            <Th statKey="receivingYards" {...s}>Rec Yds</Th>
            <Th statKey="yardsPerReception" {...s}>YPR</Th>
            <Th statKey="receivingTouchdowns" {...s}>Rec TD</Th>
            <Th statKey="rushingAttempts" {...s}>Rush Att</Th>
            <Th statKey="rushingYards" {...s}>Rush Yds</Th>
            <Th statKey="fumblesLost" {...s}>FL</Th>
          </tr>
        </thead>
        <tbody>
          {sorted.map((p) => (
            <tr key={p.id} className="border-b border-slate-50 hover:bg-slate-50 transition-colors">
              <PlayerName player={p} isCommissioner={isCommissioner} onLink={onLink} />
              <td className="py-2 px-3"><PosBadge pos={p.offense || p.position || 'WR'} /></td>
              <Td v={n(p.stats, 'gamesPlayed')} />
              <Td v={n(p.stats, 'receivingTargets')} />
              <Td v={n(p.stats, 'receptions')} />
              <Td v={n(p.stats, 'receivingYards')} />
              <Td v={n(p.stats, 'yardsPerReception', 1)} />
              <Td v={n(p.stats, 'receivingTouchdowns')} />
              <Td v={n(p.stats, 'rushingAttempts')} />
              <Td v={n(p.stats, 'rushingYards')} />
              <Td v={n(p.stats, 'fumblesLost')} />
            </tr>
          ))}
        </tbody>
      </TableWrap>
    </>
  );
}

function DefTable({ players, isCommissioner, onLink }: TableProps) {
  const [sort, setSort] = useState<SortState>({ key: 'defPos', dir: 'asc' });
  const sorted = useSortedPlayers(players, sort);
  if (!players.length) return null;
  const s = { sort, setSort };
  return (
    <>
      <SectionHeader title="Defense" />
      <TableWrap>
        <thead className="border-b border-slate-100 bg-slate-50">
          <tr>
            <ThL statKey="name" {...s}>Player</ThL>
            <ThL statKey="defPos" {...s}>Pos</ThL>
            <Th statKey="gamesPlayed" {...s}>GP</Th>
            <Th statKey="totalTackles" {...s}>Tackles</Th>
            <Th statKey="soloTackles" {...s}>Solo</Th>
            <Th statKey="assistedTackles" {...s}>Ast</Th>
            <Th statKey="tacklesForLoss" {...s}>TFL</Th>
            <Th statKey="sacks" {...s}>Sacks</Th>
            <Th statKey="interceptions" {...s}>INT</Th>
            <Th statKey="passesDefended" {...s}>PD</Th>
            <Th statKey="forcedFumbles" {...s}>FF</Th>
            <Th statKey="fumbleRecoveries" {...s}>FR</Th>
          </tr>
        </thead>
        <tbody>
          {sorted.map((p) => (
            <tr key={p.id} className="border-b border-slate-50 hover:bg-slate-50 transition-colors">
              <PlayerName player={p} isCommissioner={isCommissioner} onLink={onLink} />
              <td className="py-2 px-3"><PosBadge pos={p.defense || p.position || 'DEF'} /></td>
              <Td v={n(p.stats, 'gamesPlayed')} />
              <Td v={n(p.stats, 'totalTackles')} />
              <Td v={n(p.stats, 'soloTackles')} />
              <Td v={n(p.stats, 'assistedTackles')} />
              <Td v={n(p.stats, 'tacklesForLoss', 1)} />
              <Td v={n(p.stats, 'sacks', 1)} />
              <Td v={n(p.stats, 'interceptions')} />
              <Td v={n(p.stats, 'passesDefended')} />
              <Td v={n(p.stats, 'forcedFumbles')} />
              <Td v={n(p.stats, 'fumbleRecoveries')} />
            </tr>
          ))}
        </tbody>
      </TableWrap>
    </>
  );
}

function OlTable({ players, isCommissioner, onLink }: TableProps) {
  const [sort, setSort] = useState<SortState>({ key: 'gamesPlayed', dir: 'desc' });
  const sorted = useSortedPlayers(players, sort);
  if (!players.length) return null;
  const s = { sort, setSort };
  return (
    <>
      <SectionHeader title="Offensive Line" />
      <div className="overflow-x-auto rounded-2xl border border-slate-200 bg-white shadow-sm inline-block min-w-[320px]">
        <table className="text-left border-collapse">
          <thead className="border-b border-slate-100 bg-slate-50">
            <tr>
              <ThL statKey="name" {...s}>Player</ThL><ThL>Pos</ThL>
              <Th statKey="gamesPlayed" {...s}>GP</Th>
            </tr>
          </thead>
          <tbody>
            {sorted.map((p) => (
              <tr key={p.id} className="border-b border-slate-50 hover:bg-slate-50 transition-colors">
                <PlayerName player={p} isCommissioner={isCommissioner} onLink={onLink} />
                <td className="py-2 px-3"><PosBadge pos={p.offense || p.position || 'OL'} /></td>
                <Td v={n(p.stats, 'gamesPlayed')} />
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </>
  );
}

function KickerTable({ players, isCommissioner, onLink }: TableProps) {
  const [sort, setSort] = useState<SortState>({ key: 'fieldGoalsMade', dir: 'desc' });
  const sorted = useSortedPlayers(players, sort);
  if (!players.length) return null;
  const s = { sort, setSort };
  return (
    <>
      <SectionHeader title="Kickers" />
      <TableWrap>
        <thead className="border-b border-slate-100 bg-slate-50">
          <tr>
            <ThL statKey="name" {...s}>Player</ThL><ThL>Pos</ThL>
            <Th statKey="gamesPlayed" {...s}>GP</Th>
            <Th statKey="fieldGoalsMade" {...s}>FGM</Th>
            <Th statKey="fieldGoalAttempts" {...s}>FGA</Th>
            <Th statKey="fieldGoalPct" {...s}>FG%</Th>
            <Th statKey="longFieldGoal" {...s}>Long</Th>
            <Th statKey="extraPointsMade" {...s}>XPM</Th>
            <Th statKey="extraPointAttempts" {...s}>XPA</Th>
            <Th statKey="extraPointPct" {...s}>XP%</Th>
          </tr>
        </thead>
        <tbody>
          {sorted.map((p) => (
            <tr key={p.id} className="border-b border-slate-50 hover:bg-slate-50 transition-colors">
              <PlayerName player={p} isCommissioner={isCommissioner} onLink={onLink} />
              <td className="py-2 px-3"><PosBadge pos="K" /></td>
              <Td v={n(p.stats, 'gamesPlayed')} />
              <Td v={n(p.stats, 'fieldGoalsMade')} />
              <Td v={n(p.stats, 'fieldGoalAttempts')} />
              <Td v={pct(p.stats, 'fieldGoalPct')} />
              <Td v={n(p.stats, 'longFieldGoal')} />
              <Td v={n(p.stats, 'extraPointsMade')} />
              <Td v={n(p.stats, 'extraPointAttempts')} />
              <Td v={pct(p.stats, 'extraPointPct')} />
            </tr>
          ))}
        </tbody>
      </TableWrap>
    </>
  );
}

function PunterTable({ players, isCommissioner, onLink }: TableProps) {
  const [sort, setSort] = useState<SortState>({ key: 'punts', dir: 'desc' });
  const sorted = useSortedPlayers(players, sort);
  if (!players.length) return null;
  const s = { sort, setSort };
  return (
    <>
      <SectionHeader title="Punters" />
      <TableWrap>
        <thead className="border-b border-slate-100 bg-slate-50">
          <tr>
            <ThL statKey="name" {...s}>Player</ThL><ThL>Pos</ThL>
            <Th statKey="gamesPlayed" {...s}>GP</Th>
            <Th statKey="punts" {...s}>Punts</Th>
            <Th statKey="grossAvgPuntYards" {...s}>Avg</Th>
            <Th statKey="netAvgPuntYards" {...s}>Net Avg</Th>
            <Th statKey="longPunt" {...s}>Long</Th>
            <Th statKey="puntsInsideTwenty" {...s}>In 20</Th>
            <Th statKey="touchbacks" {...s}>TB</Th>
          </tr>
        </thead>
        <tbody>
          {sorted.map((p) => (
            <tr key={p.id} className="border-b border-slate-50 hover:bg-slate-50 transition-colors">
              <PlayerName player={p} isCommissioner={isCommissioner} onLink={onLink} />
              <td className="py-2 px-3"><PosBadge pos="P" /></td>
              <Td v={n(p.stats, 'gamesPlayed')} />
              <Td v={n(p.stats, 'punts')} />
              <Td v={n(p.stats, 'grossAvgPuntYards', 1)} />
              <Td v={n(p.stats, 'netAvgPuntYards', 1)} />
              <Td v={n(p.stats, 'longPunt')} />
              <Td v={n(p.stats, 'puntsInsideTwenty')} />
              <Td v={n(p.stats, 'touchbacks')} />
            </tr>
          ))}
        </tbody>
      </TableWrap>
    </>
  );
}

function posGroup(p: PlayerStat): string {
  const pos = (p.offense || p.defense || p.special || p.position || '').toUpperCase();
  if (pos === 'QB') return 'QB';
  if (['RB', 'HB', 'FB'].includes(pos)) return 'RB';
  if (pos === 'WR') return 'WR';
  if (pos === 'TE') return 'TE';
  if (['OL', 'OT', 'OG', 'C', 'G', 'T'].includes(pos)) return 'OL';
  if (['DL', 'DE', 'DT', 'NT'].includes(pos)) return 'DL';
  if (['LB', 'ILB', 'OLB', 'MLB'].includes(pos)) return 'LB';
  if (['DB', 'CB', 'S', 'SS', 'FS'].includes(pos)) return 'DB';
  if (pos === 'K') return 'K';
  if (pos === 'P') return 'P';
  return 'OTHER';
}

// Commissioner modal: search ESPN and link a player
function LinkModal({
  player,
  onClose,
  onLinked,
}: {
  player: PlayerStat;
  onClose: () => void;
  onLinked: (playerId: number, espnId: string) => void;
}) {
  const [query, setQuery] = useState(`${player.first || ''} ${player.last || ''}`.trim());
  const [results, setResults] = useState<EspnResult[]>([]);
  const [searching, setSearching] = useState(false);
  const [saving, setSaving] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    inputRef.current?.focus();
    inputRef.current?.select();
  }, []);

  const search = useCallback(async () => {
    if (!query.trim()) return;
    setSearching(true);
    try {
      const r = await fetch(`/api/espn-search?q=${encodeURIComponent(query)}`);
      const d = await r.json();
      setResults(d.results || []);
    } finally {
      setSearching(false);
    }
  }, [query]);

  // Auto-search on open
  useEffect(() => { search(); }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const link = async (result: EspnResult) => {
    setSaving(result.espnId);
    try {
      const res = await fetch(`/api/players/${player.id}/espn-id`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ espnId: result.espnId }),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        alert((err as { error?: string }).error || 'Failed to link player');
        return;
      }
      onLinked(player.id, result.espnId);
      onClose();
    } finally {
      setSaving(null);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4" onClick={onClose}>
      <div
        className="bg-white rounded-3xl shadow-2xl w-full max-w-md p-6"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between mb-4">
          <div>
            <h3 className="font-black text-slate-900 uppercase tracking-tight">Link ESPN Player</h3>
            <p className="text-xs text-slate-400 mt-0.5">{player.name}</p>
          </div>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-700">
            <X size={18} />
          </button>
        </div>

        <div className="flex gap-2 mb-4">
          <div className="relative flex-1">
            <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
            <input
              ref={inputRef}
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && search()}
              placeholder="Player name..."
              className="w-full pl-8 pr-3 py-2 text-sm border border-slate-200 rounded-xl focus:ring-2 focus:ring-blue-500 outline-none"
            />
          </div>
          <button
            onClick={search}
            disabled={searching}
            className="px-4 py-2 bg-slate-900 text-white text-xs font-black uppercase rounded-xl hover:bg-slate-700 transition-colors disabled:opacity-50"
          >
            {searching ? <Loader2 size={14} className="animate-spin" /> : 'Search'}
          </button>
        </div>

        <div className="space-y-1.5 max-h-64 overflow-y-auto">
          {results.length === 0 && !searching && (
            <p className="text-center text-xs text-slate-400 py-6">No results</p>
          )}
          {results.map((r) => (
            <button
              key={r.espnId}
              onClick={() => link(r)}
              disabled={saving === r.espnId}
              className="w-full flex items-center gap-3 p-3 rounded-xl hover:bg-blue-50 transition-colors text-left border border-transparent hover:border-blue-200"
            >
              {r.headshot && (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={r.headshot} alt={r.name} className="w-8 h-8 rounded-full object-cover bg-slate-100" />
              )}
              <div className="flex-1 min-w-0">
                <p className="font-bold text-slate-900 text-sm truncate">{r.name}</p>
                <p className="text-xs text-slate-400 truncate">{r.team}</p>
              </div>
              {saving === r.espnId && <Loader2 size={14} className="animate-spin text-blue-500" />}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}

interface Props {
  teamshort: string;
}

export default function NflStatsTab({ teamshort }: Props) {
  const { data: session } = useSession();
  const role = (session?.user as { role?: string } | undefined)?.role || '';
  const isCommissioner = role === 'admin' || role === 'superuser';

  const [year, setYear] = useState(CURRENT_YEAR - 1);
  const [data, setData] = useState<PlayerStat[] | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [linking, setLinking] = useState<PlayerStat | null>(null);

  const loadStats = useCallback(async () => {
    if (!teamshort) return;
    setLoading(true);
    setError(null);
    setData(null);
    try {
      const r = await fetch(`/api/nfl-stats?team=${encodeURIComponent(teamshort)}&year=${year}`);
      if (!r.ok) throw new Error('Failed to load stats');
      setData(await r.json());
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setLoading(false);
    }
  }, [teamshort, year]);

  useEffect(() => {
    loadStats();
  }, [loadStats]);

  // After a successful link, update the local data so the link icon disappears
  const handleLinked = useCallback((playerId: number, espnId: string) => {
    setData((prev) =>
      prev ? prev.map((p) => (p.id === playerId ? { ...p, espnId } : p)) : prev,
    );
  }, []);

  const groups = useMemo(() => data
    ? {
        QB: data.filter((p) => posGroup(p) === 'QB'),
        RB: data.filter((p) => posGroup(p) === 'RB'),
        WR: data.filter((p) => posGroup(p) === 'WR'),
        TE: data.filter((p) => posGroup(p) === 'TE'),
        OL: data.filter((p) => posGroup(p) === 'OL'),
        DEF: data.filter((p) => ['DL', 'LB', 'DB'].includes(posGroup(p))),
        K: data.filter((p) => posGroup(p) === 'K'),
        P: data.filter((p) => posGroup(p) === 'P'),
      }
    : null, [data]);

  const notFound = data?.filter((p) => !p.espnId && posGroup(p) !== 'OL').length ?? 0;

  return (
    <div>
      {linking && (
        <LinkModal
          player={linking}
          onClose={() => setLinking(null)}
          onLinked={handleLinked}
        />
      )}

      {/* Year picker */}
      <div className="flex items-center gap-2 mb-6">
        <span className="text-xs font-black uppercase text-slate-400 tracking-widest">Season</span>
        <div className="flex bg-white p-1 rounded-xl shadow-sm border border-slate-200">
          {YEARS.map((y) => (
            <button
              key={y}
              onClick={() => setYear(y)}
              className={`px-5 py-2 rounded-lg text-[10px] font-black uppercase transition-all ${
                year === y ? 'bg-slate-900 text-white shadow' : 'text-slate-400 hover:text-slate-900'
              }`}
            >
              {y}
            </button>
          ))}
        </div>
        {loading && <Loader2 size={14} className="animate-spin text-slate-400" />}
      </div>

      {error && (
        <div className="flex items-center gap-2 text-red-500 text-sm font-bold p-4 bg-red-50 rounded-2xl">
          <AlertCircle size={16} /> {error}
        </div>
      )}

      {loading && (
        <div className="py-16 text-center">
          <Loader2 size={24} className="animate-spin text-slate-400 mx-auto mb-2" />
          <p className="text-xs font-black uppercase text-slate-400 tracking-widest">
            Fetching {year} NFL stats from ESPN...
          </p>
          <p className="text-xs text-slate-300 mt-1">First load may take a few seconds</p>
        </div>
      )}

      {groups && !loading && (
        <>
          {notFound > 0 && (
            <p className="text-xs text-slate-400 mb-4">
              {notFound} player{notFound > 1 ? 's' : ''} could not be matched on ESPN.
              {isCommissioner && ' Click the '}
              {isCommissioner && <Link2 size={10} className="inline" />}
              {isCommissioner && ' icon next to a player name to link them manually.'}
            </p>
          )}
          <QbTable players={groups.QB} isCommissioner={isCommissioner} onLink={setLinking} />
          <RbTable players={groups.RB} isCommissioner={isCommissioner} onLink={setLinking} />
          <WrTeTable players={groups.WR} label="Wide Receivers" isCommissioner={isCommissioner} onLink={setLinking} />
          <WrTeTable players={groups.TE} label="Tight Ends" isCommissioner={isCommissioner} onLink={setLinking} />
          <OlTable players={groups.OL} isCommissioner={isCommissioner} onLink={setLinking} />
          <DefTable players={groups.DEF} isCommissioner={isCommissioner} onLink={setLinking} />
          <KickerTable players={groups.K} isCommissioner={isCommissioner} onLink={setLinking} />
          <PunterTable players={groups.P} isCommissioner={isCommissioner} onLink={setLinking} />
          {!data?.length && (
            <p className="text-slate-400 text-sm py-8 text-center">No players on roster.</p>
          )}
        </>
      )}
    </div>
  );
}
