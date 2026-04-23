import { db } from './db';
import { players, teams, schedule, standings, rules, draftPicks, tradeBlock } from '@/schema';
import { eq, and, inArray, isNotNull } from 'drizzle-orm';
import Papa from "papaparse";
import { revalidateTag } from 'next/cache';
import { buildPlayerIdentity } from './playerUtils';

type TeamRow = { id: number; name: string; teamshort: string | null; coach?: string | null };

function findTeam(allTeams: TeamRow[], nameStr: string): TeamRow | null {
  const upper = nameStr.trim().toUpperCase();
  // Exact teamshort match
  const byShort = allTeams.find(t => t.teamshort?.toUpperCase() === upper);
  if (byShort) return byShort;
  // Team name starts with the search string
  const byStart = allTeams.find(t => t.name.toUpperCase().startsWith(upper));
  if (byStart) return byStart;
  // Search string starts with team name
  const byPrefix = allTeams.find(t => upper.startsWith(t.name.toUpperCase()));
  return byPrefix ?? null;
}

export async function processPlayersFile(
  fileContent: string,
  leagueId: number = 1,
  onProgress?: (current: number, total: number) => void,
) {
  const parseResult = Papa.parse(fileContent, { header: true, skipEmptyLines: true });
  const rows = parseResult.data as Record<string, string>[];

  // Filter out rows where all position columns are blank
  const validRows = rows.filter(row => {
    const off = (row['offense'] || row['Offense'] || '').trim();
    const def = (row['defense'] || row['Defense'] || '').trim();
    const spec = (row['special'] || row['Special'] || '').trim();
    return off || def || spec;
  });

  if (validRows.length === 0) {
    return { success: false, message: "No valid player data found in file." };
  }

  const allTeams = await db.select({ id: teams.id, name: teams.name, teamshort: teams.teamshort }).from(teams).where(eq(teams.leagueId, leagueId));

  const scoutingWhitelist = [
    'uniform', 'run block', 'pass block', 'run defense', 'pass defense',
    'pass rush', 'total defense', 'breakaway', 'short yardage', 'audible',
    'pressure', 'receiving', 'durability', 'salary', 'years', 'games',
    'rush attempts', 'rush yards', 'rush long', 'rush TD', 'receptions',
    'receiving yards', 'receiving TD', 'receiving long', 'pass attempts',
    'completions', 'pass yards', 'pass interceptions', 'pass TD',
    'interceptions', 'tackles', 'sacks', 'stuffs',
    // Kicker stats (actual CSV column names)
    'field goal attempts', 'field goals made', 'field goals long',
    'extra point attempts', 'extra points made',
    // Punter stats (actual CSV column names; 'punt inside 20' matches 'punt Inside 20' via ci lookup)
    'punts', 'punt yards', 'punt long', 'punt inside 20',
  ];

  const ol_positions = ['C', 'G', 'OT', 'OG', 'OC'];

  const playerValues = validRows.map(row => {
    // Build a fully case-insensitive key map so column names like 'punt Inside 20' resolve correctly
    const lowerRow: Record<string, string> = {};
    for (const k of Object.keys(row)) lowerRow[k.toLowerCase()] = row[k];
    const v = (key: string) => (lowerRow[key.toLowerCase()] ?? '').trim();

    const first = v('first');
    const last = v('last');
    const name = `${first} ${last}`.trim();
    if (!name) return null;

    const age = parseInt(v('age'), 10) || 0;
    const off = v('offense');
    const def = v('defense');
    const spec = v('special');
    const position = [off, def, spec].filter(x => x && x !== '0').join('/') || null;

    const teamCode = v('team');
    const team = teamCode ? findTeam(allTeams, teamCode) : null;

    // Overall rating (matches parsePlayers logic)
    const parseNum = (k: string) => Number(v(k)) || 0;
    const parseSalary = (k: string) => Number(String(v(k) || '0').replace(/[$,]/g, '')) || 0;
    const skill_positions = ['WR', 'TE', 'RB', 'HB', 'FB'];
    let overallRating = 0;
    if (def) overallRating = parseNum('total defense');
    else if (off && ol_positions.includes(off.toUpperCase())) overallRating = parseNum('run block') + parseNum('pass block');
    else if (off && skill_positions.includes(off.toUpperCase())) overallRating = parseNum('receiving');
    else overallRating = parseSalary('salary');

    const scouting: Record<string, string> = {};
    for (const key of scoutingWhitelist) {
      scouting[key] = v(key);
    }

    return {
      name,
      first,
      last,
      age: age || null,
      position,
      offense: off || null,
      defense: def || null,
      special: spec || null,
      identity: buildPlayerIdentity({ first, last, age, offense: off, defense: def, special: spec }),
      isIR: teamCode.toUpperCase().includes('-IR'),
      overall: String(overallRating) || null,
      runBlock: v('run block') || null,
      passBlock: v('pass block') || null,
      rushYards: v('rush yards') || null,
      interceptionsVal: v('interceptions') || null,
      sacksVal: v('sacks') || null,
      durability: v('durability') || null,
      scouting,
      leagueId,
      teamId: team?.id ?? null,
      touch_id: 'maintenance',
    };
  }).filter((p): p is NonNullable<typeof p> => p !== null);

  // Upsert by identity so draft pick playerId refs remain valid across re-syncs.
  // 1. Fetch existing players
  const existingPlayers = await db
    .select({ id: players.id, identity: players.identity, teamId: players.teamId })
    .from(players)
    .where(eq(players.leagueId, leagueId));
  const existingByIdentity = new Map(
    existingPlayers.filter(p => p.identity).map(p => [p.identity!, { id: p.id, teamId: p.teamId }])
  );

  // 2. Fetch player IDs currently referenced by draft picks (already drafted)
  const draftedRows = await db
    .select({ playerId: draftPicks.playerId })
    .from(draftPicks)
    .where(and(eq(draftPicks.leagueId, leagueId), isNotNull(draftPicks.playerId)));
  const draftedPlayerIds = new Set(draftedRows.map(r => r.playerId!));

  // 3. Upsert each player from the file
  const fileIdentities = new Set<string>();
  const movedPlayerIds: number[] = [];
  for (let i = 0; i < playerValues.length; i++) {
    const p = playerValues[i];
    if (p.identity) fileIdentities.add(p.identity);
    const existing = p.identity ? existingByIdentity.get(p.identity) : undefined;
    if (existing) {
      if (existing.teamId !== p.teamId) movedPlayerIds.push(existing.id);
      await db.update(players).set(p).where(eq(players.id, existing.id));
    } else {
      await db.insert(players).values(p);
    }
    if (onProgress) onProgress(i + 1, playerValues.length);
  }

  // Remove trade block entries for players whose team changed during sync
  if (movedPlayerIds.length > 0) {
    await db.delete(tradeBlock).where(
      and(eq(tradeBlock.leagueId, leagueId), inArray(tradeBlock.playerId, movedPlayerIds.map(String)))
    );
  }

  // 4. Remove players no longer in file, but only if not referenced by a draft pick
  const toRemove = existingPlayers
    .filter(p => p.identity && !fileIdentities.has(p.identity) && !draftedPlayerIds.has(p.id))
    .map(p => p.id);
  if (toRemove.length > 0) {
    await db.delete(players).where(inArray(players.id, toRemove));
  }

  // Update player_sync timestamp in rules table
  const now = new Intl.DateTimeFormat('en-US', {
    year: 'numeric', month: '2-digit', day: '2-digit',
    hour: '2-digit', minute: '2-digit', second: '2-digit',
    timeZone: 'America/New_York',
  }).format(new Date());

  await db.update(rules)
    .set({ value: now, touch_id: 'maintenance' })
    .where(and(eq(rules.rule, 'player_sync'), eq(rules.leagueId, leagueId)));

  revalidateTag('players', 'max');

  return { success: true, message: `Successfully synced ${playerValues.length} players.` };
}

export async function processScheduleFile(fileContent: string, leagueId: number = 1) {
  const lines = fileContent.split(/\r?\n/);
  const firstLine = lines[0] || "";

  if (!firstLine.toUpperCase().includes("SCHEDULE")) {
    return { success: false, message: "Invalid file format: Not a schedule file." };
  }

  const yearMatch = firstLine.match(/\d{4}/);
  let year: number | null = yearMatch ? parseInt(yearMatch[0], 10) : null;

  // Fall back to cuts_year rule if year not in header
  if (!year) {
    const rulesRow = await db.select({ value: rules.value })
      .from(rules)
      .where(and(eq(rules.rule, 'cuts_year'), eq(rules.leagueId, leagueId)))
      .limit(1);
    year = rulesRow[0]?.value ? parseInt(rulesRow[0].value, 10) || null : null;
  }

  const allTeams = await db.select({ id: teams.id, name: teams.name, teamshort: teams.teamshort }).from(teams).where(eq(teams.leagueId, leagueId));

  let updateCount = 0;
  let insertCount = 0;

  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed || !trimmed.includes("@")) continue;

    const match = trimmed.match(/^(\d+)\s+(.+?)\s+@\s+(.+?)(?:\s+(\d+-\d+))?$/);
    if (!match) continue;

    try {
      const week = parseInt(match[1], 10);
      const visitorName = match[2].trim();
      const homeName = match[3].trim();
      const scorePart = match[4];

      const homeTeam = findTeam(allTeams, homeName);
      const awayTeam = findTeam(allTeams, visitorName);

      if (!homeTeam || !awayTeam) {
        console.warn(`Could not match teams: "${visitorName}" @ "${homeName}"`);
        continue;
      }

      let homeScore: number | null = null;
      let awayScore: number | null = null;

      if (scorePart) {
        const scores = scorePart.split("-");
        awayScore = parseInt(scores[0], 10);
        homeScore = parseInt(scores[1], 10);
      }

      const existing = await db.select()
        .from(schedule)
        .where(and(
          eq(schedule.leagueId, leagueId),
          eq(schedule.week, String(week)),
          eq(schedule.homeTeamId, homeTeam.id),
          eq(schedule.awayTeamId, awayTeam.id),
          year !== null ? eq(schedule.year, year) : undefined,
        ))
        .limit(1);

      if (existing.length > 0) {
        const game = existing[0];
        // Already has scores (Final) — skip
        if (game.home_score !== null) continue;
        // Update with scores if provided
        if (homeScore !== null) {
          await db.update(schedule)
            .set({ home_score: homeScore, away_score: awayScore, touch_id: 'maintenance' })
            .where(eq(schedule.id, game.id));
          updateCount++;
        }
      } else {
        await db.insert(schedule).values([{
          leagueId,
          year,
          week: String(week),
          homeTeamId: homeTeam.id,
          awayTeamId: awayTeam.id,
          home_score: homeScore,
          away_score: awayScore,
          is_bye: false,
          touch_id: 'maintenance',
        }]);
        insertCount++;
      }
    } catch (e) {
      console.error(`Failed to parse line: "${trimmed}"`, e);
    }
  }

  revalidateTag('schedule', 'max');

  return { success: true, message: `Import Complete. Updated: ${updateCount}, Inserted: ${insertCount}` };
}

export async function processStandingsFile(fileContent: string, leagueId: number = 1) {
  const lines = fileContent.split('\n');
  const firstLine = lines[0] || "";

  if (!firstLine.toUpperCase().includes("STANDING")) {
    return { success: false, message: "Invalid file format: Not a standings file." };
  }

  const yearMatch = firstLine.match(/\d{4}/);
  const year = yearMatch ? parseInt(yearMatch[0], 10) : new Date().getFullYear();

  const allTeams = await db.select({ id: teams.id, name: teams.name, teamshort: teams.teamshort, coach: teams.coach }).from(teams).where(eq(teams.leagueId, leagueId));

  const rowsToInsert: { leagueId: number; teamId: number; year: number; wins: number; losses: number; ties: number; division: string | null; coachName: string | null; touch_id: string }[] = [];
  const unmatchedTeams: string[] = [];
  let currentDivision: string | null = null;

  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed) continue;

    const upper = trimmed.toUpperCase();

    if (/W\s+L\s+T/.test(upper)) {
      // Match division name as everything before "W  L  T" header
      const divMatch = trimmed.match(/^(.+?)\s+W\s+L\s+T\b/i);
      const divName = divMatch?.[1]?.trim();
      if (divName) currentDivision = divName;
      continue;
    }

    if (
      upper.includes("GFL") ||
      upper.includes("STANDINGS") ||
      upper.includes("AVERAGE") ||
      upper.includes("TOTAL") ||
      upper.includes("INJURIES")
    ) continue;

    const parts = trimmed.split(/\s+/);
    const firstDigitIndex = parts.findIndex((p, i) => i > 0 && /^-?\d+/.test(p));
    if (firstDigitIndex === -1) continue;

    const rawTeamCity = parts.slice(0, firstDigitIndex).join(" ");
    // Strip playoff clinch prefixes (x-, y-, z-) used in standings exports
    const teamCity = rawTeamCity.replace(/^[xyz]-/i, '').trim();
    const stats = parts.slice(firstDigitIndex);
    if (stats.length < 3) continue;

    const team = findTeam(allTeams, teamCity);
    if (!team) {
      unmatchedTeams.push(teamCity);
      continue;
    }

    rowsToInsert.push({
      leagueId,
      teamId: team.id,
      year,
      wins: parseInt(stats[0], 10) || 0,
      losses: parseInt(stats[1], 10) || 0,
      ties: parseInt(stats[2], 10) || 0,
      division: currentDivision,
      coachName: team.coach ?? null,
      touch_id: 'maintenance',
    });
  }

  if (rowsToInsert.length === 0) {
    const dbTeamNames = allTeams.map(t => t.teamshort || t.name).join(', ');
    const failedNames = unmatchedTeams.join(', ') || 'none parsed';
    return { success: false, message: `No valid standings data found. Teams in DB (leagueId=${leagueId}): [${dbTeamNames}]. Teams from file that failed to match: [${failedNames}].` };
  }

  // Delete existing standings for this year and league, then re-insert
  await db.delete(standings).where(and(eq(standings.leagueId, leagueId), eq(standings.year, year)));
  await db.insert(standings).values(rowsToInsert);

  revalidateTag('standings', 'max');

  return { success: true, message: `Successfully synced ${rowsToInsert.length} teams for ${year}.` };
}
