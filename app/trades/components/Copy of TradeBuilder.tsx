'use client';

import React, { useEffect, useState } from 'react';

interface Team {
  name: string;
  short: string;
  coach: string;
  commissioner: boolean;
}

interface Player {
  team: string;
  originalTeam: string;
  first: string;
  last: string;
  age?: number;
  offense?: string;
  defense?: string;
  special?: string;
  position: string;
}

interface DraftPick {
  year: number;
  round: number;
  team: string;
}

export default function TradeBuilder() {
  const [teams, setTeams] = useState<Team[]>([]);
  const [players, setPlayers] = useState<Player[]>([]);
  const [draftPicks, setDraftPicks] = useState<DraftPick[]>([]);

  const [fromTeam, setFromTeam] = useState('');
  const [toTeam, setToTeam] = useState('');
  const [fromPlayers, setFromPlayers] = useState<string[]>([]);
  const [toPlayers, setToPlayers] = useState<string[]>([]);
  const [fromDraftPicks, setFromDraftPicks] = useState<string[]>([]);
  const [toDraftPicks, setToDraftPicks] = useState<string[]>([]);
  const [status, setStatus] = useState('');

  // Fetch teams
  useEffect(() => {
    const fetchTeams = async () => {
      try {
        const res = await fetch('/api/teams');
        const data = await res.json();
        setTeams(data);
      } catch (err) {
        console.error('Failed to fetch teams', err);
      }
    };
    fetchTeams();
  }, []);

  // Fetch players
  useEffect(() => {
    const fetchPlayers = async () => {
      try {
        const res = await fetch('/api/players');
        const data = await res.json();
        setPlayers(data);
      } catch (err) {
        console.error('Failed to fetch players', err);
      }
    };
    fetchPlayers();
  }, []);

  // Fetch draft picks
  useEffect(() => {
    const fetchDraftPicks = async () => {
      try {
        const res = await fetch('/api/draft-picks');
        const data = await res.json();
        setDraftPicks(data);
      } catch (err) {
        console.error('Failed to fetch draft picks', err);
      }
    };
    fetchDraftPicks();
  }, []);

  const fromTeamPlayers = players.filter((p) => p.team === fromTeam);
  const toTeamPlayers = players.filter((p) => p.team === toTeam);

  const fromTeamDraftPicks = draftPicks.filter((p) => p.team === fromTeam);
  const toTeamDraftPicks = draftPicks.filter((p) => p.team === toTeam);

  const handleTrade = async () => {
  if (!fromTeam || !toTeam || fromPlayers.length === 0) {
    setStatus('⚠️ Please select From Team, To Team, and at least one From Player');
    return;
  }

  setStatus('⏳ Submitting trade...');

  try {
    // Helper to format player with position
    const formatPlayers = (playerList: string[], allPlayers: Player[]) =>
      playerList
        .map((identity) => {
          const p = allPlayers.find((pl) => `${pl.first} ${pl.last}` === identity);
          if (!p) return identity;
          return `${p.position} - ${p.first} ${p.last}`;
        })
        .join(', ');

    // Helper to format draft picks
    const formatDraftPicks = (draftPickList: string[]) => draftPickList.join(', ');

    // First entry: From Team → To Team
    if (fromPlayers.length || fromDraftPicks.length) {
      const fromEntry = [
        formatPlayers(fromPlayers, players),
        formatDraftPicks(fromDraftPicks)
      ]
        .filter(Boolean)
        .join(', ');

      await fetch('/api/trades', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          fromTeam,
          toTeam,
          playersFrom: fromPlayers,
          playersTo: [],
          draftPicksFrom: fromDraftPicks,
          draftPicksTo: [],
          submittedBy: 'USER',
          logMessage: fromEntry
        })
      });
    }

    // Second entry: To Team → From Team
    if (toPlayers.length || toDraftPicks.length) {
      const toEntry = [
        formatPlayers(toPlayers, players),
        formatDraftPicks(toDraftPicks)
      ]
        .filter(Boolean)
        .join(', ');

      await fetch('/api/trades', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          fromTeam: toTeam,
          toTeam: fromTeam,
          playersFrom: toPlayers,
          playersTo: [],
          draftPicksFrom: toDraftPicks,
          draftPicksTo: [],
          submittedBy: 'USER',
          logMessage: toEntry
        })
      });
    }

    setStatus('✅ Trade successfully submitted');
    setFromPlayers([]);
    setToPlayers([]);
    setFromDraftPicks([]);
    setToDraftPicks([]);
  } catch (err: any) {
    console.error('Trade submission error:', err);
    setStatus(`⚠️ Trade submission error: ${err.message}`);
  }
};


  return (
    <div className="p-4">
      <h1 className="text-2xl mb-4">Trade Builder</h1>

      {/* From Team */}
      <div className="mb-4">
        <label className="block mb-1">From Team:</label>
        <select
          value={fromTeam}
          onChange={(e) => setFromTeam(e.target.value)}
          className="border p-2 w-full"
        >
          <option value="">Select a team</option>
          {teams.map((team, idx) => (
            <option key={`${team.short}-${idx}`} value={team.short}>
              {team.name}
            </option>
          ))}
        </select>
      </div>

      {/* To Team */}
      <div className="mb-4">
        <label className="block mb-1">To Team:</label>
        <select
          value={toTeam}
          onChange={(e) => setToTeam(e.target.value)}
          className="border p-2 w-full"
        >
          <option value="">Select a team</option>
          {teams.map((team, idx) => (
            <option key={`${team.short}-${idx}`} value={team.short}>
              {team.name}
            </option>
          ))}
        </select>
      </div>

      {/* From Players */}
      <div className="mb-4">
        <label className="block mb-1">From Player(s):</label>
        <select
          multiple
          value={fromPlayers}
          onChange={(e) =>
            setFromPlayers(Array.from(e.target.selectedOptions, (opt) => opt.value))
          }
          className="border p-2 w-full"
        >
          {fromTeamPlayers.map((p, idx) => (
            <option
              key={`${p.first}-${p.last}-${p.team}-${idx}`}
              value={`${p.first} ${p.last}`}
            >
              {`${p.first} ${p.last} (Age: ${p.age}, Position: ${p.position})`}
            </option>
          ))}
        </select>
      </div>

      {/* To Players */}
      <div className="mb-4">
        <label className="block mb-1">To Player(s) (optional):</label>
        <select
          multiple
          value={toPlayers}
          onChange={(e) =>
            setToPlayers(Array.from(e.target.selectedOptions, (opt) => opt.value))
          }
          className="border p-2 w-full"
        >
          {toTeamPlayers.map((p, idx) => (
            <option
              key={`${p.first}-${p.last}-${p.team}-${idx}`}
              value={`${p.first} ${p.last}`}
            >
              {`${p.first} ${p.last} (Age: ${p.age}, Position: ${p.position})`}
            </option>
          ))}
        </select>
      </div>

      {/* From Draft Picks */}
      <div className="mb-4">
        <label className="block mb-1">From Draft Pick(s):</label>
        <select
          multiple
          value={fromDraftPicks}
          onChange={(e) =>
            setFromDraftPicks(Array.from(e.target.selectedOptions, (opt) => opt.value))
          }
          className="border p-2 w-full"
        >
          {fromTeamDraftPicks.map((pick, idx) => (
            <option
              key={`${pick.year}-${pick.round}-${pick.team}-${idx}`}
              value={`${pick.year}-${pick.round}`}
            >
              {`Year ${pick.year}, Round ${pick.round}`}
            </option>
          ))}
        </select>
      </div>

      {/* To Draft Picks */}
      <div className="mb-4">
        <label className="block mb-1">To Draft Pick(s) (optional):</label>
        <select
          multiple
          value={toDraftPicks}
          onChange={(e) =>
            setToDraftPicks(Array.from(e.target.selectedOptions, (opt) => opt.value))
          }
          className="border p-2 w-full"
        >
          {toTeamDraftPicks.map((pick, idx) => (
            <option
              key={`${pick.year}-${pick.round}-${pick.team}-${idx}`}
              value={`${pick.year}-${pick.round}`}
            >
              {`Year ${pick.year}, Round ${pick.round}`}
            </option>
          ))}
        </select>
      </div>

      <button
        onClick={handleTrade}
        className="bg-blue-500 text-white px-4 py-2 rounded"
      >
        Submit Trade
      </button>

      {status && <p className="mt-4">{status}</p>}
    </div>
  );
}
