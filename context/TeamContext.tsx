'use client';
import { createContext, useContext, useState, useEffect, ReactNode } from 'react';

type TeamContextType = {
  selectedTeam: string;
  setSelectedTeam: (team: string) => void;   // persists to localStorage
  initTeam: (team: string) => void;          // sets state only, no localStorage
};

const TeamContext = createContext<TeamContextType | undefined>(undefined);

export function TeamProvider({ children }: { children: ReactNode }) {
  const [selectedTeam, setSelectedTeam] = useState<string>('');

  // Load from localStorage so it remembers after a page refresh
  useEffect(() => {
    const saved = localStorage.getItem('gfl-selected-team');
    if (saved) {
      requestAnimationFrame(() => {
        setSelectedTeam(saved);
      });
    }
  }, []);

  const updateTeam = (team: string) => {
    setSelectedTeam(team);
    localStorage.setItem('gfl-selected-team', team);
  };

  return (
    <TeamContext.Provider value={{ selectedTeam, setSelectedTeam: updateTeam, initTeam: setSelectedTeam }}>
      {children}
    </TeamContext.Provider>
  );
}

export const useTeam = () => {
  const context = useContext(TeamContext);
  if (!context) throw new Error('useTeam must be used within TeamProvider');
  return context;
};
