'use client';

import { useState, useEffect } from 'react';
import { useSession } from 'next-auth/react';
import { AlertTriangle, RefreshCw, X } from 'lucide-react';
import type { UnacknowledgedEmailFailures } from '@/lib/emailAlerts';

export default function EmailAlertBanner() {
  const { data: session, status } = useSession();
  const [alert, setAlert] = useState<UnacknowledgedEmailFailures | null>(null);
  const [busy, setBusy] = useState<'dismiss' | 'retry' | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const role = session?.user?.role;
  const isCandidate =
    status === 'authenticated' &&
    (role === 'superuser' || role === 'admin');

  useEffect(() => {
    if (!isCandidate) return;
    let active = true;
    async function loadAlert() {
      try {
        const res = await fetch('/api/admin/email-alerts');
        if (!res.ok) return;
        const data = await res.json();
        if (active && data?.alert) {
          setAlert(data.alert);
        }
      } catch {
        // ignore network errors
      }
    }
    loadAlert();
    return () => {
      active = false;
    };
  }, [isCandidate]);

  if (!alert) return null;

  const formattedTime = (() => {
    try {
      return new Date(alert.latestTimestamp).toLocaleString('en-US', {
        month: 'short',
        day: 'numeric',
        hour: 'numeric',
        minute: '2-digit',
      });
    } catch {
      return alert.latestTimestamp;
    }
  })();

  const handleAction = async (action: 'dismiss' | 'retry-weekly') => {
    setBusy(action === 'dismiss' ? 'dismiss' : 'retry');
    setErrorMsg(null);
    try {
      const res = await fetch('/api/admin/email-alerts', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setErrorMsg(data.error || 'Action failed.');
        return;
      }
      setAlert(null);
    } catch {
      setErrorMsg('Network error — please try again.');
    } finally {
      setBusy(null);
    }
  };

  return (
    <div
      role="alert"
      className="w-full bg-red-600 text-white border-b border-red-700 shadow-md"
    >
      <div className="max-w-7xl mx-auto px-4 py-2.5 flex flex-col sm:flex-row sm:items-center justify-between gap-2.5">
        <div className="flex items-start sm:items-center gap-2.5 min-w-0">
          <AlertTriangle size={16} aria-hidden="true" className="shrink-0 mt-0.5 sm:mt-0 text-amber-200" />
          <div className="text-xs leading-snug min-w-0">
            <span className="font-black uppercase tracking-wider mr-2">
              Email Alert Failed{alert.count > 1 ? ` (${alert.count})` : ''}:
            </span>
            <span className="font-semibold break-words">
              {alert.latestSubject}
            </span>
            <span className="text-red-100 ml-2 whitespace-nowrap text-[11px]">
              ({formattedTime})
            </span>
            {errorMsg && (
              <span className="block sm:inline sm:ml-2 font-bold text-amber-200">
                — {errorMsg}
              </span>
            )}
          </div>
        </div>

        <div className="flex items-center gap-2 shrink-0">
          {alert.hasWeeklyFailure && (
            <button
              type="button"
              onClick={() => handleAction('retry-weekly')}
              disabled={busy !== null}
              className="min-h-11 sm:min-h-8 px-3 py-1.5 rounded-lg bg-white text-red-700 hover:bg-red-50 disabled:opacity-60 text-[10px] font-black uppercase tracking-widest flex items-center gap-1.5 transition-all cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white"
            >
              <RefreshCw size={12} aria-hidden="true" className={busy === 'retry' ? 'animate-spin' : ''} />
              {busy === 'retry' ? 'Sending...' : 'Retry Weekly Email'}
            </button>
          )}
          <button
            type="button"
            onClick={() => handleAction('dismiss')}
            disabled={busy !== null}
            className="min-h-11 sm:min-h-8 px-3 py-1.5 rounded-lg bg-red-800/80 hover:bg-red-900 text-white disabled:opacity-60 text-[10px] font-black uppercase tracking-widest flex items-center gap-1 transition-all cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white"
          >
            <X size={12} aria-hidden="true" />
            {busy === 'dismiss' ? 'Dismissing...' : 'Dismiss'}
          </button>
        </div>
      </div>
    </div>
  );
}
