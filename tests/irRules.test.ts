import test from 'node:test';
import assert from 'node:assert/strict';
import {
  IR_LIMIT_RULE,
  DEFAULT_GFL_IR_LIMIT,
  resolveIrLimit,
  isIrCapReached,
} from '../lib/irRules';

test('IR rule constants match expected defaults', () => {
  assert.equal(IR_LIMIT_RULE, 'limit_ir');
  assert.equal(DEFAULT_GFL_IR_LIMIT, 5);
});

test('resolveIrLimit handles GFL defaults, explicit values, zero (unlimited), and invalid strings', () => {
  // GFL (leagueId = 1) defaults to 5 when unset, blank, or invalid
  assert.equal(resolveIrLimit(1), 5);
  assert.equal(resolveIrLimit(1, null), 5);
  assert.equal(resolveIrLimit(1, ''), 5);
  assert.equal(resolveIrLimit(1, '   '), 5);
  assert.equal(resolveIrLimit(1, 'invalid'), 5);
  assert.equal(resolveIrLimit(1, '-1'), 5);
  assert.equal(resolveIrLimit(1, '5abc'), 5);

  // Explicit values override default; 0 disables cap
  assert.equal(resolveIrLimit(1, '3'), 3);
  assert.equal(resolveIrLimit(1, ' 7 '), 7);
  assert.equal(resolveIrLimit(1, '0'), null);
  assert.equal(resolveIrLimit(1, ' 0 '), null);
});

test('resolveIrLimit handles non-GFL leagues (only enforced when explicitly positive)', () => {
  for (const leagueId of [2, 3]) {
    assert.equal(resolveIrLimit(leagueId), null);
    assert.equal(resolveIrLimit(leagueId, null), null);
    assert.equal(resolveIrLimit(leagueId, ''), null);
    assert.equal(resolveIrLimit(leagueId, '   '), null);
    assert.equal(resolveIrLimit(leagueId, '0'), null);
    assert.equal(resolveIrLimit(leagueId, '-1'), null);
    assert.equal(resolveIrLimit(leagueId, '5abc'), null);
    assert.equal(resolveIrLimit(leagueId, '5'), 5);
    assert.equal(resolveIrLimit(leagueId, ' 4 '), 4);
  }
});

test('isIrCapReached checks cap boundary accurately', () => {
  assert.equal(isIrCapReached(0, null), false);
  assert.equal(isIrCapReached(100, null), false);

  assert.equal(isIrCapReached(0, 5), false);
  assert.equal(isIrCapReached(4, 5), false);
  assert.equal(isIrCapReached(5, 5), true);
  assert.equal(isIrCapReached(6, 5), true);
});
