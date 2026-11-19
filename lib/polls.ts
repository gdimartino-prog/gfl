import type { Session } from 'next-auth';
import { NextResponse } from 'next/server';
import { unstable_cache } from 'next/cache';
import { and, asc, desc, eq, sql } from 'drizzle-orm';
import { auth } from '@/auth';
import { db } from './db';
import { isPrivileged } from './auth';
import { getLeagueId } from './getLeagueId';
import { pollOptions, pollVotes, polls, rules, teams } from '@/schema';
import {
  PollHttpError,
  sanitizePollForViewer,
  type RawPollOptionRecord,
  type RawPollRecord,
  type RawPollVoteRecord,
} from './pollRules';
import type { PollActiveTeam, PollsPayload } from '@/types';

type SessionUserLike = {
  id?: string;
  name?: string | null;
  role?: string;
  team?: string;
  leagueId?: number;
};

export function isDemoUser(session: Session | null): boolean {
  const user = session?.user as SessionUserLike | undefined;
  return user?.role === 'demo';
}

export function getActorIdentity(session: Session | null): {
  actorName: string;
  actorTeam: string;
  touchId: string;
} {
  const user = session?.user as SessionUserLike | undefined;
  const actorName = user?.name?.trim() || 'Commissioner';
  const actorTeam = user?.team?.trim() || user?.id?.trim() || 'System';
  const touchId = user?.id?.trim() || actorName;
  return { actorName, actorTeam, touchId };
}

/**
 * Auth/role/tenancy preflight for poll mutation routes.
 * Always rejects unauthenticated callers (401), demo users (403, even though
 * demo team VV has isCommissioner=true in League 2), and non-commissioners when
 * `requireCommissioner` is true (403).
 */
export async function requirePollMutationAccess(requireCommissioner = true): Promise<
  | { ok: true; session: Session; leagueId: number }
  | { ok: false; response: NextResponse }
> {
  const session = await auth();
  if (!session?.user) {
    return { ok: false, response: NextResponse.json({ message: 'Unauthorized' }, { status: 401 }) };
  }
  if (isDemoUser(session)) {
    return { ok: false, response: NextResponse.json({ message: 'Demo account is read-only' }, { status: 403 }) };
  }
  if (requireCommissioner && !(await isPrivileged())) {
    return { ok: false, response: NextResponse.json({ message: 'Commissioner only (Rule E9)' }, { status: 403 }) };
  }
  const leagueId = await getLeagueId();
  return { ok: true, session, leagueId };
}

export function toPollErrorResponse(error: unknown, label: string, fallbackMessage: string): NextResponse {
  if (error instanceof PollHttpError) {
    return NextResponse.json({ message: error.message }, { status: error.status });
  }
  console.error(`[${label}]`, error);
  return NextResponse.json({ message: fallbackMessage }, { status: 500 });
}

/**
 * Resolves the active team record in `leagueId` that belongs to the current user.
 * Follows the exact cross-league email-anchor rule from lib/getLeagueId.ts (never
 * matches cross-league identity on bare teamshort). Returns null for superuser,
 * demo, or coaches without an active team in `leagueId`.
 */
export async function resolveCallerTeam(
  session: Session | null,
  leagueId: number,
): Promise<PollActiveTeam | null> {
  const user = session?.user as SessionUserLike | undefined;
  if (!user) return null;

  const role = user.role;
  if (role === 'superuser' || role === 'demo') return null;

  const teamshort = user.id?.trim();
  if (!teamshort) return null;

  const homeLeagueId = user.leagueId ?? 1;

  if (homeLeagueId === leagueId) {
    const rows = await db
      .select({
        id: teams.id,
        name: teams.name,
        teamshort: teams.teamshort,
        coach: teams.coach,
      })
      .from(teams)
      .where(
        and(
          eq(teams.leagueId, leagueId),
          sql`upper(${teams.teamshort}) = ${teamshort.toUpperCase()}`,
          eq(teams.status, 'active'),
        ),
      )
      .limit(1);

    const hit = rows[0];
    if (!hit) return null;
    return {
      id: hit.id,
      name: hit.name,
      teamshort: hit.teamshort ?? '',
      coach: hit.coach ?? '',
    };
  }

  // Cross-league login: anchor identity via home team's email + password check
  const homeRows = await db
    .select({ email: teams.email })
    .from(teams)
    .where(
      and(
        eq(teams.leagueId, homeLeagueId),
        sql`upper(${teams.teamshort}) = ${teamshort.toUpperCase()}`,
        eq(teams.status, 'active'),
      ),
    )
    .limit(1);

  const email = homeRows[0]?.email?.trim().toLowerCase();
  if (!email) return null;

  const targetRows = await db
    .select({
      id: teams.id,
      name: teams.name,
      teamshort: teams.teamshort,
      coach: teams.coach,
    })
    .from(teams)
    .where(
      and(
        eq(teams.leagueId, leagueId),
        sql`lower(${teams.email}) = ${email}`,
        sql`${teams.password} IS NOT NULL`,
        eq(teams.status, 'active'),
      ),
    )
    .limit(1);

  const hit = targetRows[0];
  if (!hit) return null;
  return {
    id: hit.id,
    name: hit.name,
    teamshort: hit.teamshort ?? '',
    coach: hit.coach ?? '',
  };
}

interface RawLeaguePollsBundle {
  polls: RawPollRecord[];
  options: RawPollOptionRecord[];
  votes: RawPollVoteRecord[];
  teams: {
    id: number;
    name: string;
    teamshort: string;
    coach: string;
    status: string;
  }[];
  currentSeason: number | null;
}

const _getPollsRaw = unstable_cache(
  async (leagueId: number): Promise<RawLeaguePollsBundle> => {
    const [pollRows, optionRows, voteRows, teamRows, seasonRows] = await Promise.all([
      db
        .select({
          id: polls.id,
          leagueId: polls.leagueId,
          title: polls.title,
          description: polls.description,
          pollType: polls.pollType,
          status: polls.status,
          effectiveSeason: polls.effectiveSeason,
          constitutionRef: polls.constitutionRef,
          parentPollId: polls.parentPollId,
          winnerOptionId: polls.winnerOptionId,
          eligibleTeamCount: polls.eligibleTeamCount,
          closesAt: polls.closesAt,
          closedAt: polls.closedAt,
          lastReminderAt: polls.lastReminderAt,
          createdAt: polls.createdAt,
          createdBy: polls.createdBy,
        })
        .from(polls)
        .where(eq(polls.leagueId, leagueId))
        .orderBy(desc(polls.createdAt), desc(polls.id)),
      db
        .select({
          id: pollOptions.id,
          pollId: pollOptions.pollId,
          label: pollOptions.label,
          sortOrder: pollOptions.sortOrder,
        })
        .from(pollOptions)
        .where(eq(pollOptions.leagueId, leagueId))
        .orderBy(asc(pollOptions.sortOrder), asc(pollOptions.id)),
      db
        .select({
          pollId: pollVotes.pollId,
          optionId: pollVotes.optionId,
          teamId: pollVotes.teamId,
          isProxy: pollVotes.isProxy,
          votedAt: pollVotes.votedAt,
        })
        .from(pollVotes)
        .where(eq(pollVotes.leagueId, leagueId)),
      db
        .select({
          id: teams.id,
          name: teams.name,
          teamshort: teams.teamshort,
          coach: teams.coach,
          status: teams.status,
        })
        .from(teams)
        .where(eq(teams.leagueId, leagueId))
        .orderBy(asc(teams.name)),
      db
        .select({ value: rules.value })
        .from(rules)
        .where(and(eq(rules.leagueId, leagueId), eq(rules.rule, 'cuts_year')))
        .limit(1),
    ]);

    const rawSeason = seasonRows[0]?.value?.trim() ?? '';
    const parsedSeason = /^\d{4}$/.test(rawSeason) ? parseInt(rawSeason, 10) : null;

    return {
      polls: pollRows,
      options: optionRows,
      votes: voteRows,
      teams: teamRows.map((t) => ({
        id: t.id,
        name: t.name,
        teamshort: t.teamshort ?? '',
        coach: t.coach ?? '',
        status: t.status ?? 'active',
      })),
      currentSeason: parsedSeason,
    };
  },
  ['polls-raw-v1'],
  { revalidate: 300, tags: ['polls', 'coaches'] },
);

/**
 * Returns league-scoped polls tailored to the caller. Privacy redaction and
 * `myVoteOptionId` are computed OUTSIDE `unstable_cache` per request so open
 * ballot secrets never leak between viewers and expiry flips immediately at closesAt.
 */
export async function getPollsForViewer(
  session: Session | null,
  leagueId: number,
): Promise<PollsPayload> {
  const demo = isDemoUser(session);
  const [raw, callerTeam, privileged] = await Promise.all([
    _getPollsRaw(leagueId),
    resolveCallerTeam(session, leagueId),
    demo ? Promise.resolve(false) : isPrivileged(),
  ]);

  const activeTeams: PollActiveTeam[] = raw.teams
    .filter((t) => t.status === 'active')
    .map((t) => ({
      id: t.id,
      name: t.name,
      teamshort: t.teamshort,
      coach: t.coach,
    }));

  const teamsById = new Map<number, PollActiveTeam>(
    raw.teams.map((t) => [
      t.id,
      { id: t.id, name: t.name, teamshort: t.teamshort, coach: t.coach },
    ]),
  );

  const childRunoffMap = new Map<number, number>();
  for (const p of raw.polls) {
    if (p.parentPollId != null && !childRunoffMap.has(p.parentPollId)) {
      childRunoffMap.set(p.parentPollId, p.id);
    }
  }

  const optionsByPoll = new Map<number, RawPollOptionRecord[]>();
  for (const opt of raw.options) {
    const arr = optionsByPoll.get(opt.pollId);
    if (arr) arr.push(opt);
    else optionsByPoll.set(opt.pollId, [opt]);
  }

  const votesByPoll = new Map<number, RawPollVoteRecord[]>();
  for (const vote of raw.votes) {
    const arr = votesByPoll.get(vote.pollId);
    if (arr) arr.push(vote);
    else votesByPoll.set(vote.pollId, [vote]);
  }

  const now = new Date();
  const viewerTeamId = callerTeam?.id ?? null;

  const pollItems = raw.polls.map((poll) =>
    sanitizePollForViewer({
      poll,
      options: optionsByPoll.get(poll.id) ?? [],
      votes: votesByPoll.get(poll.id) ?? [],
      activeTeams,
      teamsById,
      viewerTeamId,
      childRunoffPollId: childRunoffMap.get(poll.id) ?? null,
      currentSeason: raw.currentSeason,
      now,
    }),
  );

  return {
    polls: pollItems,
    activeTeams,
    currentSeason: raw.currentSeason,
    viewer: {
      teamId: callerTeam?.id ?? null,
      teamshort: callerTeam?.teamshort ?? null,
      teamName: callerTeam?.name ?? null,
      isPrivileged: privileged,
      isDemo: demo,
      canVote: !demo && callerTeam !== null,
      canManage: !demo && privileged,
    },
  };
}
