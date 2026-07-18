'use client';

import { useState, useEffect, useCallback } from 'react';
import { Loader2, AlertCircle } from 'lucide-react';

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

function PlayerName({ player }: { player: PlayerStat }) {
  return (
    <td className="py-2 px-3 font-bold text-slate-800 text-sm whitespace-nowrap">
      {player.name}
      {player.isIR && <span className="ml-1 text-[9px] font-black text-red-500 uppercase">IR</span>}
      {!player.espnId && <span className="ml-1 text-[9px] text-slate-400">(not found)</span>}
    </td>
  );
}

function Th({ children }: { children: React.ReactNode }) {
  return (
    <th className="py-2 px-3 text-[9px] font-black text-slate-400 uppercase tracking-widest text-right whitespace-nowrap">
      {children}
    </th>
  );
}
function ThL({ children }: { children: React.ReactNode }) {
  return (
    <th className="py-2 px-3 text-[9px] font-black text-slate-400 uppercase tracking-widest text-left whitespace-nowrap">
      {children}
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

function QbTable({ players }: { players: PlayerStat[] }) {
  if (!players.length) return null;
  return (
    <>
      <SectionHeader title="Quarterbacks" />
      <TableWrap>
        <thead className="border-b border-slate-100 bg-slate-50">
          <tr>
            <ThL>Player</ThL>
            <ThL>Pos</ThL>
            <Th>Cmp</Th><Th>Att</Th><Th>Cmp%</Th><Th>Pass Yds</Th><Th>Pass TD</Th><Th>INT</Th><Th>Sacks</Th>
            <Th>Rush Att</Th><Th>Rush Yds</Th><Th>Rush TD</Th>
            <Th>FL</Th>
          </tr>
        </thead>
        <tbody>
          {players.map((p) => (
            <tr key={p.id} className="border-b border-slate-50 hover:bg-slate-50 transition-colors">
              <PlayerName player={p} />
              <td className="py-2 px-3"><PosBadge pos={p.offense || p.position || 'QB'} /></td>
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

function RbTable({ players }: { players: PlayerStat[] }) {
  if (!players.length) return null;
  return (
    <>
      <SectionHeader title="Running Backs" />
      <TableWrap>
        <thead className="border-b border-slate-100 bg-slate-50">
          <tr>
            <ThL>Player</ThL>
            <ThL>Pos</ThL>
            <Th>Rush Att</Th><Th>Rush Yds</Th><Th>YPC</Th><Th>Rush TD</Th>
            <Th>Rec</Th><Th>Rec Yds</Th><Th>Rec TD</Th>
            <Th>FL</Th>
          </tr>
        </thead>
        <tbody>
          {players.map((p) => (
            <tr key={p.id} className="border-b border-slate-50 hover:bg-slate-50 transition-colors">
              <PlayerName player={p} />
              <td className="py-2 px-3"><PosBadge pos={p.offense || p.position || 'RB'} /></td>
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

function WrTeTable({ players, label }: { players: PlayerStat[]; label: string }) {
  if (!players.length) return null;
  return (
    <>
      <SectionHeader title={label} />
      <TableWrap>
        <thead className="border-b border-slate-100 bg-slate-50">
          <tr>
            <ThL>Player</ThL>
            <ThL>Pos</ThL>
            <Th>Tgt</Th><Th>Rec</Th><Th>Rec Yds</Th><Th>YPR</Th><Th>Rec TD</Th>
            <Th>Rush Att</Th><Th>Rush Yds</Th>
            <Th>FL</Th>
          </tr>
        </thead>
        <tbody>
          {players.map((p) => (
            <tr key={p.id} className="border-b border-slate-50 hover:bg-slate-50 transition-colors">
              <PlayerName player={p} />
              <td className="py-2 px-3"><PosBadge pos={p.offense || p.position || 'WR'} /></td>
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

function DefTable({ players }: { players: PlayerStat[] }) {
  if (!players.length) return null;
  return (
    <>
      <SectionHeader title="Defense" />
      <TableWrap>
        <thead className="border-b border-slate-100 bg-slate-50">
          <tr>
            <ThL>Player</ThL>
            <ThL>Pos</ThL>
            <Th>Tackles</Th><Th>Solo</Th><Th>Ast</Th><Th>TFL</Th><Th>Sacks</Th>
            <Th>INT</Th><Th>PD</Th><Th>FF</Th><Th>FR</Th>
          </tr>
        </thead>
        <tbody>
          {players.map((p) => (
            <tr key={p.id} className="border-b border-slate-50 hover:bg-slate-50 transition-colors">
              <PlayerName player={p} />
              <td className="py-2 px-3"><PosBadge pos={p.defense || p.position || 'DEF'} /></td>
              <Td v={n(p.stats, 'totalTackles')} />
              <Td v={n(p.stats, 'soloTackles')} />
              <Td v={n(p.stats, 'assistedTackles')} />
              <Td v={n(p.stats, 'tacklesForLoss', 1)} />
              <Td v={n(p.stats, 'sacks', 1)} />
              <Td v={n(p.stats, 'defensiveInterceptions')} />
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

function OlTable({ players }: { players: PlayerStat[] }) {
  if (!players.length) return null;
  return (
    <>
      <SectionHeader title="Offensive Line" />
      <div className="rounded-2xl border border-slate-200 bg-white shadow-sm overflow-hidden">
        <table className="w-full text-left">
          <thead className="border-b border-slate-100 bg-slate-50">
            <tr>
              <ThL>Player</ThL>
              <ThL>Pos</ThL>
              <ThL>Note</ThL>
            </tr>
          </thead>
          <tbody>
            {players.map((p) => (
              <tr key={p.id} className="border-b border-slate-50">
                <td className="py-2 px-3 font-bold text-slate-800 text-sm">{p.name}</td>
                <td className="py-2 px-3"><PosBadge pos={p.offense || p.position || 'OL'} /></td>
                <td className="py-2 px-3 text-xs text-slate-400 italic">Individual OL stats not tracked in NFL</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </>
  );
}

function KickerTable({ players }: { players: PlayerStat[] }) {
  if (!players.length) return null;
  return (
    <>
      <SectionHeader title="Kickers" />
      <TableWrap>
        <thead className="border-b border-slate-100 bg-slate-50">
          <tr>
            <ThL>Player</ThL>
            <ThL>Pos</ThL>
            <Th>FGM</Th><Th>FGA</Th><Th>FG%</Th><Th>Long</Th><Th>XPM</Th><Th>XPA</Th><Th>XP%</Th>
          </tr>
        </thead>
        <tbody>
          {players.map((p) => (
            <tr key={p.id} className="border-b border-slate-50 hover:bg-slate-50 transition-colors">
              <PlayerName player={p} />
              <td className="py-2 px-3"><PosBadge pos="K" /></td>
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

function PunterTable({ players }: { players: PlayerStat[] }) {
  if (!players.length) return null;
  return (
    <>
      <SectionHeader title="Punters" />
      <TableWrap>
        <thead className="border-b border-slate-100 bg-slate-50">
          <tr>
            <ThL>Player</ThL>
            <ThL>Pos</ThL>
            <Th>Punts</Th><Th>Avg</Th><Th>Net Avg</Th><Th>Long</Th><Th>In 20</Th><Th>TB</Th>
          </tr>
        </thead>
        <tbody>
          {players.map((p) => (
            <tr key={p.id} className="border-b border-slate-50 hover:bg-slate-50 transition-colors">
              <PlayerName player={p} />
              <td className="py-2 px-3"><PosBadge pos="P" /></td>
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
  if (['QB'].includes(pos)) return 'QB';
  if (['RB', 'HB', 'FB'].includes(pos)) return 'RB';
  if (['WR'].includes(pos)) return 'WR';
  if (['TE'].includes(pos)) return 'TE';
  if (['OL', 'OT', 'OG', 'C', 'G', 'T'].includes(pos)) return 'OL';
  if (['DL', 'DE', 'DT', 'NT'].includes(pos)) return 'DL';
  if (['LB', 'ILB', 'OLB', 'MLB'].includes(pos)) return 'LB';
  if (['DB', 'CB', 'S', 'SS', 'FS'].includes(pos)) return 'DB';
  if (['K'].includes(pos)) return 'K';
  if (['P'].includes(pos)) return 'P';
  return 'OTHER';
}

interface Props {
  teamshort: string;
}

export default function NflStatsTab({ teamshort }: Props) {
  const [year, setYear] = useState(CURRENT_YEAR - 1);
  const [data, setData] = useState<PlayerStat[] | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

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

  const groups = data
    ? {
        QB: data.filter((p) => posGroup(p) === 'QB'),
        RB: data.filter((p) => posGroup(p) === 'RB'),
        WR: data.filter((p) => posGroup(p) === 'WR'),
        TE: data.filter((p) => posGroup(p) === 'TE'),
        OL: data.filter((p) => posGroup(p) === 'OL'),
        DL: data.filter((p) => ['DL', 'LB', 'DB'].includes(posGroup(p))),
        K: data.filter((p) => posGroup(p) === 'K'),
        P: data.filter((p) => posGroup(p) === 'P'),
      }
    : null;

  const notFound = data?.filter((p) => !p.espnId).length ?? 0;

  return (
    <div>
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
            </p>
          )}
          <QbTable players={groups.QB} />
          <RbTable players={groups.RB} />
          <WrTeTable players={groups.WR} label="Wide Receivers" />
          <WrTeTable players={groups.TE} label="Tight Ends" />
          <OlTable players={groups.OL} />
          <DefTable players={groups.DL} />
          <KickerTable players={groups.K} />
          <PunterTable players={groups.P} />
          {!data?.length && (
            <p className="text-slate-400 text-sm py-8 text-center">No players on roster.</p>
          )}
        </>
      )}
    </div>
  );
}
