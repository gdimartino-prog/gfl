import rawChangelog from '../data/changelog.json';
import type { ChangelogAudience, ChangelogCategory, ChangelogEntry } from '../types';

export const CHANGELOG_CATEGORIES: readonly ChangelogCategory[] = [
  'Transactions',
  'Rosters',
  'Polls',
  'Schedule & Stats',
  'Draft',
  'Account & Settings',
  'Commissioner',
  'General',
] as const;

export const CHANGELOG_AUDIENCES: readonly ChangelogAudience[] = [
  'coaches',
  'commissioners',
] as const;

export const CHANGELOG_STORAGE_KEY = 'gfl-changelog-last-seen';
export const CHANGELOG_SEEN_EVENT = 'gfl-changelog-seen';

const ISO_DATE_REGEX = /^\d{4}-\d{2}-\d{2}$/;

/** Validates a YYYY-MM-DD calendar date strictly in UTC without day-shift surprises. */
export function isValidIsoDate(value: string): boolean {
  if (typeof value !== 'string' || !ISO_DATE_REGEX.test(value)) {
    return false;
  }
  const [year, month, day] = value.split('-').map(Number);
  const utc = new Date(Date.UTC(year, month - 1, day));
  return (
    utc.getUTCFullYear() === year &&
    utc.getUTCMonth() === month - 1 &&
    utc.getUTCDate() === day
  );
}

/** Validates changelog entries for schema correctness, unique IDs, and newest-first order. */
export function validateChangelogEntries(entries: unknown): {
  valid: boolean;
  errors: string[];
} {
  const errors: string[] = [];

  if (!Array.isArray(entries) || entries.length === 0) {
    return { valid: false, errors: ['Changelog must be a non-empty array.'] };
  }

  const seenIds = new Set<string>();
  const validDates: (string | null)[] = [];

  entries.forEach((raw, idx) => {
    if (!raw || typeof raw !== 'object' || Array.isArray(raw)) {
      errors.push(`Entry at index ${idx} must be an object.`);
      validDates.push(null);
      return;
    }

    const entry = raw as Record<string, unknown>;

    if (typeof entry.id !== 'string' || entry.id.trim().length === 0) {
      errors.push(`Entry at index ${idx} has an invalid or empty id.`);
    } else if (seenIds.has(entry.id)) {
      errors.push(`Duplicate changelog id "${entry.id}" at index ${idx}.`);
    } else {
      seenIds.add(entry.id);
    }

    if (typeof entry.date !== 'string' || !isValidIsoDate(entry.date)) {
      errors.push(`Entry at index ${idx} has an invalid date "${String(entry.date)}". Expected YYYY-MM-DD.`);
      validDates.push(null);
    } else {
      validDates.push(entry.date);
    }

    if (
      typeof entry.category !== 'string' ||
      !CHANGELOG_CATEGORIES.includes(entry.category as ChangelogCategory)
    ) {
      errors.push(`Entry at index ${idx} has unknown category "${String(entry.category)}".`);
    }

    if (typeof entry.title !== 'string' || entry.title.trim().length === 0) {
      errors.push(`Entry at index ${idx} has an empty title.`);
    }

    if (typeof entry.summary !== 'string' || entry.summary.trim().length === 0) {
      errors.push(`Entry at index ${idx} has an empty summary.`);
    }

    if (
      entry.audience !== undefined &&
      (typeof entry.audience !== 'string' ||
        !CHANGELOG_AUDIENCES.includes(entry.audience as ChangelogAudience))
    ) {
      errors.push(`Entry at index ${idx} has invalid audience "${String(entry.audience)}".`);
    }
  });

  for (let i = 1; i < validDates.length; i++) {
    const prev = validDates[i - 1];
    const curr = validDates[i];
    if (prev && curr && curr > prev) {
      errors.push(
        `Entry at index ${i} (${curr}) is newer than previous entry (${prev}); entries must be ordered newest-first.`
      );
    }
  }

  return { valid: errors.length === 0, errors };
}

/** Returns a shallow copy of changelog entries sorted stably newest-date-first. */
export function getChangelogEntries(): ChangelogEntry[] {
  const entries = (rawChangelog as ChangelogEntry[]).map((entry, index) => ({
    entry: { ...entry },
    index,
  }));

  entries.sort((a, b) => {
    if (a.entry.date !== b.entry.date) {
      return b.entry.date.localeCompare(a.entry.date);
    }
    return a.index - b.index;
  });

  return entries.map((item) => item.entry);
}

/** Returns the newest changelog entry, or null if empty. */
export function getLatestChangelogEntry(): ChangelogEntry | null {
  const entries = getChangelogEntries();
  return entries[0] ?? null;
}

/** Returns the newest changelog entry ID, or null if empty. */
export function getLatestChangelogId(): string | null {
  return getLatestChangelogEntry()?.id ?? null;
}

/** Formats YYYY-MM-DD in UTC so local timezones never shift the calendar day. */
export function formatChangelogDate(isoDate: string): string {
  if (!isValidIsoDate(isoDate)) {
    return isoDate;
  }
  const [year, month, day] = isoDate.split('-').map(Number);
  return new Date(Date.UTC(year, month - 1, day)).toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    timeZone: 'UTC',
  });
}
