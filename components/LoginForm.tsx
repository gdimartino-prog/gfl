"use client";

import { signIn, SignInResponse } from "next-auth/react";
import { useState, useEffect, useMemo, useRef, useCallback } from "react";
import {
  User,
  Lock,
  HelpCircle,
  X,
  AlertCircle,
  Shield,
  Mail,
  CheckCircle2,
  ChevronDown,
} from "lucide-react";

interface LeagueOption { id: number; name: string; }

export default function LoginForm() {
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [showForgotModal, setShowForgotModal] = useState(false);
  const [leagues, setLeagues] = useState<LeagueOption[]>([]);
  const [leaguesStatus, setLeaguesStatus] = useState<'loading' | 'loaded' | 'error'>('loading');
  const [leagueId, setLeagueId] = useState<string>('');
  const [resetLeagueId, setResetLeagueId] = useState<string>('');
  const [resetIdentifier, setResetIdentifier] = useState<string>('');
  const [resetLoading, setResetLoading] = useState(false);
  const [resetError, setResetError] = useState<string | null>(null);
  const [resetMessage, setResetMessage] = useState<string | null>(null);

  const forgotButtonRef = useRef<HTMLButtonElement>(null);
  const modalRef = useRef<HTMLDivElement>(null);
  const closeButtonRef = useRef<HTMLButtonElement>(null);
  const resetLeagueRef = useRef<HTMLSelectElement>(null);
  const resetIdentifierRef = useRef<HTMLInputElement>(null);
  const confirmCloseRef = useRef<HTMLButtonElement>(null);

  const resettableLeagues = useMemo(
    () => leagues.filter((l) => l.id !== 2),
    [leagues],
  );

  const effectiveResetLeagueId = useMemo(() => {
    if (resetLeagueId && resettableLeagues.some((l) => String(l.id) === resetLeagueId)) {
      return resetLeagueId;
    }
    if (resettableLeagues.length === 1) {
      return String(resettableLeagues[0].id);
    }
    return '';
  }, [resetLeagueId, resettableLeagues]);

  const fetchLeagues = useCallback(() => {
    const savedLeagueId =
      document.cookie.split('; ').find((r) => r.startsWith('gfl-league-id='))?.split('=')[1] ?? '';
    fetch('/api/leagues?public=true')
      .then((r) => {
        if (!r.ok) throw new Error('Failed to load leagues');
        return r.json();
      })
      .then((data: LeagueOption[]) => {
        setLeagues(data);
        setLeaguesStatus('loaded');
        if (savedLeagueId && data.some((l: LeagueOption) => String(l.id) === savedLeagueId)) {
          setLeagueId(savedLeagueId);
        }
      })
      .catch(() => {
        setLeaguesStatus('error');
      });
  }, []);

  useEffect(() => {
    fetchLeagues();
  }, [fetchLeagues]);

  const closeForgotModal = useCallback(() => {
    setShowForgotModal(false);
    requestAnimationFrame(() => {
      forgotButtonRef.current?.focus();
    });
  }, []);

  useEffect(() => {
    if (!showForgotModal) return;

    const focusTimer = requestAnimationFrame(() => {
      if (resetMessage) {
        confirmCloseRef.current?.focus();
      } else if (resettableLeagues.length > 1 && resetLeagueRef.current) {
        resetLeagueRef.current.focus();
      } else if (resetIdentifierRef.current) {
        resetIdentifierRef.current.focus();
      } else {
        closeButtonRef.current?.focus();
      }
    });

    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.preventDefault();
        closeForgotModal();
        return;
      }
      if (e.key !== 'Tab' || !modalRef.current) return;

      const focusable = Array.from(
        modalRef.current.querySelectorAll<HTMLElement>(
          'a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])',
        ),
      ).filter((el) => el.offsetParent !== null);

      if (focusable.length === 0) return;
      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      const active = document.activeElement as HTMLElement | null;

      if (e.shiftKey) {
        if (!active || active === first || !modalRef.current.contains(active)) {
          e.preventDefault();
          last.focus();
        }
      } else if (!active || active === last || !modalRef.current.contains(active)) {
        e.preventDefault();
        first.focus();
      }
    };

    window.addEventListener('keydown', onKeyDown);
    return () => {
      cancelAnimationFrame(focusTimer);
      window.removeEventListener('keydown', onKeyDown);
    };
  }, [showForgotModal, resetMessage, resettableLeagues.length, closeForgotModal]);

  function openForgotModal() {
    const initial =
      leagueId && resettableLeagues.some((l) => String(l.id) === leagueId)
        ? leagueId
        : resettableLeagues.length === 1
          ? String(resettableLeagues[0].id)
          : '';
    setResetLeagueId(initial);
    setResetIdentifier('');
    setResetError(null);
    setResetMessage(null);
    setResetLoading(false);
    setShowForgotModal(true);
  }

  function handleRetryLeagues() {
    setLeaguesStatus('loading');
    fetchLeagues();
  }

  async function handleResetRequest(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setResetError(null);

    if (!effectiveResetLeagueId) {
      setResetError("Please select a league.");
      return;
    }
    const cleanIdentifier = resetIdentifier.trim();
    if (!cleanIdentifier) {
      setResetError("Please enter your team name, short code, or email.");
      return;
    }

    setResetLoading(true);
    try {
      const res = await fetch('/api/password-reset/request', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          leagueId: Number(effectiveResetLeagueId),
          identifier: cleanIdentifier,
        }),
      });
      const data = await res.json().catch(() => null);
      if (!res.ok) {
        setResetError(data?.error || "Unable to send reset link. Please try again.");
      } else {
        setResetMessage(
          data?.message ||
            "If an active team in that league has an email on file, a password reset link has been sent.",
        );
      }
    } catch {
      setResetError("A connection error occurred. Please try again.");
    } finally {
      setResetLoading(false);
    }
  }

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setLoading(true);
    setError(null);

    if (!leagueId) {
      setError("Please select a league.");
      setLoading(false);
      return;
    }

    const formData = new FormData(event.currentTarget);
    const data = Object.fromEntries(formData);

    try {
      const result = (await signIn("credentials", {
        username: data.username as string,
        password: data.password as string,
        leagueId,
        redirect: false,
      })) as SignInResponse;

      if (result?.error) {
        setError("Invalid credentials. Please check your team name, email, or password.");
        setLoading(false);
      } else {
        // Set the active league cookie so all pages load the correct league
        if (leagueId) {
          document.cookie = `gfl-league-id=${leagueId}; path=/; max-age=${60 * 60 * 24 * 365}; SameSite=Lax`;
        }
        window.location.href = "/";
      }
    } catch {
      setError("A connection error occurred.");
      setLoading(false);
    }
  }

  async function handleDemoLogin() {
    setLoading(true);
    setError(null);
    try {
      const result = (await signIn("credentials", {
        username: "demo",
        password: "demo",
        redirect: false,
      })) as SignInResponse;
      if (result?.error) {
        setError("Demo login unavailable. Please contact the league office.");
        setLoading(false);
      } else {
        // Force AFL (league 2) as the active league for demo users
        document.cookie = `gfl-league-id=2; path=/; max-age=${60 * 60 * 24 * 365}; SameSite=Lax`;
        window.location.href = "/";
      }
    } catch {
      setError("A connection error occurred.");
      setLoading(false);
    }
  }

  return (
    <>
      {/* 1. LOGIN FORM */}
      <form onSubmit={handleSubmit} className="space-y-6">
        <div className="border-b border-slate-100 pb-6">
          <p className="text-center text-[9px] font-bold text-slate-400 uppercase tracking-widest mb-4">
            Just browsing?
          </p>
          <button
            type="button"
            disabled={loading}
            onClick={handleDemoLogin}
            className="w-full bg-slate-800 hover:bg-slate-700 disabled:bg-slate-200 disabled:text-slate-600 text-white font-black uppercase italic tracking-widest py-4 rounded-2xl transition-all active:scale-[0.98] text-sm"
          >
            View Demo League →
          </button>
        </div>

        {error && (
          <div role="alert" className="flex items-center gap-3 p-4 bg-red-50 border border-red-100 rounded-xl text-red-600 animate-in slide-in-from-top-2">
            <AlertCircle size={18} aria-hidden="true" />
            <p className="text-[10px] font-black uppercase tracking-widest">
               {error}
            </p>
          </div>
        )}

        {leagues.length > 1 && (
          <div className="space-y-2 text-left">
            <label className="block text-[10px] font-black uppercase tracking-widest text-slate-400 ml-2">
              League
            </label>
            <div className="relative">
              <Shield className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-300" aria-hidden="true" />
              <select
                value={leagueId}
                onChange={e => setLeagueId(e.target.value)}
                required
                className="w-full bg-slate-50 border-2 border-slate-50 rounded-2xl py-4 pl-12 pr-6 text-sm font-bold outline-none focus:border-blue-500 focus:bg-white transition-all text-slate-900 appearance-none cursor-pointer"
              >
                <option value="">Select league...</option>
                {leagues.map(l => (
                  <option key={l.id} value={String(l.id)}>{l.name}</option>
                ))}
              </select>
            </div>
          </div>
        )}

        <div className="space-y-2 text-left">
          <label className="block text-[10px] font-black uppercase tracking-widest text-slate-400 ml-2">
            Team Name or Email
          </label>
          <div className="relative">
            <User className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-300" aria-hidden="true" />
            <input
              name="username"
              type="text"
              required
              className="w-full bg-slate-50 border-2 border-slate-50 rounded-2xl py-4 pl-12 pr-6 text-sm font-bold outline-none focus:border-blue-500 focus:bg-white transition-all text-slate-900 placeholder:text-slate-300"
              placeholder="Team name or email address"
            />
          </div>
        </div>

        <div className="space-y-2 text-left">
          <label className="block text-[10px] font-black uppercase tracking-widest text-slate-400 ml-2">
            Team Password
          </label>
          <div className="relative">
            <Lock className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-300" aria-hidden="true" />
            <input
              name="password"
              type="password"
              required
              className="w-full bg-slate-50 border-2 border-slate-50 rounded-2xl py-4 pl-12 pr-6 text-sm font-bold outline-none focus:border-blue-500 focus:bg-white transition-all text-slate-900 placeholder:text-slate-300"
              placeholder="••••••••"
            />
          </div>
        </div>

        <div className="flex items-center gap-2 px-1">
          <input
            id="remember"
            name="remember"
            type="checkbox"
            className="w-4 h-4 rounded border-slate-300 text-blue-600 focus:ring-blue-500 cursor-pointer transition-all"
            defaultChecked
          />
          <label
            htmlFor="remember"
            className="text-[10px] font-black uppercase tracking-widest text-slate-500 cursor-pointer select-none hover:text-slate-700 transition-colors"
          >
            Keep me logged in
          </label>
        </div>

        <button
          type="submit"
          disabled={loading}
          className="w-full bg-blue-600 hover:bg-blue-700 disabled:bg-slate-200 disabled:text-slate-600 text-white font-black uppercase italic tracking-widest py-5 rounded-2xl shadow-xl shadow-blue-500/20 transition-all active:scale-[0.98]"
        >
          {loading ? "Verifying Credentials..." : "Enter Front Office"}
        </button>

        <div className="flex flex-col gap-4 pt-2">
          <p className="text-center text-[9px] font-bold text-slate-400 uppercase tracking-tighter italic">
            Authorized Personnel Only
          </p>

          <button
            ref={forgotButtonRef}
            type="button"
            onClick={openForgotModal}
            className="text-center text-[10px] font-black text-slate-600 uppercase tracking-widest hover:text-blue-600 transition-colors min-h-11 inline-flex items-center justify-center rounded-xl focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-600"
          >
            Forgot Password?
          </button>
        </div>

      </form>

      {/* 2. PASSWORD RESET REQUEST MODAL */}
      {showForgotModal && (
        <div
          role="dialog"
          aria-modal="true"
          aria-labelledby="forgot-password-title"
          onClick={(e) => {
            if (e.target === e.currentTarget) closeForgotModal();
          }}
          className="fixed inset-0 z-[100] flex items-start sm:items-center justify-center overflow-y-auto p-4 bg-slate-900/60 backdrop-blur-sm animate-in fade-in duration-300"
        >
          <div
            ref={modalRef}
            className="my-auto max-h-[calc(100dvh-2rem)] overflow-y-auto bg-white rounded-[2.5rem] p-6 sm:p-8 max-w-sm w-full shadow-2xl relative border border-slate-100 text-left"
          >
            <button
              ref={closeButtonRef}
              type="button"
              aria-label="Close password reset dialog"
              onClick={closeForgotModal}
              className="absolute top-4 right-4 flex h-11 w-11 items-center justify-center rounded-full text-slate-500 hover:bg-slate-100 hover:text-slate-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-600 transition-colors"
            >
              <X size={20} aria-hidden="true" />
            </button>

            <div
              className={`w-14 h-14 rounded-2xl flex items-center justify-center mb-6 ${
                resetMessage
                  ? 'bg-emerald-50 text-emerald-600'
                  : 'bg-blue-50 text-blue-600'
              }`}
            >
              {resetMessage ? (
                <CheckCircle2 size={28} aria-hidden="true" />
              ) : (
                <HelpCircle size={28} aria-hidden="true" />
              )}
            </div>

            <h2
              id="forgot-password-title"
              className="text-2xl font-black uppercase italic tracking-tighter text-slate-900 mb-3"
            >
              Password <span className="text-blue-600">Reset</span>
            </h2>

            {resetMessage ? (
              <div role="status" className="space-y-5">
                <p className="text-xs font-semibold text-slate-700 leading-relaxed">
                  {resetMessage}
                </p>
                <p className="text-xs font-medium text-slate-600 leading-relaxed">
                  Links expire in 30 minutes. No email on file? Contact your league commissioner to reset your password.
                </p>
                <button
                  ref={confirmCloseRef}
                  type="button"
                  onClick={closeForgotModal}
                  className="w-full min-h-11 bg-blue-600 text-white font-black uppercase tracking-widest py-3.5 rounded-xl text-xs shadow-lg shadow-blue-500/20 hover:bg-blue-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-600 focus-visible:ring-offset-2 transition-all"
                >
                  Back to Login
                </button>
              </div>
            ) : (
              <form onSubmit={handleResetRequest} className="space-y-4">
                <p className="text-xs font-medium text-slate-600 leading-relaxed">
                  Enter your team name, short code, or email address and we&apos;ll send a single-use reset link to the email on file.
                </p>

                {resetError && (
                  <div
                    role="alert"
                    className="flex items-center gap-2.5 p-3 bg-red-50 border border-red-100 rounded-xl text-red-700"
                  >
                    <AlertCircle size={16} className="shrink-0" aria-hidden="true" />
                    <p className="text-xs font-bold">
                      {resetError}
                    </p>
                  </div>
                )}

                {resettableLeagues.length === 0 && (
                  <div
                    role={leaguesStatus === 'error' ? 'alert' : 'status'}
                    className="p-3 bg-slate-50 border border-slate-200 rounded-xl text-xs font-medium text-slate-700 space-y-2"
                  >
                    {leaguesStatus === 'loading' ? (
                      <p>Loading available leagues...</p>
                    ) : (
                      <>
                        <p className="text-red-700 font-semibold">
                          {leaguesStatus === 'error'
                            ? 'Unable to load leagues right now.'
                            : 'No leagues eligible for self-service password reset.'}
                        </p>
                        <button
                          type="button"
                          onClick={handleRetryLeagues}
                          className="inline-flex min-h-11 items-center text-xs font-bold text-blue-600 hover:text-blue-700 underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-600 rounded"
                        >
                          Retry loading leagues
                        </button>
                      </>
                    )}
                  </div>
                )}

                {resettableLeagues.length > 1 && (
                  <div className="space-y-1.5">
                    <label
                      htmlFor="reset-league"
                      className="block text-[11px] font-black uppercase tracking-widest text-slate-600 ml-1"
                    >
                      League
                    </label>
                    <div className="relative">
                      <Shield
                        aria-hidden="true"
                        className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500"
                      />
                      <select
                        ref={resetLeagueRef}
                        id="reset-league"
                        value={effectiveResetLeagueId}
                        onChange={(e) => setResetLeagueId(e.target.value)}
                        required
                        className="w-full bg-slate-50 border-2 border-slate-200 rounded-xl py-3 pl-10 pr-9 text-xs font-bold outline-none focus:border-blue-600 focus:bg-white transition-all text-slate-900 appearance-none cursor-pointer"
                      >
                        <option value="">Select league...</option>
                        {resettableLeagues.map((l) => (
                          <option key={l.id} value={String(l.id)}>
                            {l.name}
                          </option>
                        ))}
                      </select>
                      <ChevronDown
                        aria-hidden="true"
                        className="pointer-events-none absolute right-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500"
                      />
                    </div>
                  </div>
                )}

                <div className="space-y-1.5">
                  <label
                    htmlFor="reset-identifier"
                    className="block text-[11px] font-black uppercase tracking-widest text-slate-600 ml-1"
                  >
                    Team Name, Short Code, or Email
                  </label>
                  <div className="relative">
                    <Mail
                      aria-hidden="true"
                      className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500"
                    />
                    <input
                      ref={resetIdentifierRef}
                      id="reset-identifier"
                      type="text"
                      required
                      autoComplete="username"
                      autoCapitalize="none"
                      spellCheck={false}
                      value={resetIdentifier}
                      onChange={(e) => setResetIdentifier(e.target.value)}
                      placeholder="e.g. GIANTS, NYG, or coach@email.com"
                      className="w-full bg-slate-50 border-2 border-slate-200 rounded-xl py-3 pl-10 pr-4 text-xs font-bold outline-none focus:border-blue-600 focus:bg-white transition-all text-slate-900 placeholder:text-slate-500"
                    />
                  </div>
                </div>

                <div className="pt-2 space-y-2.5">
                  <button
                    type="submit"
                    disabled={resetLoading || resettableLeagues.length === 0}
                    className="w-full min-h-11 bg-blue-600 hover:bg-blue-700 disabled:bg-slate-200 disabled:text-slate-600 disabled:shadow-none disabled:cursor-not-allowed text-white font-black uppercase tracking-widest py-3.5 rounded-xl text-xs shadow-lg shadow-blue-500/20 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-600 focus-visible:ring-offset-2 transition-all"
                  >
                    {resetLoading ? "Sending..." : "Send Reset Link"}
                  </button>
                  <button
                    type="button"
                    onClick={closeForgotModal}
                    className="w-full min-h-11 bg-slate-100 text-slate-700 font-black uppercase tracking-widest py-3.5 rounded-xl text-xs hover:bg-slate-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-600 transition-all"
                  >
                    Back to Login
                  </button>
                </div>
              </form>
            )}
          </div>
        </div>
      )}
    </>
  );
}
