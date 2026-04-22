'use client';

import React, { useState, useEffect, useMemo } from 'react';
import { Search, X, ChevronUp, ChevronDown, ChevronsUpDown, Star } from 'lucide-react';

export const dynamic = 'force-dynamic';

const WATCHLIST_KEY = 'gfl-draft-watchlist';

// ─── Types ────────────────────────────────────────────────────────────────────

interface FaPlayer {
  name: string;
  first: string;
  last: string;
  age: string | number | null;
  offense: string | null;
  defense: string | null;
  special: string | null;
  position: string | null;
  overall: string | number | null;
  dur: string | number | null;
  salary: string | number | null;
  run: string | number | null;
  pass: string | number | null;
  rush: string | number | null;
  int: string | number | null;
  sack: string | number | null;
  scouting: Record<string, string | number> | null;
  identity: string;
}

type SortDir = 'asc' | 'desc';

// ─── Position Group Config ────────────────────────────────────────────────────

type ColDef = {
  key: string;
  label: string;
  numeric: boolean;
  getValue: (p: FaPlayer) => string | number;
};

function s(p: FaPlayer, key: string): string | number {
  return p.scouting?.[key.toLowerCase()] ?? '—';
}

function n(v: string | number | null | undefined): number {
  if (v === null || v === undefined || v === '—' || v === '') return -Infinity;
  return parseFloat(String(v)) || 0;
}

function ratio(num: string | number, den: string | number, pct = false): string {
  const a = parseFloat(String(num)) || 0;
  const b = parseFloat(String(den)) || 0;
  if (b === 0) return '—';
  const r = a / b;
  return pct ? (r * 100).toFixed(1) + '%' : r.toFixed(1);
}

const POSITION_GROUPS: {
  label: string;
  positions: string[];
  cols: ColDef[];
}[] = [
  {
    label: 'Quarterbacks',
    positions: ['QB'],
    cols: [
      { key: 'age',   label: 'Age',  numeric: true, getValue: p => p.age ?? '—' },
      { key: 'att',   label: 'Att',  numeric: true, getValue: p => s(p, 'pass attempts') },
      { key: 'cmp',   label: 'C%',   numeric: true, getValue: p => ratio(s(p, 'completions'), s(p, 'pass attempts'), true) },
      { key: 'yds',   label: 'Yds',  numeric: true, getValue: p => s(p, 'pass yards') },
      { key: 'int',   label: 'Int',  numeric: true, getValue: p => s(p, 'pass interceptions') },
      { key: 'td',    label: 'TD',   numeric: true, getValue: p => s(p, 'pass TD') },
      { key: 'sack',  label: 'Sk',   numeric: true, getValue: p => s(p, 'sacks') },
      { key: 'dur',   label: 'Dur',  numeric: true, getValue: p => p.dur ?? '—' },
      { key: 'sal',   label: 'Sal',  numeric: true, getValue: p => p.salary ?? '—' },
    ],
  },
  {
    label: 'Running Backs',
    positions: ['RB', 'HB', 'FB'],
    cols: [
      { key: 'age',    label: 'Age',  numeric: true, getValue: p => p.age ?? '—' },
      { key: 'att',    label: 'Att',  numeric: true, getValue: p => s(p, 'rush attempts') },
      { key: 'ryds',   label: 'RYds', numeric: true, getValue: p => s(p, 'rush yards') },
      { key: 'ypc',    label: 'YPC',  numeric: true, getValue: p => ratio(s(p, 'rush yards'), s(p, 'rush attempts')) },
      { key: 'rtd',    label: 'RTD',  numeric: true, getValue: p => s(p, 'rush TD') },
      { key: 'rec',    label: 'Rec',  numeric: true, getValue: p => s(p, 'receptions') },
      { key: 'recyds', label: 'RcYd', numeric: true, getValue: p => s(p, 'receiving yards') },
      { key: 'dur',    label: 'Dur',  numeric: true, getValue: p => p.dur ?? '—' },
      { key: 'sal',    label: 'Sal',  numeric: true, getValue: p => p.salary ?? '—' },
    ],
  },
  {
    label: 'Wide Receivers',
    positions: ['WR'],
    cols: [
      { key: 'age',    label: 'Age',  numeric: true, getValue: p => p.age ?? '—' },
      { key: 'rec',    label: 'Rec',  numeric: true, getValue: p => s(p, 'receptions') },
      { key: 'recyds', label: 'Yds',  numeric: true, getValue: p => s(p, 'receiving yards') },
      { key: 'ypr',    label: 'YPR',  numeric: true, getValue: p => ratio(s(p, 'receiving yards'), s(p, 'receptions')) },
      { key: 'rectl',  label: 'Lng',  numeric: true, getValue: p => s(p, 'receiving long') },
      { key: 'rectd',  label: 'TD',   numeric: true, getValue: p => s(p, 'receiving TD') },
      { key: 'rcv',    label: 'Rcv',  numeric: true, getValue: p => s(p, 'receiving') },
      { key: 'dur',    label: 'Dur',  numeric: true, getValue: p => p.dur ?? '—' },
      { key: 'sal',    label: 'Sal',  numeric: true, getValue: p => p.salary ?? '—' },
    ],
  },
  {
    label: 'Tight Ends',
    positions: ['TE'],
    cols: [
      { key: 'age',    label: 'Age',  numeric: true, getValue: p => p.age ?? '—' },
      { key: 'rec',    label: 'Rec',  numeric: true, getValue: p => s(p, 'receptions') },
      { key: 'recyds', label: 'Yds',  numeric: true, getValue: p => s(p, 'receiving yards') },
      { key: 'ypr',    label: 'YPR',  numeric: true, getValue: p => ratio(s(p, 'receiving yards'), s(p, 'receptions')) },
      { key: 'rectd',  label: 'TD',   numeric: true, getValue: p => s(p, 'receiving TD') },
      { key: 'rcv',    label: 'Rcv',  numeric: true, getValue: p => s(p, 'receiving') },
      { key: 'bka',    label: 'BkAv', numeric: true, getValue: p => s(p, 'breakaway') },
      { key: 'dur',    label: 'Dur',  numeric: true, getValue: p => p.dur ?? '—' },
      { key: 'sal',    label: 'Sal',  numeric: true, getValue: p => p.salary ?? '—' },
    ],
  },
  {
    label: 'Offensive Line',
    positions: ['OL', 'C', 'G', 'T', 'C-G', 'G-T'],
    cols: [
      { key: 'age',  label: 'Age',  numeric: true, getValue: p => p.age ?? '—' },
      { key: 'rblk', label: 'RBlk', numeric: true, getValue: p => s(p, 'run block') },
      { key: 'pblk', label: 'PBlk', numeric: true, getValue: p => s(p, 'pass block') },
      { key: 'avgb', label: 'AvgB', numeric: true, getValue: p => {
          const rb = parseFloat(String(s(p, 'run block'))) || 0;
          const pb = parseFloat(String(s(p, 'pass block'))) || 0;
          return rb + pb > 0 ? ((rb + pb) / 2).toFixed(0) : '—';
        }
      },
      { key: 'sy',   label: 'ShYd', numeric: true, getValue: p => s(p, 'short yardage') },
      { key: 'gms',  label: 'Gms',  numeric: true, getValue: p => s(p, 'games') },
      { key: 'dur',  label: 'Dur',  numeric: true, getValue: p => p.dur ?? '—' },
      { key: 'sal',  label: 'Sal',  numeric: true, getValue: p => p.salary ?? '—' },
    ],
  },
  {
    label: 'Defensive Line',
    positions: ['DL', 'DE', 'DT', 'NT'],
    cols: [
      { key: 'age',    label: 'Age',  numeric: true, getValue: p => p.age ?? '—' },
      { key: 'tdef',   label: 'TDef', numeric: true, getValue: p => s(p, 'total defense') },
      { key: 'rdef',   label: 'RDef', numeric: true, getValue: p => s(p, 'run defense') },
      { key: 'pdef',   label: 'PDef', numeric: true, getValue: p => s(p, 'pass defense') },
      { key: 'prsh',   label: 'PRsh', numeric: true, getValue: p => s(p, 'pass rush') },
      { key: 'sacks',  label: 'Sks',  numeric: true, getValue: p => s(p, 'sacks') },
      { key: 'stuffs', label: 'Stf',  numeric: true, getValue: p => s(p, 'stuffs') },
      { key: 'dur',    label: 'Dur',  numeric: true, getValue: p => p.dur ?? '—' },
      { key: 'sal',    label: 'Sal',  numeric: true, getValue: p => p.salary ?? '—' },
    ],
  },
  {
    label: 'Linebackers',
    positions: ['LB', 'OLB', 'ILB', 'MLB'],
    cols: [
      { key: 'age',   label: 'Age',  numeric: true, getValue: p => p.age ?? '—' },
      { key: 'tdef',  label: 'TDef', numeric: true, getValue: p => s(p, 'total defense') },
      { key: 'rdef',  label: 'RDef', numeric: true, getValue: p => s(p, 'run defense') },
      { key: 'pdef',  label: 'PDef', numeric: true, getValue: p => s(p, 'pass defense') },
      { key: 'prsh',  label: 'PRsh', numeric: true, getValue: p => s(p, 'pass rush') },
      { key: 'tkl',   label: 'Tkl',  numeric: true, getValue: p => s(p, 'tackles') },
      { key: 'sacks', label: 'Sks',  numeric: true, getValue: p => s(p, 'sacks') },
      { key: 'dur',   label: 'Dur',  numeric: true, getValue: p => p.dur ?? '—' },
      { key: 'sal',   label: 'Sal',  numeric: true, getValue: p => p.salary ?? '—' },
    ],
  },
  {
    label: 'Defensive Backs',
    positions: ['DB', 'CB', 'S', 'SAF', 'FS', 'SS'],
    cols: [
      { key: 'age',    label: 'Age',  numeric: true, getValue: p => p.age ?? '—' },
      { key: 'tdef',   label: 'TDef', numeric: true, getValue: p => s(p, 'total defense') },
      { key: 'rdef',   label: 'RDef', numeric: true, getValue: p => s(p, 'run defense') },
      { key: 'pdef',   label: 'PDef', numeric: true, getValue: p => s(p, 'pass defense') },
      { key: 'int',    label: 'INT',  numeric: true, getValue: p => s(p, 'interceptions') },
      { key: 'tkl',    label: 'Tkl',  numeric: true, getValue: p => s(p, 'tackles') },
      { key: 'audible',label: 'Aud',  numeric: true, getValue: p => s(p, 'audible') },
      { key: 'dur',    label: 'Dur',  numeric: true, getValue: p => p.dur ?? '—' },
      { key: 'sal',    label: 'Sal',  numeric: true, getValue: p => p.salary ?? '—' },
    ],
  },
  {
    label: 'Kickers',
    positions: ['K', 'K-P'],
    cols: [
      { key: 'age',   label: 'Age', numeric: true, getValue: p => p.age ?? '—' },
      { key: 'fga',   label: 'FGA', numeric: true, getValue: p => s(p, 'field goal attempts') },
      { key: 'fgpct', label: 'FG%', numeric: true, getValue: p => {
          const made = parseFloat(String(s(p, 'field goals made'))) || 0;
          const att  = parseFloat(String(s(p, 'field goal attempts'))) || 0;
          return att > 0 ? (made / att * 100).toFixed(1) + '%' : '—';
        }
      },
      { key: 'fglg',  label: 'Lg',  numeric: true, getValue: p => s(p, 'field goals long') },
      { key: 'xpa',   label: 'XPA', numeric: true, getValue: p => s(p, 'extra point attempts') },
      { key: 'xppct', label: 'XP%', numeric: true, getValue: p => {
          const made = parseFloat(String(s(p, 'extra points made'))) || 0;
          const att  = parseFloat(String(s(p, 'extra point attempts'))) || 0;
          return att > 0 ? (made / att * 100).toFixed(1) + '%' : '—';
        }
      },
      { key: 'dur',   label: 'Dur', numeric: true, getValue: p => p.dur ?? '—' },
      { key: 'sal',   label: 'Sal', numeric: true, getValue: p => p.salary ?? '—' },
    ],
  },
  {
    label: 'Punters',
    positions: ['P'],
    cols: [
      { key: 'age',   label: 'Age',  numeric: true, getValue: p => p.age ?? '—' },
      { key: 'punts', label: 'Punts',numeric: true, getValue: p => s(p, 'punts') },
      { key: 'pyds',  label: 'Yds',  numeric: true, getValue: p => s(p, 'punt yards') },
      { key: 'pavg',  label: 'Avg',  numeric: true, getValue: p => {
          const yds   = parseFloat(String(s(p, 'punt yards'))) || 0;
          const punts = parseFloat(String(s(p, 'punts'))) || 0;
          return punts > 0 ? (yds / punts).toFixed(1) : '—';
        }
      },
      { key: 'plg',   label: 'Lng',  numeric: true, getValue: p => s(p, 'punt long') },
      { key: 'in20',  label: 'In20', numeric: true, getValue: p => s(p, 'punt inside 20') },
      { key: 'dur',   label: 'Dur',  numeric: true, getValue: p => p.dur ?? '—' },
      { key: 'sal',   label: 'Sal',  numeric: true, getValue: p => p.salary ?? '—' },
    ],
  },
];

// ─── Sort icon ────────────────────────────────────────────────────────────────

function SortIcon({ active, dir }: { active: boolean; dir: SortDir }) {
  if (!active) return <ChevronsUpDown size={12} className="text-slate-400 ml-0.5" />;
  return dir === 'asc'
    ? <ChevronUp size={12} className="text-blue-400 ml-0.5" />
    : <ChevronDown size={12} className="text-blue-400 ml-0.5" />;
}

// ─── Position Group Table ─────────────────────────────────────────────────────

function PositionTable({
  group,
  players,
  search,
  watchlist,
  onToggleStar,
  starredOnly,
}: {
  group: typeof POSITION_GROUPS[number];
  players: FaPlayer[];
  search: string;
  watchlist: Set<string>;
  onToggleStar: (identity: string) => void;
  starredOnly: boolean;
}) {
  const [sortKey, setSortKey] = useState<string>('sal');
  const [sortDir, setSortDir] = useState<SortDir>('desc');

  const filtered = useMemo(() => {
    const q = search.toLowerCase();
    return players.filter(p => {
      if (starredOnly && !watchlist.has(p.identity)) return false;
      return !q || p.name.toLowerCase().includes(q);
    });
  }, [players, search, watchlist, starredOnly]);

  const sorted = useMemo(() => {
    const col = group.cols.find(c => c.key === sortKey);
    return [...filtered].sort((a, b) => {
      // Starred always float to top
      const aS = watchlist.has(a.identity) ? 1 : 0;
      const bS = watchlist.has(b.identity) ? 1 : 0;
      if (aS !== bS) return bS - aS;
      const av = col ? n(col.getValue(a)) : 0;
      const bv = col ? n(col.getValue(b)) : 0;
      return sortDir === 'asc' ? av - bv : bv - av;
    });
  }, [filtered, sortKey, sortDir, group.cols, watchlist]);

  if (sorted.length === 0) return null;

  function toggleSort(key: string) {
    if (sortKey === key) {
      setSortDir(d => d === 'asc' ? 'desc' : 'asc');
    } else {
      setSortKey(key);
      setSortDir('desc');
    }
  }

  return (
    <div className="mb-8">
      <h2 className="text-sm font-black uppercase tracking-widest text-slate-300 mb-2 px-1">
        {group.label} <span className="text-slate-500 font-normal">({sorted.length})</span>
      </h2>
      <div className="overflow-x-auto rounded-lg border border-slate-700">
        <table className="w-full text-xs text-left">
          <thead>
            <tr className="bg-slate-800 text-slate-400">
              {/* Star col header */}
              <th className="pl-2 pr-1 py-2 sticky left-0 bg-slate-800 z-10 w-6" />
              <th className="px-3 py-2 font-semibold text-left sticky left-8 bg-slate-800 z-10 min-w-[140px]">
                Player
              </th>
              {group.cols.map(col => (
                <th
                  key={col.key}
                  className="px-2 py-2 font-semibold text-right cursor-pointer select-none hover:text-white whitespace-nowrap"
                  onClick={() => toggleSort(col.key)}
                >
                  <span className="inline-flex items-center justify-end gap-0.5">
                    {col.label}
                    <SortIcon active={sortKey === col.key} dir={sortDir} />
                  </span>
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {sorted.map((p, i) => {
              const isStarred = watchlist.has(p.identity);
              const pos = (p.offense || p.defense || p.special || p.position || '').toUpperCase();
              return (
                <tr
                  key={p.identity}
                  className={
                    isStarred
                      ? 'bg-yellow-950/30 hover:bg-yellow-900/20'
                      : i % 2 === 0
                        ? 'bg-slate-900 hover:bg-slate-800/60'
                        : 'bg-slate-800/40 hover:bg-slate-800/60'
                  }
                >
                  {/* Star button */}
                  <td className="pl-2 pr-1 py-1.5 sticky left-0 bg-inherit z-10">
                    <button
                      onClick={() => onToggleStar(p.identity)}
                      className={`transition-colors ${
                        isStarred ? 'text-yellow-400 hover:text-yellow-300' : 'text-slate-600 hover:text-slate-400'
                      }`}
                      title={isStarred ? 'Remove from watchlist' : 'Add to watchlist'}
                    >
                      <Star size={12} fill={isStarred ? 'currentColor' : 'none'} />
                    </button>
                  </td>
                  {/* Player name */}
                  <td className="px-3 py-1.5 sticky left-8 bg-inherit z-10 whitespace-nowrap">
                    <a
                      href={`https://www.google.com/search?q=${encodeURIComponent(p.name + ' NFL')}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="font-semibold text-white hover:text-blue-400 transition-colors"
                    >
                      {p.first} {p.last}
                    </a>
                    <span className="ml-1.5 text-slate-500 font-normal text-[10px]">{pos}</span>
                  </td>
                  {/* Stats */}
                  {group.cols.map(col => {
                    const val = col.getValue(p);
                    const isHighlighted = sortKey === col.key;
                    return (
                      <td
                        key={col.key}
                        className={`px-2 py-1.5 text-right tabular-nums ${
                          isHighlighted ? 'text-blue-300 font-semibold' : 'text-slate-300'
                        }`}
                      >
                        {String(val)}
                      </td>
                    );
                  })}
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}

// ─── Page ─────────────────────────────────────────────────────────────────────

const ALL_POS = 'All';
const STARRED = 'Starred';

export default function FreeAgentsPage() {
  const [players, setPlayers] = useState<FaPlayer[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [posFilter, setPosFilter] = useState(ALL_POS);
  const [watchlist, setWatchlist] = useState<Set<string>>(new Set());

  useEffect(() => {
    const saved = localStorage.getItem(WATCHLIST_KEY);
    if (!saved) return;
    try {
      const parsed: string[] = JSON.parse(saved);
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setWatchlist(new Set(parsed));
    } catch { /* ignore */ }
  }, []);

  useEffect(() => {
    fetch('/api/players?team=FA&scouting=1')
      .then(r => r.json())
      .then((data: FaPlayer[]) => {
        setPlayers(Array.isArray(data) ? data : []);
        setLoading(false);
      })
      .catch(() => setLoading(false));
  }, []);

  function toggleStar(identity: string) {
    setWatchlist(prev => {
      const next = new Set(prev);
      if (next.has(identity)) next.delete(identity);
      else next.add(identity);
      localStorage.setItem(WATCHLIST_KEY, JSON.stringify(Array.from(next)));
      return next;
    });
  }

  const starredOnly = posFilter === STARRED;

  const groupedPlayers = useMemo(() => {
    return POSITION_GROUPS.map(group => ({
      group,
      players: players.filter(p => {
        const pos = (p.offense || p.defense || p.special || p.position || '').toUpperCase();
        const inGroup = group.positions.includes(pos);
        const inPosFilter = posFilter === ALL_POS || posFilter === STARRED || group.label === posFilter;
        return inGroup && inPosFilter;
      }),
    })).filter(g => g.players.length > 0);
  }, [players, posFilter]);

  const availableGroups = useMemo(() => {
    const seen = new Set<string>();
    POSITION_GROUPS.forEach(g => {
      const hasPlayers = players.some(p => {
        const pos = (p.offense || p.defense || p.special || p.position || '').toUpperCase();
        return g.positions.includes(pos);
      });
      if (hasPlayers) seen.add(g.label);
    });
    return Array.from(seen);
  }, [players]);

  const totalCount = useMemo(() => {
    return groupedPlayers.reduce((acc, g) => {
      const q = search.toLowerCase();
      return acc + g.players.filter(p => {
        if (starredOnly && !watchlist.has(p.identity)) return false;
        return !q || p.name.toLowerCase().includes(q);
      }).length;
    }, 0);
  }, [groupedPlayers, search, starredOnly, watchlist]);

  // Count only FA players that are actually starred (not ex-FAs still in localStorage)
  const starredCount = useMemo(
    () => players.filter(p => watchlist.has(p.identity)).length,
    [players, watchlist]
  );

  return (
    <div className="min-h-screen bg-slate-950 text-white">
      <div className="max-w-7xl mx-auto px-4 py-6">

        {/* Header */}
        <div className="mb-6">
          <h1 className="text-2xl font-black uppercase tracking-tight text-white">
            Free Agent <span className="text-blue-400">Evaluation</span>
          </h1>
          <p className="text-slate-400 text-sm mt-0.5">
            {loading ? 'Loading...' : `${players.length} free agents available`}
          </p>
        </div>

        {/* Filters */}
        <div className="flex flex-wrap gap-3 mb-6">
          {/* Search */}
          <div className="relative flex-1 min-w-[200px] max-w-sm">
            <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
            <input
              type="text"
              value={search}
              onChange={e => setSearch(e.target.value)}
              placeholder="Search players…"
              className="w-full pl-8 pr-8 py-2 text-sm bg-slate-800 border border-slate-700 rounded-lg text-white placeholder-slate-500 focus:outline-none focus:border-blue-500"
            />
            {search && (
              <button
                onClick={() => setSearch('')}
                className="absolute right-2 top-1/2 -translate-y-1/2 text-slate-400 hover:text-white"
              >
                <X size={14} />
              </button>
            )}
          </div>

          {/* Filter pills */}
          <div className="flex flex-wrap gap-1.5">
            <button
              onClick={() => setPosFilter(ALL_POS)}
              className={`px-3 py-1.5 rounded-full text-xs font-semibold transition-colors ${
                posFilter === ALL_POS
                  ? 'bg-blue-600 text-white'
                  : 'bg-slate-800 text-slate-300 hover:bg-slate-700'
              }`}
            >
              All
            </button>
            <button
              onClick={() => setPosFilter(posFilter === STARRED ? ALL_POS : STARRED)}
              className={`px-3 py-1.5 rounded-full text-xs font-semibold transition-colors inline-flex items-center gap-1 ${
                posFilter === STARRED
                  ? 'bg-yellow-500 text-slate-900'
                  : 'bg-slate-800 text-slate-300 hover:bg-slate-700'
              }`}
            >
              <Star size={10} fill={posFilter === STARRED ? 'currentColor' : 'none'} />
              Starred
              {starredCount > 0 && (
                <span className={`ml-0.5 font-black ${posFilter === STARRED ? 'text-slate-900' : 'text-yellow-400'}`}>
                  {starredCount}
                </span>
              )}
            </button>
            {availableGroups.map(label => (
              <button
                key={label}
                onClick={() => setPosFilter(label === posFilter ? ALL_POS : label)}
                className={`px-3 py-1.5 rounded-full text-xs font-semibold transition-colors ${
                  posFilter === label
                    ? 'bg-blue-600 text-white'
                    : 'bg-slate-800 text-slate-300 hover:bg-slate-700'
                }`}
              >
                {label}
              </button>
            ))}
          </div>
        </div>

        {/* Count */}
        {!loading && (
          <p className="text-xs text-slate-500 mb-4">
            Showing {totalCount} player{totalCount !== 1 ? 's' : ''}
            {posFilter === STARRED ? ' on watchlist' : posFilter !== ALL_POS ? ` in ${posFilter}` : ''}
            {search ? ` matching "${search}"` : ''}
          </p>
        )}

        {/* Tables */}
        {loading ? (
          <div className="text-center py-24 text-slate-400 font-black uppercase italic animate-pulse">
            Loading Free Agents…
          </div>
        ) : groupedPlayers.length === 0 ? (
          <div className="text-center py-24 text-slate-500">No players found.</div>
        ) : (
          groupedPlayers.map(({ group, players: gPlayers }) => (
            <PositionTable
              key={group.label}
              group={group}
              players={gPlayers}
              search={search}
              watchlist={watchlist}
              onToggleStar={toggleStar}
              starredOnly={starredOnly}
            />
          ))
        )}
      </div>
    </div>
  );
}
