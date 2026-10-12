'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { DraftPick } from '@/types';

type PrevPick = { timestamp?: string | null } | null | undefined;

const DEFAULT_CLOCK_MINUTES = 1440;

function pad(n: number): string {
  return n.toString().padStart(2, '0');
}

function formatHMS(ms: number): string {
  const h = Math.floor(ms / (1000 * 60 * 60));
  const m = Math.floor((ms / (1000 * 60)) % 60);
  const s = Math.floor((ms / 1000) % 60);
  return `${pad(h)}:${pad(m)}:${pad(s)}`;
}

function formatDHMS(ms: number): string {
  const d = Math.floor(ms / (1000 * 60 * 60 * 24));
  if (d <= 0) return formatHMS(ms);
  const h = Math.floor((ms / (1000 * 60 * 60)) % 24);
  const m = Math.floor((ms / (1000 * 60)) % 60);
  const s = Math.floor((ms / 1000) % 60);
  return `${d}d ${pad(h)}:${pad(m)}:${pad(s)}`;
}

/**
 * Owns the once-per-second countdown tick. Keeping this state inside a small
 * component means a tick re-renders only the clock, not the whole draft board.
 */
export function useDraftCountdown(opts: {
  onClockPick: DraftPick | null | undefined;
  previousPick: PrevPick;
  draftStartDate: Date | null;
  onExpire?: () => void;
  onStart?: () => void;
}): { timeLeft: string; progress: number; isScheduledFuture: boolean } {
  const { onClockPick, previousPick, draftStartDate, onExpire, onStart } = opts;
  const [timeLeft, setTimeLeft] = useState('00:00:00');
  const [progress, setProgress] = useState(100);
  const [isScheduledFuture, setIsScheduledFuture] = useState(false);
  // Separate guards: the future-scheduled branch and the running-clock branch
  // are mutually exclusive per pick, but a scheduled pick transitions from one
  // to the other without its `overall` changing — sharing a single ref would
  // let the start-fire suppress the later expire-fire.
  const startedRef = useRef(false);
  const expiredRef = useRef(false);

  const scheduledAtMs = onClockPick?.scheduledAt ? new Date(onClockPick.scheduledAt).getTime() : null;

  // Reset both guards whenever the on-clock pick changes.
  useEffect(() => {
    startedRef.current = false;
    expiredRef.current = false;
  }, [onClockPick?.overall]);

  useEffect(() => {
    if (!onClockPick) return;

    // Future scheduled start — count down to it, then reload the board.
    if (scheduledAtMs !== null && scheduledAtMs > Date.now()) {
      const computeCountdown = () => {
        const diff = scheduledAtMs - Date.now();
        setIsScheduledFuture(true);
        if (diff <= 0) {
          setTimeLeft('STARTING');
          setProgress(100);
          // fire-once guard — this branch ticks every second once reached
          if (!startedRef.current) {
            startedRef.current = true;
            onStart?.();
          }
        } else {
          setTimeLeft(formatDHMS(diff));
          setProgress(100);
        }
      };
      computeCountdown();
      const id = setInterval(computeCountdown, 1000);
      return () => clearInterval(id);
    }

    const clockMins = (onClockPick as { clockMinutes?: number | null }).clockMinutes ?? DEFAULT_CLOCK_MINUTES;
    const limitMs = clockMins * 60 * 1000;
    const draftFloorMs = draftStartDate ? draftStartDate.getTime() : 0;
    const apiClockStart = onClockPick.effectiveClockStart;
    const rawClockStartMs = apiClockStart
      ? new Date(apiClockStart).getTime()
      : scheduledAtMs && scheduledAtMs <= Date.now()
        ? scheduledAtMs
        : previousPick?.timestamp ? new Date(previousPick.timestamp).getTime() : Date.now();
    const clockStartMs = (draftFloorMs > 0 && rawClockStartMs < draftFloorMs) ? draftFloorMs : rawClockStartMs;
    const expiryTime = clockStartMs + limitMs;

    const computeAndSet = () => {
      const diff = expiryTime - Date.now();
      setIsScheduledFuture(false);
      if (diff <= 0) {
        setTimeLeft('EXPIRED');
        setProgress(0);
        if (!expiredRef.current) {
          expiredRef.current = true;
          onExpire?.();
        }
      } else {
        setTimeLeft(formatHMS(diff));
        // Clamp — clockStartMs can be ahead of now/newer than the limit.
        setProgress(Math.min(100, (diff / limitMs) * 100));
      }
    };
    computeAndSet();
    const id = setInterval(computeAndSet, 1000);
    return () => clearInterval(id);
  }, [onClockPick, scheduledAtMs, previousPick, draftStartDate, onExpire, onStart]);

  return {
    timeLeft,
    progress,
    isScheduledFuture,
  };
}

/** Big "on the clock" display. Owns the timer and fires the expire side-effect. */
export function DraftClock({
  onClockPick,
  previousPick,
  draftStartDate,
  loadData,
}: {
  onClockPick: DraftPick | null | undefined;
  previousPick: PrevPick;
  draftStartDate: Date | null;
  loadData?: (fresh?: boolean) => void;
}) {
  const onStart = useCallback(() => { loadData?.(true); }, [loadData]);
  const onExpire = useCallback(() => {
    fetch('/api/draft-picks/expire', { method: 'POST' })
      .then(() => loadData?.(true))
      .catch(() => loadData?.(true));
  }, [loadData]);

  const { timeLeft, progress, isScheduledFuture } = useDraftCountdown({
    onClockPick, previousPick, draftStartDate, onExpire, onStart,
  });

  return (
    <div className="bg-slate-800/50 p-8 rounded-[2.5rem] border border-slate-700 w-full md:min-w-[300px] text-center relative overflow-hidden">
      <p className="text-5xl md:text-8xl font-mono font-black text-amber-400 tabular-nums drop-shadow-[0_0_20px_rgba(251,191,36,0.3)]">
        {timeLeft}
      </p>
      <p className="text-[10px] font-black text-slate-500 uppercase mt-4 tracking-widest">
        {isScheduledFuture ? 'Starts In' : 'Remaining Selection Time'}
      </p>
      <div className="absolute bottom-0 left-0 w-full h-1.5 bg-slate-700/30">
        <div
          className={`h-full transition-all duration-1000 ease-linear ${
            progress < 10
              ? 'bg-red-500 shadow-[0_0_15px_rgba(239,68,68,0.4)]'
              : 'bg-amber-400 shadow-[0_0_15px_rgba(251,191,36,0.4)]'
          }`}
          style={{ width: `${progress}%` }}
        />
      </div>
    </div>
  );
}

/** Display-only countdown text for the on-clock row/card. No expire side-effect. */
export function LiveCountdown({
  onClockPick,
  previousPick,
  draftStartDate,
}: {
  onClockPick: DraftPick | null | undefined;
  previousPick: PrevPick;
  draftStartDate: Date | null;
}) {
  const { timeLeft } = useDraftCountdown({ onClockPick, previousPick, draftStartDate });
  return <>{timeLeft}</>;
}

/** Pre-draft countdown. Owns its own tick so the board doesn't re-render. */
export function PreDraftClock({
  draftStartDate,
  loadData,
}: {
  draftStartDate: Date | null;
  loadData?: (fresh?: boolean) => void;
}) {
  const [text, setText] = useState('');

  useEffect(() => {
    if (!draftStartDate) return;
    const target = draftStartDate.getTime();
    let fired = false;
    const tick = () => {
      const diff = target - Date.now();
      if (diff <= 0) {
        setText('STARTING');
        if (!fired) { fired = true; loadData?.(true); }
        return;
      }
      setText(formatDHMS(diff));
    };
    tick();
    const id = setInterval(tick, 1000);
    return () => clearInterval(id);
  }, [draftStartDate, loadData]);

  if (!draftStartDate || !text) return null;
  return (
    <p className="text-5xl md:text-8xl font-mono font-black text-amber-400 tabular-nums drop-shadow-[0_0_20px_rgba(251,191,36,0.3)]">
      {text}
    </p>
  );
}
