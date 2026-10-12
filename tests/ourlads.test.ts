import test from 'node:test';
import assert from 'node:assert/strict';
import { normalizePlayerName, normalizeOurladsName } from '../lib/ourlads';

test('normalizePlayerName lowercases and strips non-letters', () => {
  assert.equal(normalizePlayerName("O'Cyrus Torrence Jr."), 'ocyrus torrence jr');
  assert.equal(normalizePlayerName('  T.J.   Bass '), 'tj bass');
});

test('normalizeOurladsName flips "Last, First" and keeps short first names', () => {
  assert.equal(normalizeOurladsName('McCullough, Liam'), 'liam mccullough');
  assert.equal(normalizeOurladsName('KREITER, CASEY'), 'casey kreiter');
  assert.equal(normalizeOurladsName('Wagner, William'), 'william wagner');
});

test('normalizeOurladsName strips draft/transaction tags', () => {
  assert.equal(normalizeOurladsName('Lawrence, Trevor 21/1'), 'trevor lawrence');
  assert.equal(normalizeOurladsName('Jones, Daniel SF25'), 'daniel jones');
  assert.equal(normalizeOurladsName('Smith, John T/LV'), 'john smith');
});
