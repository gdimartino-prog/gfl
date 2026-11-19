import type {
  PollActiveTeam,
  PollItem,
  PollOptionView,
  PollOutcome,
  PollStatus,
  PollType,
  PollVoterSummary,
} from '@/types';

export const RULE_CHANGE_DEFAULT_DAYS = 14;
export const REMINDER_COOLDOWN_MS = 12 * 60 * 60 * 1000;
export const POLL_MIN_OPTIONS = 2;
export const POLL_MAX_OPTIONS = 10;

export class PollHttpError extends Error {
  constructor(public readonly status: number, message: string) {
    super(message);
    this.name = 'PollHttpError';
  }
}

export function parsePositiveInt(raw: unknown): number | null {
  if (typeof raw === 'number') {
    return Number.isInteger(raw) && raw > 0 ? raw : null;
  }
  if (typeof raw === 'string') {
    const trimmed = raw.trim();
    if (!/^\d+$/.test(trimmed)) return null;
    const n = Number(trimmed);
    return Number.isSafeInteger(n) && n > 0 ? n : null;
  }
  return null;
}

export function validatePollOptionsList(
  raw: unknown,
): { ok: true; options: string[] } | { ok: false; error: string } {
  if (!Array.isArray(raw)) {
    return { ok: false, error: 'Options must be an array' };
  }
  const cleaned: string[] = [];
  const seen = new Set<string>();
  for (const item of raw) {
    if (typeof item !== 'string') {
      return { ok: false, error: 'Each option must be text' };
    }
    const trimmed = item.trim();
    if (!trimmed) {
      return { ok: false, error: 'Empty options are not allowed' };
    }
    if (trimmed.length > 200) {
      return { ok: false, error: 'Each option must be 200 characters or fewer' };
    }
    const key = trimmed.toLowerCase();
    if (seen.has(key)) {
      return { ok: false, error: 'Poll options must be unique' };
    }
    seen.add(key);
    cleaned.push(trimmed);
  }
  if (cleaned.length < POLL_MIN_OPTIONS || cleaned.length > POLL_MAX_OPTIONS) {
    return {
      ok: false,
      error: `Provide between ${POLL_MIN_OPTIONS} and ${POLL_MAX_OPTIONS} choices`,
    };
  }
  return { ok: true, options: cleaned };
}

export function parseEffectiveSeason(
  raw: unknown,
): { ok: true; value: number | null } | { ok: false; error: string } {
  if (raw === undefined || raw === null || raw === '') {
    return { ok: true, value: null };
  }
  const n = typeof raw === 'number' ? raw : typeof raw === 'string' && /^\d{4}$/.test(raw.trim()) ? Number(raw.trim()) : NaN;
  if (!Number.isInteger(n) || n < 1990 || n > 2100) {
    return { ok: false, error: 'Effective season must be a 4-digit year (1990–2100)' };
  }
  return { ok: true, value: n };
}

export function parseFutureDate(
  raw: unknown,
  now: Date = new Date(),
): { ok: true; date: Date } | { ok: false; error: string } {
  if (typeof raw !== 'string' || !raw.trim()) {
    return { ok: false, error: 'Close date/time is required' };
  }
  const d = new Date(raw);
  if (Number.isNaN(d.getTime())) {
    return { ok: false, error: 'Invalid close date/time' };
  }
  if (d.getTime() <= now.getTime()) {
    return { ok: false, error: 'Close date/time must be in the future' };
  }
  return { ok: true, date: d };
}

export function toIsoString(val: Date | string): string {
  return val instanceof Date ? val.toISOString() : new Date(val).toISOString();
}

export function toDate(val: Date | string): Date {
  return val instanceof Date ? val : new Date(val);
}

/**
 * Constitution E12: rule-change polls default to a 14-day (two-week) close window.
 */
export function defaultRuleChangeClosesAt(from: Date = new Date()): Date {
  return new Date(from.getTime() + RULE_CHANGE_DEFAULT_DAYS * 86_400_000);
}

/**
 * Constitution E13: at least half the league members must vote (>= ceil(eligible / 2)).
 */
export function calculateQuorumRequired(eligibleTeams: number): number {
  return eligibleTeams <= 0 ? 0 : Math.ceil(eligibleTeams / 2);
}

/**
 * Constitution E11: >2-choice polls require 50% + 1 vote (floor(totalVotes / 2) + 1).
 */
export function calculateMajorityRequired(totalVotes: number): number {
  return totalVotes <= 0 ? 0 : Math.floor(totalVotes / 2) + 1;
}

/**
 * Voting is open only when status is 'open' and current time is strictly before closesAt.
 */
export function isPollVotingOpen(
  status: PollStatus,
  closesAt: Date | string,
  now: Date = new Date(),
): boolean {
  if (status !== 'open') return false;
  return now.getTime() < toDate(closesAt).getTime();
}

/**
 * Constitution E10: enacted vote results stay effective for at least one completed season.
 */
export function isUnderE10Lock(
  effectiveSeason: number | null,
  currentSeason: number | null,
): boolean {
  return effectiveSeason != null && currentSeason != null && currentSeason <= effectiveSeason;
}

export interface PollOutcomeInput {
  pollType: PollType;
  options: { id: number; sortOrder: number }[];
  voteCounts: Record<number, number> | Map<number, number>;
  eligibleTeamCount: number;
}

function readVoteCount(voteCounts: Record<number, number> | Map<number, number>, optionId: number): number {
  if (voteCounts instanceof Map) {
    return voteCounts.get(optionId) ?? 0;
  }
  return voteCounts[optionId] ?? 0;
}

/**
 * Evaluates a poll's official outcome under Constitution E11 & E13 (for rule changes)
 * or simple plurality (for general polls).
 */
export function evaluatePollOutcome({
  pollType,
  options,
  voteCounts,
  eligibleTeamCount,
}: PollOutcomeInput): PollOutcome {
  const sorted = [...options]
    .map((o) => ({
      id: o.id,
      sortOrder: o.sortOrder,
      votes: readVoteCount(voteCounts, o.id),
    }))
    .sort((a, b) => b.votes - a.votes || a.sortOrder - b.sortOrder);

  const totalVotes = sorted.reduce((sum, o) => sum + o.votes, 0);
  const quorumRequired = calculateQuorumRequired(eligibleTeamCount);
  const quorumMet = totalVotes > 0 && totalVotes >= quorumRequired;
  const majorityRequired =
    pollType === 'rule_change' && sorted.length > 2
      ? calculateMajorityRequired(totalVotes)
      : null;

  if (pollType === 'rule_change') {
    if (!quorumMet) {
      return {
        status: 'null_quorum',
        winnerOptionId: null,
        totalVotes,
        quorumRequired,
        quorumMet: false,
        majorityRequired,
        suggestedRunoffOptionIds: [],
        hasRunoffTie: false,
        tiedAtCutoffOptionIds: [],
      };
    }

    if (sorted.length <= 2) {
      const top = sorted[0];
      const second = sorted[1];
      if (top && (!second || top.votes > second.votes)) {
        return {
          status: 'closed',
          winnerOptionId: top.id,
          totalVotes,
          quorumRequired,
          quorumMet: true,
          majorityRequired: null,
          suggestedRunoffOptionIds: [],
          hasRunoffTie: false,
          tiedAtCutoffOptionIds: [],
        };
      }
      return {
        status: 'tied',
        winnerOptionId: null,
        totalVotes,
        quorumRequired,
        quorumMet: true,
        majorityRequired: null,
        suggestedRunoffOptionIds: [],
        hasRunoffTie: false,
        tiedAtCutoffOptionIds: [],
      };
    }

    // >2 options: Constitution E11 requires 50% + 1 (floor(V / 2) + 1), else top-2 runoff
    const reqVotes = calculateMajorityRequired(totalVotes);
    const top = sorted[0];
    if (top && top.votes >= reqVotes) {
      return {
        status: 'closed',
        winnerOptionId: top.id,
        totalVotes,
        quorumRequired,
        quorumMet: true,
        majorityRequired: reqVotes,
        suggestedRunoffOptionIds: [],
        hasRunoffTie: false,
        tiedAtCutoffOptionIds: [],
      };
    }

    const secondVotes = sorted[1]?.votes ?? 0;
    const hasRunoffTie = sorted.length > 2 && secondVotes === sorted[2].votes;
    const tiedAtCutoffOptionIds = hasRunoffTie
      ? sorted.filter((o) => o.votes === secondVotes).map((o) => o.id)
      : [];
    const suggestedRunoffOptionIds =
      hasRunoffTie || sorted.length < 2 ? [] : [sorted[0].id, sorted[1].id];

    return {
      status: 'runoff_needed',
      winnerOptionId: null,
      totalVotes,
      quorumRequired,
      quorumMet: true,
      majorityRequired: reqVotes,
      suggestedRunoffOptionIds,
      hasRunoffTie,
      tiedAtCutoffOptionIds,
    };
  }

  // General poll: simple plurality wins, top tie -> 'tied', 0 votes -> closed without winner
  if (totalVotes === 0 || sorted.length === 0) {
    return {
      status: 'closed',
      winnerOptionId: null,
      totalVotes,
      quorumRequired,
      quorumMet,
      majorityRequired: null,
      suggestedRunoffOptionIds: [],
      hasRunoffTie: false,
      tiedAtCutoffOptionIds: [],
    };
  }

  if (sorted.length > 1 && sorted[0].votes === sorted[1].votes) {
    return {
      status: 'tied',
      winnerOptionId: null,
      totalVotes,
      quorumRequired,
      quorumMet,
      majorityRequired: null,
      suggestedRunoffOptionIds: [],
      hasRunoffTie: false,
      tiedAtCutoffOptionIds: [],
    };
  }

  return {
    status: 'closed',
    winnerOptionId: sorted[0].id,
    totalVotes,
    quorumRequired,
    quorumMet,
    majorityRequired: null,
    suggestedRunoffOptionIds: [],
    hasRunoffTie: false,
    tiedAtCutoffOptionIds: [],
  };
}

export interface RawPollRecord {
  id: number;
  leagueId: number;
  title: string;
  description: string | null;
  pollType: string;
  status: string;
  effectiveSeason: number | null;
  constitutionRef: string | null;
  parentPollId: number | null;
  winnerOptionId: number | null;
  eligibleTeamCount: number | null;
  closesAt: Date | string;
  closedAt: Date | string | null;
  lastReminderAt: Date | string | null;
  createdAt: Date | string;
  createdBy: string;
}

export interface RawPollOptionRecord {
  id: number;
  pollId: number;
  label: string;
  sortOrder: number;
}

export interface RawPollVoteRecord {
  pollId: number;
  optionId: number;
  teamId: number;
  isProxy: boolean;
  votedAt: Date | string;
}

function normalizePollType(raw: string): PollType {
  return raw === 'general' ? 'general' : 'rule_change';
}

function normalizePollStatus(raw: string): PollStatus {
  if (
    raw === 'open' ||
    raw === 'closed' ||
    raw === 'runoff_needed' ||
    raw === 'null_quorum' ||
    raw === 'tied'
  ) {
    return raw;
  }
  return 'open';
}

/**
 * Projects a raw poll + options + votes into a viewer-safe PollItem.
 * Enforces ballot privacy: while `status === 'open' && now < closesAt`,
 * all option vote counts, percentages, and individual voters are stripped,
 * while preserving the caller's own `myVoteOptionId` and the Voted / Not Yet Voted roll call.
 */
export function sanitizePollForViewer({
  poll,
  options,
  votes,
  activeTeams,
  teamsById,
  viewerTeamId,
  childRunoffPollId = null,
  currentSeason = null,
  now = new Date(),
}: {
  poll: RawPollRecord;
  options: RawPollOptionRecord[];
  votes: RawPollVoteRecord[];
  activeTeams: PollActiveTeam[];
  teamsById?: Map<number, PollActiveTeam>;
  viewerTeamId: number | null;
  childRunoffPollId?: number | null;
  currentSeason?: number | null;
  now?: Date;
}): PollItem {
  const pollType = normalizePollType(poll.pollType);
  const status = normalizePollStatus(poll.status);
  const sortedOptions = [...options].sort((a, b) => a.sortOrder - b.sortOrder || a.id - b.id);

  const teamLookup =
    teamsById ?? new Map<number, PollActiveTeam>(activeTeams.map((t) => [t.id, t]));

  const eligibleTeamCount =
    status !== 'open' && poll.eligibleTeamCount != null
      ? poll.eligibleTeamCount
      : activeTeams.length;

  const isVotingOpen = isPollVotingOpen(status, poll.closesAt, now);
  const isExpiredPendingFinalization = status === 'open' && !isVotingOpen;
  const choicesHidden = isVotingOpen;

  const votesByTeam = new Map<number, RawPollVoteRecord>();
  const voteCounts = new Map<number, number>();
  const votersByOption = new Map<number, PollVoterSummary[]>();

  for (const v of votes) {
    votesByTeam.set(v.teamId, v);
    voteCounts.set(v.optionId, (voteCounts.get(v.optionId) ?? 0) + 1);

    const team = teamLookup.get(v.teamId);
    const voterSummary: PollVoterSummary = {
      teamId: v.teamId,
      teamName: team?.name ?? `Team #${v.teamId}`,
      teamshort: team?.teamshort ?? '',
      coach: team?.coach ?? '',
      isProxy: v.isProxy,
      votedAt: toIsoString(v.votedAt),
    };
    const arr = votersByOption.get(v.optionId);
    if (arr) arr.push(voterSummary);
    else votersByOption.set(v.optionId, [voterSummary]);
  }

  const votedTeams: PollVoterSummary[] = [];
  const nonVotedTeams: PollActiveTeam[] = [];

  for (const team of activeTeams) {
    const cast = votesByTeam.get(team.id);
    if (cast) {
      votedTeams.push({
        teamId: team.id,
        teamName: team.name,
        teamshort: team.teamshort,
        coach: team.coach,
        isProxy: cast.isProxy,
        votedAt: toIsoString(cast.votedAt),
      });
    } else {
      nonVotedTeams.push(team);
    }
  }

  // Include any non-active team that already cast a vote prior to inactivation
  const activeIds = new Set(activeTeams.map((t) => t.id));
  for (const [teamId, cast] of votesByTeam.entries()) {
    if (!activeIds.has(teamId)) {
      const team = teamLookup.get(teamId);
      votedTeams.push({
        teamId,
        teamName: team?.name ?? `Team #${teamId}`,
        teamshort: team?.teamshort ?? '',
        coach: team?.coach ?? '',
        isProxy: cast.isProxy,
        votedAt: toIsoString(cast.votedAt),
      });
    }
  }

  const votesCast = votes.length;
  const quorumRequired = calculateQuorumRequired(eligibleTeamCount);
  const quorumMet = votesCast > 0 && votesCast >= quorumRequired;
  const majorityRequired =
    pollType === 'rule_change' && sortedOptions.length > 2
      ? calculateMajorityRequired(votesCast)
      : null;

  const myVote = viewerTeamId != null ? votesByTeam.get(viewerTeamId) : undefined;
  const myVoteOptionId = myVote?.optionId ?? null;

  const computedOutcome = choicesHidden
    ? null
    : evaluatePollOutcome({
        pollType,
        options: sortedOptions.map((o) => ({ id: o.id, sortOrder: o.sortOrder })),
        voteCounts,
        eligibleTeamCount,
      });

  const optionViews: PollOptionView[] = sortedOptions.map((opt) => {
    if (choicesHidden) {
      return {
        id: opt.id,
        label: opt.label,
        sortOrder: opt.sortOrder,
        voteCount: null,
        percentage: null,
        voters: [],
      };
    }

    const count = voteCounts.get(opt.id) ?? 0;
    const pct = votesCast > 0 ? Math.round((count / votesCast) * 1000) / 10 : 0;
    const optionVoters = [...(votersByOption.get(opt.id) ?? [])].sort((a, b) =>
      a.teamName.localeCompare(b.teamName),
    );

    return {
      id: opt.id,
      label: opt.label,
      sortOrder: opt.sortOrder,
      voteCount: count,
      percentage: pct,
      voters: optionVoters,
    };
  });

  return {
    id: poll.id,
    leagueId: poll.leagueId,
    title: poll.title,
    description: poll.description,
    pollType,
    status,
    effectiveSeason: poll.effectiveSeason,
    constitutionRef: poll.constitutionRef,
    parentPollId: poll.parentPollId,
    childRunoffPollId,
    winnerOptionId: poll.winnerOptionId,
    eligibleTeamCount,
    quorumRequired,
    majorityRequired,
    votesCast,
    quorumMet,
    isVotingOpen,
    isExpiredPendingFinalization,
    choicesHidden,
    computedOutcome,
    e10Locked:
      pollType === 'rule_change' &&
      status === 'closed' &&
      poll.winnerOptionId != null &&
      isUnderE10Lock(poll.effectiveSeason, currentSeason),
    closesAt: toIsoString(poll.closesAt),
    closedAt: poll.closedAt ? toIsoString(poll.closedAt) : null,
    lastReminderAt: poll.lastReminderAt ? toIsoString(poll.lastReminderAt) : null,
    createdAt: toIsoString(poll.createdAt),
    createdBy: poll.createdBy,
    myVoteOptionId,
    options: optionViews,
    votedTeams,
    nonVotedTeams,
  };
}
