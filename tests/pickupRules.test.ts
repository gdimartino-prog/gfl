import test from 'node:test';
import assert from 'node:assert/strict';
import {
  parseFaDeadline,
  isFaDeadlinePassed,
  formatFaDeadlineET,
  extractPositionTokens,
  extractUnitGroups,
  isInjuryPositionMatch,
  matchesPositionFilter,
} from '../lib/pickupRules';

test('parseFaDeadline and isFaDeadlinePassed handle empty, invalid, ISO, and date-only strings', () => {
  assert.equal(parseFaDeadline(null), null);
  assert.equal(parseFaDeadline(undefined), null);
  assert.equal(parseFaDeadline('   '), null);
  assert.equal(parseFaDeadline('not-a-date'), null);
  assert.equal(parseFaDeadline('2026-02-30'), null);
  assert.equal(isFaDeadlinePassed(null), false);
  assert.equal(isFaDeadlinePassed(''), false);
  assert.equal(isFaDeadlinePassed('not-a-date'), false);

  const isoDeadline = '2026-11-03T16:00:00-05:00';
  assert.equal(isFaDeadlinePassed(isoDeadline, new Date('2026-11-03T15:59:00-05:00')), false);
  assert.equal(isFaDeadlinePassed(isoDeadline, new Date('2026-11-03T16:00:00-05:00')), false);
  assert.equal(isFaDeadlinePassed(isoDeadline, new Date('2026-11-03T16:01:00-05:00')), true);
  assert.ok(formatFaDeadlineET(isoDeadline)?.includes('Nov 3, 2026'));

  // Date-only values expire after 23:59:59.999 ET on that calendar day
  assert.equal(isFaDeadlinePassed('11/3/2026', new Date('2026-11-03T20:00:00-05:00')), false);
  assert.equal(isFaDeadlinePassed('11/3/2026', new Date('2026-11-04T00:00:01-05:00')), true);
  assert.equal(isFaDeadlinePassed('2026-11-03', new Date('2026-11-03T23:59:00-05:00')), false);
  assert.equal(isFaDeadlinePassed('2026-11-03', new Date('2026-11-04T05:01:00Z')), true);

  // Summer EDT date uses -04:00
  assert.equal(isFaDeadlinePassed('2026-07-04', new Date('2026-07-05T03:59:00Z')), false);
  assert.equal(isFaDeadlinePassed('2026-07-04', new Date('2026-07-05T04:01:00Z')), true);

  // Naive ISO datetime without timezone offset anchors to America/New_York
  assert.equal(isFaDeadlinePassed('2026-11-03T16:00:00', new Date('2026-11-03T15:59:00-05:00')), false);
  assert.equal(isFaDeadlinePassed('2026-11-03T16:00:00', new Date('2026-11-03T16:01:00-05:00')), true);
});

test('extractUnitGroups and isInjuryPositionMatch allow unit-group matches and flag cross-unit mismatches', () => {
  const center = { offense: 'C', position: 'C' };
  const cg = { offense: 'C-G', position: 'C-G' };
  const gc = { offense: 'G-C', position: 'G-C' };
  const ol = { offense: 'OL', position: 'OL' };
  const guard = { offense: 'G', position: 'G' };
  const tackle = { offense: 'T', position: 'T' };

  assert.deepEqual(extractUnitGroups(cg), ['OL']);
  assert.equal(isInjuryPositionMatch(center, cg), true);
  assert.equal(isInjuryPositionMatch(center, gc), true);
  assert.equal(isInjuryPositionMatch(center, ol), true);
  assert.equal(isInjuryPositionMatch(center, guard), true);
  assert.equal(isInjuryPositionMatch(center, tackle), true);

  const cb = { defense: 'CB', position: 'CB' };
  const safety = { defense: 'S', position: 'S' };
  const db = { defense: 'DB', position: 'DB' };
  const cbKr = { defense: 'CB', special: 'KR', position: 'CB/KR' };
  const wrCb = { offense: 'WR', defense: 'CB', position: 'WR/CB' };
  const wrKr = { offense: 'WR', special: 'KR', position: 'WR/KR' };

  assert.deepEqual(extractUnitGroups(cb), ['DB']);
  assert.deepEqual(extractUnitGroups(safety), ['DB']);
  assert.equal(isInjuryPositionMatch(cb, safety), true);
  assert.equal(isInjuryPositionMatch(cb, db), true);
  assert.equal(isInjuryPositionMatch(cb, cbKr), true);
  assert.equal(isInjuryPositionMatch(cb, wrCb), true);
  assert.equal(isInjuryPositionMatch(cbKr, wrKr), false);

  const deLb = { defense: 'DE-LB', position: 'DE-LB' };
  const de = { defense: 'DE', position: 'DE' };
  const dt = { defense: 'DT', position: 'DT' };
  const ilb = { defense: 'ILB', position: 'ILB' };
  const olb = { defense: 'OLB', position: 'OLB' };

  assert.deepEqual(extractUnitGroups(deLb), ['DL', 'LB']);
  assert.equal(isInjuryPositionMatch(de, dt), true);
  assert.equal(isInjuryPositionMatch(ilb, olb), true);
  assert.equal(isInjuryPositionMatch(deLb, de), true);
  assert.equal(isInjuryPositionMatch(deLb, olb), true);

  const rb = { offense: 'RB', position: 'RB' };
  const hb = { offense: 'HB', position: 'HB' };
  assert.equal(isInjuryPositionMatch(rb, hb), true);
  assert.equal(isInjuryPositionMatch(dt, rb), false);

  const wr = { offense: 'WR', position: 'WR' };
  const te = { offense: 'TE', position: 'TE' };
  assert.equal(isInjuryPositionMatch(te, wr), false);

  const kicker = { special: 'K', position: 'K' };
  const punter = { special: 'P', position: 'P' };
  const kp = { special: 'K-P', position: 'K-P' };
  assert.equal(isInjuryPositionMatch(kicker, kp), true);
  assert.equal(isInjuryPositionMatch(punter, kp), true);
  assert.deepEqual(extractPositionTokens({ position: 'WR/KR' }), ['WR']);
});

test('matchesPositionFilter evaluates MATCH unit groups, unit filters, and ALL', () => {
  const injuredCb = { defense: 'CB', position: 'CB' };
  const candidateCb = { defense: 'CB', position: 'CB' };
  const candidateS = { defense: 'S', position: 'S' };
  const candidateWr = { offense: 'WR', position: 'WR' };
  const candidateCg = { offense: 'C-G', position: 'C-G' };
  const candidateDt = { defense: 'NT', position: 'NT' };
  const candidateIlb = { defense: 'MLB', position: 'MLB' };
  const candidateK = { special: 'K', position: 'K' };

  assert.equal(matchesPositionFilter(candidateCb, 'MATCH', injuredCb), true);
  assert.equal(matchesPositionFilter(candidateS, 'MATCH', injuredCb), true);
  assert.equal(matchesPositionFilter(candidateWr, 'MATCH', injuredCb), false);
  assert.equal(matchesPositionFilter(candidateS, 'DB', injuredCb), true);
  assert.equal(matchesPositionFilter(candidateCg, 'OL'), true);
  assert.equal(matchesPositionFilter(candidateDt, 'DL'), true);
  assert.equal(matchesPositionFilter(candidateIlb, 'LB'), true);
  assert.equal(matchesPositionFilter(candidateK, 'K/P'), true);
  assert.equal(matchesPositionFilter(candidateK, 'ALL'), true);
});
