import test from 'node:test';
import assert from 'node:assert/strict';
import {
  RULE_CHANGE_DEFAULT_DAYS,
  defaultRuleChangeClosesAt,
  calculateQuorumRequired,
  calculateMajorityRequired,
  isPollVotingOpen,
  isUnderE10Lock,
  evaluatePollOutcome,
  sanitizePollForViewer,
  parsePositiveInt,
  validatePollOptionsList,
  parseEffectiveSeason,
  parseFutureDate,
} from '../lib/pollRules';

test('calculateQuorumRequired enforces >= 50% (E13)', () => {
  assert.equal(calculateQuorumRequired(18), 9);
  assert.equal(calculateQuorumRequired(17), 9);
  assert.equal(calculateQuorumRequired(12), 6);
  assert.equal(calculateQuorumRequired(1), 1);
  assert.equal(calculateQuorumRequired(0), 0);
});

test('calculateMajorityRequired enforces 50% + 1 vote (E11)', () => {
  assert.equal(calculateMajorityRequired(10), 6);
  assert.equal(calculateMajorityRequired(11), 6);
  assert.equal(calculateMajorityRequired(18), 10);
  assert.equal(calculateMajorityRequired(9), 5);
  assert.equal(calculateMajorityRequired(2), 2);
  assert.equal(calculateMajorityRequired(0), 0);
});

test('defaultRuleChangeClosesAt adds 14 days (E12)', () => {
  const start = new Date('2026-06-01T12:00:00.000Z');
  const close = defaultRuleChangeClosesAt(start);
  assert.equal(close.getTime() - start.getTime(), RULE_CHANGE_DEFAULT_DAYS * 86_400_000);
});

test('evaluatePollOutcome handles rule_change quorum fail and 2-option results', () => {
  const opts2 = [
    { id: 1, sortOrder: 0 },
    { id: 2, sortOrder: 1 },
  ];

  // Quorum fail: 8/18 (requires 9) -> null_quorum
  const nullRes = evaluatePollOutcome({
    pollType: 'rule_change',
    options: opts2,
    voteCounts: { 1: 8, 2: 0 },
    eligibleTeamCount: 18,
  });
  assert.equal(nullRes.status, 'null_quorum');
  assert.equal(nullRes.quorumMet, false);
  assert.equal(nullRes.winnerOptionId, null);

  // Quorum met (9/18 exact): 5-4 passes
  const passRes = evaluatePollOutcome({
    pollType: 'rule_change',
    options: opts2,
    voteCounts: { 1: 5, 2: 4 },
    eligibleTeamCount: 18,
  });
  assert.equal(passRes.status, 'closed');
  assert.equal(passRes.quorumMet, true);
  assert.equal(passRes.winnerOptionId, 1);

  // Tie (6-6 with 18 eligible) -> tied
  const tieRes = evaluatePollOutcome({
    pollType: 'rule_change',
    options: opts2,
    voteCounts: { 1: 6, 2: 6 },
    eligibleTeamCount: 18,
  });
  assert.equal(tieRes.status, 'tied');
  assert.equal(tieRes.winnerOptionId, null);
});

test('evaluatePollOutcome enforces E11 50% + 1 majority and runoff / tie detection on >2 choices', () => {
  const opts3 = [
    { id: 10, sortOrder: 0 },
    { id: 20, sortOrder: 1 },
    { id: 30, sortOrder: 2 },
  ];

  // 10 votes cast: 50% + 1 = 6 wins outright
  const majorityWin = evaluatePollOutcome({
    pollType: 'rule_change',
    options: opts3,
    voteCounts: { 10: 6, 20: 3, 30: 1 },
    eligibleTeamCount: 18,
  });
  assert.equal(majorityWin.status, 'closed');
  assert.equal(majorityWin.winnerOptionId, 10);
  assert.equal(majorityWin.majorityRequired, 6);

  // 10 votes cast: exact 50% (5 votes) does NOT pass -> clean top-2 runoff [10, 20]
  const cleanRunoff = evaluatePollOutcome({
    pollType: 'rule_change',
    options: opts3,
    voteCounts: { 10: 5, 20: 4, 30: 1 },
    eligibleTeamCount: 18,
  });
  assert.equal(cleanRunoff.status, 'runoff_needed');
  assert.equal(cleanRunoff.winnerOptionId, null);
  assert.equal(cleanRunoff.hasRunoffTie, false);
  assert.deepEqual(cleanRunoff.suggestedRunoffOptionIds, [10, 20]);
  assert.deepEqual(cleanRunoff.tiedAtCutoffOptionIds, []);

  // Tie for 2nd place (5, 3, 3 on 11 votes) -> hasRunoffTie true
  const secondPlaceTie = evaluatePollOutcome({
    pollType: 'rule_change',
    options: opts3,
    voteCounts: { 10: 5, 20: 3, 30: 3 },
    eligibleTeamCount: 18,
  });
  assert.equal(secondPlaceTie.status, 'runoff_needed');
  assert.equal(secondPlaceTie.hasRunoffTie, true);
  assert.deepEqual(secondPlaceTie.suggestedRunoffOptionIds, []);
  assert.deepEqual(secondPlaceTie.tiedAtCutoffOptionIds, [20, 30]);

  // 3-way tie for 1st (4, 4, 4 on 12 votes) -> hasRunoffTie true with all 3 tied at cutoff
  const threeWayTie = evaluatePollOutcome({
    pollType: 'rule_change',
    options: opts3,
    voteCounts: { 10: 4, 20: 4, 30: 4 },
    eligibleTeamCount: 18,
  });
  assert.equal(threeWayTie.status, 'runoff_needed');
  assert.equal(threeWayTie.hasRunoffTie, true);
  assert.deepEqual(threeWayTie.tiedAtCutoffOptionIds, [10, 20, 30]);
});

test('evaluatePollOutcome handles general polls (plurality, tie, zero votes)', () => {
  const opts3 = [
    { id: 1, sortOrder: 0 },
    { id: 2, sortOrder: 1 },
    { id: 3, sortOrder: 2 },
  ];

  // Plurality below 50% still wins a general poll (even with <50% turnout)
  const plurality = evaluatePollOutcome({
    pollType: 'general',
    options: opts3,
    voteCounts: { 1: 3, 2: 2, 3: 2 },
    eligibleTeamCount: 18,
  });
  assert.equal(plurality.status, 'closed');
  assert.equal(plurality.winnerOptionId, 1);

  // Top tie -> tied
  const tied = evaluatePollOutcome({
    pollType: 'general',
    options: opts3,
    voteCounts: { 1: 4, 2: 4, 3: 1 },
    eligibleTeamCount: 18,
  });
  assert.equal(tied.status, 'tied');
  assert.equal(tied.winnerOptionId, null);

  // 0 votes -> closed with null winner
  const zeroVotes = evaluatePollOutcome({
    pollType: 'general',
    options: opts3,
    voteCounts: { 1: 0, 2: 0, 3: 0 },
    eligibleTeamCount: 18,
  });
  assert.equal(zeroVotes.status, 'closed');
  assert.equal(zeroVotes.winnerOptionId, null);
});

test('isUnderE10Lock checks advisory one-season lock', () => {
  assert.equal(isUnderE10Lock(2026, 2026), true);
  assert.equal(isUnderE10Lock(2027, 2026), true);
  assert.equal(isUnderE10Lock(2025, 2026), false);
  assert.equal(isUnderE10Lock(null, 2026), false);
  assert.equal(isUnderE10Lock(2026, null), false);
});

test('isPollVotingOpen respects status and closesAt timestamp', () => {
  const future = new Date('2026-12-01T00:00:00.000Z');
  const past = new Date('2026-10-01T00:00:00.000Z');
  const now = new Date('2026-11-19T00:00:00.000Z');

  assert.equal(isPollVotingOpen('open', future, now), true);
  assert.equal(isPollVotingOpen('open', past, now), false);
  assert.equal(isPollVotingOpen('open', now, now), false);
  assert.equal(isPollVotingOpen('closed', future, now), false);
});

test('sanitizePollForViewer hides option counts & choices while open and reveals after close/expiry', () => {
  const activeTeams = [
    { id: 1, name: 'Team Alpha', teamshort: 'ALP', coach: 'Alice' },
    { id: 2, name: 'Team Bravo', teamshort: 'BRV', coach: 'Bob' },
    { id: 3, name: 'Team Charlie', teamshort: 'CHR', coach: 'Charlie' },
  ];
  const pollBase = {
    id: 50,
    leagueId: 1,
    title: 'IR Cap Update',
    description: 'Increase IR cap?',
    pollType: 'rule_change',
    status: 'open',
    effectiveSeason: 2026,
    constitutionRef: 'B7',
    parentPollId: null,
    winnerOptionId: null,
    eligibleTeamCount: null,
    closesAt: '2026-11-25T12:00:00.000Z',
    closedAt: null,
    lastReminderAt: null,
    createdAt: '2026-11-11T12:00:00.000Z',
    createdBy: 'Commissioner',
  };
  const options = [
    { id: 101, pollId: 50, label: 'Yes', sortOrder: 0 },
    { id: 102, pollId: 50, label: 'No', sortOrder: 1 },
  ];
  const votes = [
    { pollId: 50, optionId: 101, teamId: 1, isProxy: false, votedAt: '2026-11-12T10:00:00.000Z' },
    { pollId: 50, optionId: 102, teamId: 2, isProxy: true, votedAt: '2026-11-12T11:00:00.000Z' },
  ];

  // Open before closesAt -> tallies & individual choices hidden, roll call + own choice preserved
  const openView = sanitizePollForViewer({
    poll: pollBase,
    options,
    votes,
    activeTeams,
    viewerTeamId: 1,
    currentSeason: 2026,
    now: new Date('2026-11-19T12:00:00.000Z'),
  });
  assert.equal(openView.isVotingOpen, true);
  assert.equal(openView.choicesHidden, true);
  assert.equal(openView.myVoteOptionId, 101);
  assert.equal(openView.votesCast, 2);
  assert.equal(openView.votedTeams.length, 2);
  assert.equal(openView.nonVotedTeams.length, 1);
  assert.equal(openView.computedOutcome, null);
  for (const opt of openView.options) {
    assert.equal(opt.voteCount, null);
    assert.equal(opt.percentage, null);
    assert.deepEqual(opt.voters, []);
  }

  // Expired (now >= closesAt while still status='open') -> results revealed for finalization
  const expiredView = sanitizePollForViewer({
    poll: pollBase,
    options,
    votes,
    activeTeams,
    viewerTeamId: 3,
    currentSeason: 2026,
    now: new Date('2026-11-26T00:00:00.000Z'),
  });
  assert.equal(expiredView.isVotingOpen, false);
  assert.equal(expiredView.isExpiredPendingFinalization, true);
  assert.equal(expiredView.choicesHidden, false);
  assert.equal(expiredView.myVoteOptionId, null);
  assert.equal(expiredView.options[0].voteCount, 1);
  assert.equal(expiredView.options[0].voters[0].teamName, 'Team Alpha');
  assert.equal(expiredView.options[1].voters[0].isProxy, true);
  assert.equal(expiredView.computedOutcome?.status, 'tied');

  // Finalized poll
  const closedView = sanitizePollForViewer({
    poll: {
      ...pollBase,
      status: 'closed',
      winnerOptionId: 101,
      eligibleTeamCount: 3,
      closedAt: '2026-11-20T12:00:00.000Z',
    },
    options,
    votes: [
      ...votes,
      { pollId: 50, optionId: 101, teamId: 3, isProxy: false, votedAt: '2026-11-13T10:00:00.000Z' },
    ],
    activeTeams,
    viewerTeamId: 1,
    currentSeason: 2026,
    now: new Date('2026-11-20T13:00:00.000Z'),
  });
  assert.equal(closedView.choicesHidden, false);
  assert.equal(closedView.e10Locked, true);
  assert.equal(closedView.options[0].voteCount, 2);
  assert.equal(closedView.options[0].percentage, 66.7);
  assert.equal(closedView.computedOutcome?.winnerOptionId, 101);
});

test('validation helpers reject malformed poll inputs', () => {
  assert.equal(parsePositiveInt(42), 42);
  assert.equal(parsePositiveInt('42'), 42);
  assert.equal(parsePositiveInt('42abc'), null);
  assert.equal(parsePositiveInt(0), null);
  assert.equal(parsePositiveInt(-5), null);

  assert.equal(validatePollOptionsList(['Yes', ' No ']).ok, true);
  assert.equal(validatePollOptionsList(['OnlyOne']).ok, false);
  assert.equal(validatePollOptionsList(['Yes', 'yes']).ok, false);
  assert.equal(validatePollOptionsList(['Yes', '']).ok, false);

  assert.deepEqual(parseEffectiveSeason(null), { ok: true, value: null });
  assert.deepEqual(parseEffectiveSeason('2026'), { ok: true, value: 2026 });
  assert.equal(parseEffectiveSeason('26').ok, false);

  const now = new Date('2026-11-19T12:00:00.000Z');
  assert.equal(parseFutureDate('2026-11-20T12:00:00.000Z', now).ok, true);
  assert.equal(parseFutureDate('2026-11-18T12:00:00.000Z', now).ok, false);
});
