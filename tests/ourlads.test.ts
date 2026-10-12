import test from 'node:test';
import assert from 'node:assert/strict';
import { normalizePlayerName, normalizeOurladsName, buildDepthChartData, type DepthChartEntry } from '../lib/ourlads';

function entry(normalizedName: string, position: string, depthRank: number): DepthChartEntry {
  return { teamCode: 'X', teamName: 'X', position, depthRank, rawName: normalizedName, normalizedName };
}

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

test('buildDepthChartData flags long snappers', () => {
  const data = buildDepthChartData([entry('liam mccullough', 'LS', 1), entry('josh allen', 'QB', 1)]);
  assert.equal(data.longSnappers.has('liam mccullough'), true);
  assert.equal(data.longSnappers.has('josh allen'), false);
  assert.equal(data.index.get('liam mccullough')?.position, 'LS');
});

test('buildDepthChartData prefers a non-special-teams listing for the same player', () => {
  const data = buildDepthChartData([
    entry('deebo samuel', 'PR', 1),
    entry('deebo samuel', 'WR', 2),
  ]);
  assert.equal(data.index.get('deebo samuel')?.position, 'WR');
  assert.equal(data.index.get('deebo samuel')?.depthRank, 2);
});

test('buildDepthChartData keeps the lower depthRank within the same tier', () => {
  const data = buildDepthChartData([
    entry('x player', 'RB', 2),
    entry('x player', 'RB', 1),
  ]);
  assert.equal(data.index.get('x player')?.depthRank, 1);
});
