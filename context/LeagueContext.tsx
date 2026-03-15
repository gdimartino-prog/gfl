'use client';
import { createContext, useContext, useState, useEffect, useCallback, ReactNode } from 'react';

export type League = {
  id: number;
  name: string;
  slug: string;
};

type LeagueContextType = {
  currentLeague: League | null;
  availableLeagues: League[];
  setLeague: (league: League) => void;
  loading: boolean;
};

const LeagueContext = createContext<LeagueContextType | undefined>(undefined);

export function LeagueProvider({ children }: { children: ReactNode }) {
  const [availableLeagues, setAvailableLeagues] = useState<League[]>([]);
  const [currentLeague, setCurrentLeague] = useState<League | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function fetchLeagues() {
      try {
        const res = await fetch('/api/leagues', { cache: 'no-store' });
        if (!res.ok) { setLoading(false); return; }
        const data: League[] = await res.json();
        setAvailableLeagues(data);

        // Restore previously selected league from cookie
        const cookieLeagueId = getCookie('gfl-league-id');
        const saved = cookieLeagueId
          ? data.find(l => String(l.id) === cookieLeagueId)
          : null;
        setCurrentLeague(saved ?? data[0] ?? null);
      } catch {
        // unauthenticated or network error — no leagues to show
      } finally {
        setLoading(false);
      }
    }
    fetchLeagues();
  }, []);

  const setLeague = useCallback((league: League) => {
    setCurrentLeague(league);
    document.cookie = `gfl-league-id=${league.id}; path=/; max-age=${60 * 60 * 24 * 365}; SameSite=Lax`;
  }, []);

  return (
    <LeagueContext.Provider value={{ currentLeague, availableLeagues, setLeague, loading }}>
      {children}
    </LeagueContext.Provider>
  );
}

export function useLeague() {
  const context = useContext(LeagueContext);
  if (!context) throw new Error('useLeague must be used within LeagueProvider');
  return context;
}

function getCookie(name: string): string | null {
  if (typeof document === 'undefined') return null;
  const match = document.cookie.match(new RegExp('(?:^|; )' + name + '=([^;]*)'));
  return match ? decodeURIComponent(match[1]) : null;
}
