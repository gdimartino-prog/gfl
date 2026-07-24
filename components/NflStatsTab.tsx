'use client';

import { useState, useEffect, useCallback, useRef, useMemo, createContext, useContext } from 'react';
import { useSession } from 'next-auth/react';
import { Loader2, AlertCircle, Link2, X, Search, ChevronUp, ChevronDown, ChevronRight, Newspaper } from 'lucide-react';
import { posGroup as libPosGroup, powerScore as libPowerScore } from '@/lib/power-score';

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
  nflTeam: string | null;
  stats: Record<string, number> | null;
}

interface TeamRanking {
  teamshort: string;
  teamName: string;
  playerCount: number;
  offenseScore: number;
  defenseScore: number;
  totalScore: number;
  byGroup: Record<string, number>;
}

interface LeaguePlayer {
  id: number;
  name: string;
  espnId: string | null;
  nflTeam?: string | null;
  age?: number | null;
  teamshort: string;
  teamName: string;
  posGroup: string;
  score: number;
}

const NewsContext = createContext<Set<string>>(new Set());

interface EspnResult {
  espnId: string;
  name: string;
  team: string;
  headshot: string | null;
}

const CURRENT_YEAR = new Date().getFullYear();
const YEARS = [CURRENT_YEAR - 1, CURRENT_YEAR];
// Default to current year during NFL season (Sep–Jan), prior year in offseason
const month = new Date().getMonth() + 1; // 1-based
const DEFAULT_YEAR = month >= 9 || month === 1 ? CURRENT_YEAR : CURRENT_YEAR - 1;

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
  const newsIds = useContext(NewsContext);
  return (
    <td className="py-2 px-3 text-sm whitespace-nowrap">
      <div className="flex items-center gap-1.5">
        {player.espnId && (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={`https://a.espncdn.com/i/headshots/nfl/players/full/${player.espnId}.png`}
            alt={player.name}
            className="w-7 h-7 rounded-full object-cover bg-slate-100 flex-shrink-0"
            onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; }}
          />
        )}
        <div>
          <div className="flex items-center gap-1">
            <a
              href={`https://www.google.com/search?q=${encodeURIComponent(player.name + ' NFL')}`}
              target="_blank"
              rel="noopener noreferrer"
              className="font-bold text-slate-800 hover:text-blue-600 transition-colors"
            >
              {player.name}
            </a>
            {player.espnId && newsIds.has(player.espnId) && (
              <a
                href={`https://www.espn.com/nfl/player/news/_/id/${player.espnId}`}
                target="_blank"
                rel="noopener noreferrer"
                title="Recent ESPN news"
                className="text-orange-400 hover:text-orange-600 transition-colors"
              >
                <Newspaper size={11} />
              </a>
            )}
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
          {player.nflTeam && (
            <div className="text-[10px] text-slate-400">{player.nflTeam}</div>
          )}
        </div>
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

const POS_GROUPS_ORDER = ['QB', 'RB', 'WR', 'TE', 'OL', 'DL', 'LB', 'DB', 'K', 'P'];

function defPosRank(p: PlayerStat): number {
  const pos = (p.defense || p.position || '').toUpperCase();
  return DEF_POS_ORDER[pos] ?? 3;
}

function posGroup(p: PlayerStat): string {
  return libPosGroup(p.offense, p.defense, p.special, p.position);
}

function computePowerScore(p: PlayerStat): number {
  return libPowerScore(p.offense, p.defense, p.special, p.position, p.stats);
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
      if (sort.key === 'powerScore') {
        const cmp = computePowerScore(a) - computePowerScore(b);
        return sort.dir === 'desc' ? -cmp : cmp;
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

function scoreCell(p: PlayerStat): string {
  if (p.stats === null) return '—';
  return computePowerScore(p).toFixed(1);
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
            <Th statKey="powerScore" {...s}>Score</Th>
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
              <Td v={scoreCell(p)} />
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
            <Th statKey="powerScore" {...s}>Score</Th>
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
              <Td v={scoreCell(p)} />
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
            <Th statKey="powerScore" {...s}>Score</Th>
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
              <Td v={scoreCell(p)} />
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
            <Th statKey="powerScore" {...s}>Score</Th>
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
              <Td v={scoreCell(p)} />
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
              <Th statKey="powerScore" {...s}>Score</Th>
            </tr>
          </thead>
          <tbody>
            {sorted.map((p) => (
              <tr key={p.id} className="border-b border-slate-50 hover:bg-slate-50 transition-colors">
                <PlayerName player={p} isCommissioner={isCommissioner} onLink={onLink} />
                <td className="py-2 px-3"><PosBadge pos={p.offense || p.position || 'OL'} /></td>
                <Td v={n(p.stats, 'gamesPlayed')} />
                <Td v={scoreCell(p)} />
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
            <Th statKey="powerScore" {...s}>Score</Th>
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
              <Td v={scoreCell(p)} />
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

function LeagueRankingsTable({ data, currentTeamshort }: { data: TeamRanking[]; currentTeamshort: string }) {
  const [sort, setSort] = useState<SortState>({ key: 'totalScore', dir: 'desc' });
  const [expandedTeams, setExpandedTeams] = useState<Set<string>>(new Set());

  const sorted = useMemo(() => {
    return [...data].sort((a, b) => {
      const va = a[sort.key as keyof TeamRanking];
      const vb = b[sort.key as keyof TeamRanking];
      if (typeof va === 'string' && typeof vb === 'string') {
        const cmp = va.localeCompare(vb);
        return sort.dir === 'asc' ? cmp : -cmp;
      }
      if (typeof va === 'number' && typeof vb === 'number') {
        return sort.dir === 'desc' ? vb - va : va - vb;
      }
      return 0;
    });
  }, [data, sort]);

  const leaders = useMemo(() => {
    if (!data.length) return { off: '', def: '', total: '' };
    const maxOff = Math.max(...data.map(t => t.offenseScore));
    const maxDef = Math.max(...data.map(t => t.defenseScore));
    const maxTotal = Math.max(...data.map(t => t.totalScore));
    return {
      off: data.find(t => t.offenseScore === maxOff)?.teamshort ?? '',
      def: data.find(t => t.defenseScore === maxDef)?.teamshort ?? '',
      total: data.find(t => t.totalScore === maxTotal)?.teamshort ?? '',
    };
  }, [data]);

  const toggleExpand = (ts: string) => {
    setExpandedTeams(prev => {
      const next = new Set(prev);
      if (next.has(ts)) next.delete(ts);
      else next.add(ts);
      return next;
    });
  };

  const s = { sort, setSort };

  return (
    <TableWrap>
      <thead className="border-b border-slate-100 bg-slate-50">
        <tr>
          <ThL>Rank</ThL>
          <ThL statKey="teamName" {...s}>Team</ThL>
          <Th statKey="playerCount" {...s}>Players</Th>
          <Th statKey="offenseScore" {...s}>Off Score</Th>
          <Th statKey="defenseScore" {...s}>Def Score</Th>
          <Th statKey="totalScore" {...s}>Total</Th>
        </tr>
      </thead>
      <tbody>
        {sorted.flatMap((team, i) => {
          const isCurrentTeam = team.teamshort.toUpperCase() === currentTeamshort.toUpperCase();
          const ts = team.teamshort;
          const isExpanded = expandedTeams.has(ts);
          const hasBreakdown = Object.keys(team.byGroup ?? {}).length > 0;
          const rows = [
            <tr
              key={ts}
              className={`border-b border-slate-50 transition-colors ${isCurrentTeam ? 'bg-blue-50' : 'hover:bg-slate-50'} ${hasBreakdown ? 'cursor-pointer' : ''}`}
              onClick={() => hasBreakdown && toggleExpand(ts)}
            >
              <td className="py-2 px-3 text-sm font-bold text-slate-500 tabular-nums">{i + 1}</td>
              <td className="py-2 px-3 text-sm whitespace-nowrap">
                <div className="flex items-center gap-1.5">
                  {hasBreakdown && (
                    <span className="text-slate-400 flex-shrink-0">
                      {isExpanded ? <ChevronDown size={12} /> : <ChevronRight size={12} />}
                    </span>
                  )}
                  <span className="font-bold text-slate-800">{team.teamName}</span>
                  {ts === leaders.total && <span title="Best Total">🏆</span>}
                  {ts !== leaders.total && ts === leaders.off && <span title="Best Offense">⚔️</span>}
                  {ts !== leaders.total && ts === leaders.def && <span title="Best Defense">🛡️</span>}
                  {isCurrentTeam && (
                    <span className="text-[9px] font-black text-blue-600 uppercase">You</span>
                  )}
                </div>
                <div className="text-[10px] text-slate-400">{ts}</div>
              </td>
              <Td v={String(team.playerCount)} />
              <td className={`py-2 px-3 text-sm text-right tabular-nums font-semibold ${ts === leaders.off ? 'text-orange-600' : 'text-slate-700'}`}>
                {team.offenseScore.toFixed(1)}
              </td>
              <td className={`py-2 px-3 text-sm text-right tabular-nums font-semibold ${ts === leaders.def ? 'text-blue-600' : 'text-slate-700'}`}>
                {team.defenseScore.toFixed(1)}
              </td>
              <td className={`py-2 px-3 text-sm text-right tabular-nums font-semibold ${ts === leaders.total ? 'text-emerald-600' : 'text-slate-700'}`}>
                {team.totalScore.toFixed(1)}
              </td>
            </tr>,
          ];
          if (isExpanded && hasBreakdown) {
            rows.push(
              <tr key={`${ts}-breakdown`} className={`border-b border-slate-100 ${isCurrentTeam ? 'bg-blue-50/50' : 'bg-slate-50/60'}`}>
                <td colSpan={6} className="px-8 py-3">
                  <div className="flex flex-wrap gap-3">
                    {POS_GROUPS_ORDER.filter(g => (team.byGroup[g] ?? 0) > 0).map(g => (
                      <div key={g} className="flex items-center gap-1.5">
                        <PosBadge pos={g} />
                        <span className="text-xs font-semibold text-slate-700">{(team.byGroup[g] ?? 0).toFixed(1)}</span>
                      </div>
                    ))}
                  </div>
                </td>
              </tr>,
            );
          }
          return rows;
        })}
      </tbody>
    </TableWrap>
  );
}

function LeaguePlayersTable({ data }: { data: LeaguePlayer[] }) {
  const newsIds = useContext(NewsContext);
  const [filterGroup, setFilterGroup] = useState<string | null>(null);
  const [sort, setSort] = useState<SortState>({ key: 'score', dir: 'desc' });

  const availableGroups = useMemo(() => {
    const seen = new Set<string>();
    data.forEach(p => seen.add(p.posGroup));
    return POS_GROUPS_ORDER.filter(g => seen.has(g));
  }, [data]);

  const filtered = useMemo(() => {
    const list = filterGroup ? data.filter(p => p.posGroup === filterGroup) : data;
    return [...list].sort((a, b) => {
      if (sort.key === 'name') {
        const cmp = a.name.localeCompare(b.name);
        return sort.dir === 'asc' ? cmp : -cmp;
      }
      if (sort.key === 'posGroup') {
        const ca = POS_GROUPS_ORDER.indexOf(a.posGroup);
        const cb = POS_GROUPS_ORDER.indexOf(b.posGroup);
        return sort.dir === 'asc' ? ca - cb : cb - ca;
      }
      return sort.dir === 'desc' ? b.score - a.score : a.score - b.score;
    });
  }, [data, filterGroup, sort]);

  const s = { sort, setSort };

  return (
    <div>
      <div className="flex flex-wrap gap-1.5 mb-4">
        <button
          onClick={() => setFilterGroup(null)}
          className={`px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-widest transition-colors ${filterGroup === null ? 'bg-slate-900 text-white' : 'bg-white text-slate-500 border border-slate-200 hover:bg-slate-50'}`}
        >
          All
        </button>
        {availableGroups.map(g => (
          <button
            key={g}
            onClick={() => setFilterGroup(filterGroup === g ? null : g)}
            className={`px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-widest transition-colors ${filterGroup === g ? 'bg-slate-900 text-white' : 'bg-white text-slate-500 border border-slate-200 hover:bg-slate-50'}`}
          >
            {g}
          </button>
        ))}
      </div>
      <TableWrap>
        <thead className="border-b border-slate-100 bg-slate-50">
          <tr>
            <ThL>Rank</ThL>
            <ThL statKey="name" {...s}>Player</ThL>
            <ThL statKey="posGroup" {...s}>Pos</ThL>
            <ThL>GFL Team</ThL>
            <ThL>NFL Team</ThL>
            <Th>Age</Th>
            <Th statKey="score" {...s}>Score</Th>
          </tr>
        </thead>
        <tbody>
          {filtered.map((p, i) => (
            <tr key={p.id} className="border-b border-slate-50 hover:bg-slate-50 transition-colors">
              <td className="py-2 px-3 text-sm font-bold text-slate-500 tabular-nums">{i + 1}</td>
              <td className="py-2 px-3 text-sm whitespace-nowrap">
                <div className="flex items-center gap-1.5">
                  {p.espnId && (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={`https://a.espncdn.com/i/headshots/nfl/players/full/${p.espnId}.png`}
                      alt={p.name}
                      className="w-7 h-7 rounded-full object-cover bg-slate-100 flex-shrink-0"
                      onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; }}
                    />
                  )}
                  <div>
                    <div className="flex items-center gap-1">
                      <a
                        href={`https://www.google.com/search?q=${encodeURIComponent(p.name + ' NFL')}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="font-bold text-slate-800 hover:text-blue-600 transition-colors"
                      >
                        {p.name}
                      </a>
                      {p.espnId && newsIds.has(p.espnId) && (
                        <a
                          href={`https://www.espn.com/nfl/player/news/_/id/${p.espnId}`}
                          target="_blank"
                          rel="noopener noreferrer"
                          title="Recent ESPN news"
                          className="text-orange-400 hover:text-orange-600 transition-colors"
                        >
                          <Newspaper size={11} />
                        </a>
                      )}
                    </div>
                    <div className="text-[10px] text-slate-400">{p.teamName}</div>
                  </div>
                </div>
              </td>
              <td className="py-2 px-3"><PosBadge pos={p.posGroup} /></td>
              <td className="py-2 px-3 text-xs font-bold text-slate-500">{p.teamshort}</td>
              <td className="py-2 px-3 text-xs text-slate-500 whitespace-nowrap">{p.nflTeam ?? '—'}</td>
              <td className="py-2 px-3 text-sm text-right tabular-nums text-slate-500">{p.age ?? '—'}</td>
              <td className={`py-2 px-3 text-sm text-right tabular-nums font-semibold ${p.score > 0 ? 'text-slate-700' : 'text-slate-300'}`}>
                {p.score > 0 ? p.score.toFixed(1) : '—'}
              </td>
            </tr>
          ))}
          {filtered.length === 0 && (
            <tr>
              <td colSpan={5} className="py-8 text-center text-xs text-slate-400">No players found</td>
            </tr>
          )}
        </tbody>
      </TableWrap>
    </div>
  );
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

  const [view, setView] = useState<'myTeam' | 'league'>('myTeam');
  const [year, setYear] = useState(DEFAULT_YEAR);

  // My Team state
  const [data, setData] = useState<PlayerStat[] | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [linking, setLinking] = useState<PlayerStat | null>(null);

  // League view state
  const [leagueData, setLeagueData] = useState<TeamRanking[] | null>(null);
  const [leaguePlayers, setLeaguePlayers] = useState<LeaguePlayer[] | null>(null);
  const [leagueSubView, setLeagueSubView] = useState<'teams' | 'players'>('teams');
  const [leagueLoading, setLeagueLoading] = useState(false);
  const [leagueError, setLeagueError] = useState<string | null>(null);

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

  const loadLeagueStats = useCallback(async () => {
    setLeagueLoading(true);
    setLeagueError(null);
    setLeagueData(null);
    setLeaguePlayers(null);
    try {
      const r = await fetch(`/api/league-stats?year=${year}`);
      if (!r.ok) throw new Error('Failed to load league stats');
      const json = await r.json();
      setLeagueData(json.teams ?? []);
      setLeaguePlayers(json.players ?? []);
    } catch (e) {
      setLeagueError((e as Error).message);
    } finally {
      setLeagueLoading(false);
    }
  }, [year]);

  useEffect(() => {
    if (view === 'myTeam') {
      loadStats();
    }
  }, [view, loadStats]);

  useEffect(() => {
    if (view === 'league') {
      loadLeagueStats();
    }
  }, [view, loadLeagueStats]);

  // ESPN news ids
  const [newsIds, setNewsIds] = useState<Set<string>>(new Set());
  useEffect(() => {
    fetch('/api/espn-news')
      .then(r => r.ok ? r.json() : { ids: [] })
      .then(d => setNewsIds(new Set<string>(d.ids ?? [])))
      .catch(() => {});
  }, []);

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

  const isLeagueLoading = view === 'league' ? leagueLoading : loading;

  return (
    <NewsContext.Provider value={newsIds}>
    <div>
      {linking && (
        <LinkModal
          player={linking}
          onClose={() => setLinking(null)}
          onLinked={handleLinked}
        />
      )}

      {/* Year picker + view toggle */}
      <div className="flex items-center gap-3 mb-6 flex-wrap">
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

        <div className="flex bg-white p-1 rounded-xl shadow-sm border border-slate-200">
          {(['myTeam', 'league'] as const).map((v) => (
            <button
              key={v}
              onClick={() => setView(v)}
              className={`px-5 py-2 rounded-lg text-[10px] font-black uppercase transition-all ${
                view === v ? 'bg-slate-900 text-white shadow' : 'text-slate-400 hover:text-slate-900'
              }`}
            >
              {v === 'myTeam' ? 'My Team' : 'League'}
            </button>
          ))}
        </div>

        {isLeagueLoading && <Loader2 size={14} className="animate-spin text-slate-400" />}
      </div>

      {/* My Team view */}
      {view === 'myTeam' && (
        <>
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
        </>
      )}

      {/* League Rankings view */}
      {view === 'league' && (
        <>
          {leagueError && (
            <div className="flex items-center gap-2 text-red-500 text-sm font-bold p-4 bg-red-50 rounded-2xl">
              <AlertCircle size={16} /> {leagueError}
            </div>
          )}

          {leagueLoading && (
            <div className="py-16 text-center">
              <Loader2 size={24} className="animate-spin text-slate-400 mx-auto mb-2" />
              <p className="text-xs font-black uppercase text-slate-400 tracking-widest">
                Computing {year} power scores for all teams...
              </p>
              <p className="text-xs text-slate-300 mt-1">Fetching ESPN stats for every roster player</p>
            </div>
          )}

          {leagueData && !leagueLoading && (
            <>
              <div className="flex gap-1 bg-white p-1 rounded-xl shadow-sm border border-slate-200 w-fit mb-5">
                {(['teams', 'players'] as const).map((v) => (
                  <button
                    key={v}
                    onClick={() => setLeagueSubView(v)}
                    className={`px-5 py-2 rounded-lg text-[10px] font-black uppercase transition-all ${
                      leagueSubView === v ? 'bg-slate-900 text-white shadow' : 'text-slate-400 hover:text-slate-900'
                    }`}
                  >
                    {v === 'teams' ? 'Teams' : 'Top Players'}
                  </button>
                ))}
              </div>

              {leagueSubView === 'teams' ? (
                <>
                  <SectionHeader title={`${year} League Power Rankings`} />
                  <p className="text-[10px] text-slate-400 mb-3">Click a team row to expand position breakdown</p>
                  <LeagueRankingsTable data={leagueData} currentTeamshort={teamshort} />
                </>
              ) : (
                <>
                  <SectionHeader title={`${year} Top Players`} />
                  <LeaguePlayersTable data={leaguePlayers ?? []} />
                </>
              )}
            </>
          )}
        </>
      )}
    </div>
    </NewsContext.Provider>
  );
}
