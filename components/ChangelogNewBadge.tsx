'use client';

import { useSyncExternalStore } from 'react';
import { CHANGELOG_SEEN_EVENT, CHANGELOG_STORAGE_KEY } from '@/lib/changelog';

interface ChangelogNewBadgeProps {
  latestId: string | null;
  variant?: 'pill' | 'dot';
}

function subscribe(onStoreChange: () => void): () => void {
  if (typeof window === 'undefined') {
    return () => {};
  }
  const handleStorage = (event: StorageEvent) => {
    if (event.key === null || event.key === CHANGELOG_STORAGE_KEY) {
      onStoreChange();
    }
  };
  window.addEventListener('storage', handleStorage);
  window.addEventListener(CHANGELOG_SEEN_EVENT, onStoreChange);
  return () => {
    window.removeEventListener('storage', handleStorage);
    window.removeEventListener(CHANGELOG_SEEN_EVENT, onStoreChange);
  };
}

function getSnapshot(): string | null | undefined {
  if (typeof window === 'undefined') {
    return undefined;
  }
  try {
    return window.localStorage.getItem(CHANGELOG_STORAGE_KEY);
  } catch {
    return undefined;
  }
}

function getServerSnapshot(): undefined {
  return undefined;
}

export default function ChangelogNewBadge({
  latestId,
  variant = 'pill',
}: ChangelogNewBadgeProps) {
  const lastSeen = useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);
  const isUnread = Boolean(latestId && lastSeen !== undefined && lastSeen !== latestId);

  if (!isUnread) {
    return null;
  }

  if (variant === 'dot') {
    return (
      <span
        className="inline-flex h-2 w-2 rounded-full bg-blue-600 shrink-0"
        aria-label="New updates available"
        title="New updates available"
      />
    );
  }

  return (
    <span className="inline-flex items-center bg-blue-600 text-white text-[9px] font-black uppercase tracking-widest px-2 py-0.5 rounded-full shadow-xs shrink-0">
      NEW
    </span>
  );
}
