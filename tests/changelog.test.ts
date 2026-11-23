import test from 'node:test';
import assert from 'node:assert/strict';
import rawChangelog from '../data/changelog.json';
import {
  formatChangelogDate,
  getChangelogEntries,
  getLatestChangelogEntry,
  getLatestChangelogId,
  isValidIsoDate,
  validateChangelogEntries,
} from '../lib/changelog';

test('data/changelog.json passes strict schema and chronological validation', () => {
  const result = validateChangelogEntries(rawChangelog);
  assert.equal(result.valid, true, `Validation errors: ${result.errors.join('; ')}`);
  assert.equal(result.errors.length, 0);
});

test('getChangelogEntries returns non-empty array newest-first without mutating shared entries', () => {
  const firstCall = getChangelogEntries();
  assert.ok(firstCall.length > 0);

  for (let i = 1; i < firstCall.length; i++) {
    assert.ok(
      firstCall[i - 1].date >= firstCall[i].date,
      `Expected ${firstCall[i - 1].date} >= ${firstCall[i].date}`
    );
  }

  const originalTitle = firstCall[0].title;
  firstCall[0].title = 'MUTATED TITLE';

  const secondCall = getChangelogEntries();
  assert.equal(secondCall[0].title, originalTitle);
  assert.equal(getLatestChangelogId(), secondCall[0].id);
  assert.equal(getLatestChangelogEntry()?.id, secondCall[0].id);
});

test('validateChangelogEntries rejects non-array and empty array', () => {
  assert.equal(validateChangelogEntries(null).valid, false);
  assert.equal(validateChangelogEntries({}).valid, false);
  assert.equal(validateChangelogEntries([]).valid, false);
});

test('validateChangelogEntries rejects duplicate IDs', () => {
  const res = validateChangelogEntries([
    {
      id: 'dup-id',
      date: '2026-11-23',
      category: 'General',
      title: 'First',
      summary: 'Summary one.',
    },
    {
      id: 'dup-id',
      date: '2026-11-22',
      category: 'General',
      title: 'Second',
      summary: 'Summary two.',
    },
  ]);
  assert.equal(res.valid, false);
  assert.ok(res.errors.some((e) => e.includes('Duplicate changelog id')));
});

test('validateChangelogEntries rejects invalid calendar dates and non-ISO dates', () => {
  assert.equal(isValidIsoDate('2026-02-31'), false);
  assert.equal(isValidIsoDate('11/23/2026'), false);
  assert.equal(isValidIsoDate('2026-11-23'), true);

  const res = validateChangelogEntries([
    {
      id: 'bad-cal-date',
      date: '2026-02-31',
      category: 'General',
      title: 'Bad Date',
      summary: 'Should fail.',
    },
    {
      id: 'bad-format-date',
      date: '11/23/2026',
      category: 'General',
      title: 'Bad Format',
      summary: 'Should fail.',
    },
  ]);
  assert.equal(res.valid, false);
  assert.equal(res.errors.length, 2);
});

test('validateChangelogEntries rejects unknown category, empty title/summary, and invalid audience', () => {
  const res = validateChangelogEntries([
    {
      id: 'bad-fields',
      date: '2026-11-23',
      category: 'UnknownCat',
      title: '   ',
      summary: '',
      audience: 'fans',
    },
  ]);
  assert.equal(res.valid, false);
  assert.ok(res.errors.some((e) => e.includes('unknown category')));
  assert.ok(res.errors.some((e) => e.includes('empty title')));
  assert.ok(res.errors.some((e) => e.includes('empty summary')));
  assert.ok(res.errors.some((e) => e.includes('invalid audience')));
});

test('validateChangelogEntries rejects chronologically out-of-order entries', () => {
  const res = validateChangelogEntries([
    {
      id: 'older-first',
      date: '2026-11-20',
      category: 'General',
      title: 'Older',
      summary: 'Older update.',
    },
    {
      id: 'newer-second',
      date: '2026-11-23',
      category: 'General',
      title: 'Newer',
      summary: 'Newer update listed after older.',
    },
  ]);
  assert.equal(res.valid, false);
  assert.ok(res.errors.some((e) => e.includes('ordered newest-first')));
});

test('formatChangelogDate formats YYYY-MM-DD in UTC without timezone day-shift and falls back safely', () => {
  assert.equal(formatChangelogDate('2026-11-23'), 'Nov 23, 2026');
  assert.equal(formatChangelogDate('2026-01-01'), 'Jan 1, 2026');
  assert.equal(formatChangelogDate('2026-02-31'), '2026-02-31');
  assert.equal(formatChangelogDate('invalid'), 'invalid');
});
