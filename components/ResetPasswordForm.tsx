"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { AlertCircle, CheckCircle2, Lock } from "lucide-react";

const PASSWORD_MIN_LENGTH = 8;
const PASSWORD_MAX_BYTES = 72;

export default function ResetPasswordForm({
  initialToken,
}: {
  initialToken: string;
}) {
  const [token] = useState(initialToken.trim());
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [tokenRejected, setTokenRejected] = useState(false);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const signInLinkRef = useRef<HTMLAnchorElement>(null);

  useEffect(() => {
    if (typeof window !== "undefined" && window.location.search.includes("token=")) {
      window.history.replaceState({}, "", "/reset-password");
    }
  }, []);

  useEffect(() => {
    if (successMessage) {
      requestAnimationFrame(() => signInLinkRef.current?.focus());
    }
  }, [successMessage]);

  if (!token) {
    return (
      <div className="space-y-6 text-center">
        <div
          role="alert"
          className="flex items-center gap-3 p-4 bg-red-50 border border-red-100 rounded-xl text-red-700 text-left"
        >
          <AlertCircle size={18} className="shrink-0" aria-hidden="true" />
          <p className="text-xs font-bold">
            Invalid or missing password reset link.
          </p>
        </div>
        <p className="text-xs font-medium text-slate-600 leading-relaxed">
          Please request a new reset email from the login screen.
        </p>
        <Link
          href="/login"
          className="inline-flex items-center justify-center w-full min-h-11 bg-blue-600 hover:bg-blue-700 text-white font-black uppercase italic tracking-widest py-4 rounded-2xl shadow-xl shadow-blue-500/20 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-600 focus-visible:ring-offset-2 transition-all text-xs"
        >
          Back to Login
        </Link>
      </div>
    );
  }

  if (successMessage) {
    return (
      <div role="status" className="space-y-6 text-center">
        <div className="flex items-center gap-3 p-4 bg-emerald-50 border border-emerald-100 rounded-xl text-emerald-700 text-left">
          <CheckCircle2 size={18} className="shrink-0" aria-hidden="true" />
          <p className="text-xs font-bold">
            {successMessage}
          </p>
        </div>
        <Link
          ref={signInLinkRef}
          href="/login"
          className="inline-flex items-center justify-center w-full min-h-11 bg-blue-600 hover:bg-blue-700 text-white font-black uppercase italic tracking-widest py-4 rounded-2xl shadow-xl shadow-blue-500/20 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-600 focus-visible:ring-offset-2 transition-all text-xs"
        >
          Sign In to Front Office
        </Link>
      </div>
    );
  }

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    setTokenRejected(false);

    if (newPassword !== newPassword.trim()) {
      setError("Password cannot start or end with spaces.");
      return;
    }
    if (newPassword.length < PASSWORD_MIN_LENGTH) {
      setError(`Password must be at least ${PASSWORD_MIN_LENGTH} characters.`);
      return;
    }
    if (new TextEncoder().encode(newPassword).length > PASSWORD_MAX_BYTES) {
      setError(`Password must be at most ${PASSWORD_MAX_BYTES} bytes.`);
      return;
    }
    if (newPassword !== confirmPassword) {
      setError("Passwords do not match.");
      return;
    }

    setLoading(true);
    try {
      const res = await fetch("/api/password-reset/confirm", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token, newPassword }),
      });
      const data = await res.json().catch(() => null);
      if (!res.ok) {
        const msg = data?.error || "Unable to reset password. Please request a new link.";
        setError(msg);
        setTokenRejected(!/^Password /i.test(String(msg)));
      } else {
        setSuccessMessage(
          data?.message || "Your password has been updated. You can now sign in.",
        );
      }
    } catch {
      setError("A connection error occurred. Please try again.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      {error && (
        <div role="alert" className="space-y-2 p-4 bg-red-50 border border-red-100 rounded-xl text-red-700">
          <div className="flex items-center gap-3">
            <AlertCircle size={18} className="shrink-0" aria-hidden="true" />
            <p className="text-xs font-bold">
              {error}
            </p>
          </div>
          {tokenRejected && (
            <Link
              href="/login"
              className="inline-flex min-h-11 items-center text-xs font-bold text-blue-600 hover:text-blue-700 underline ml-7 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-600 rounded"
            >
              Request a new reset link
            </Link>
          )}
        </div>
      )}

      <div className="space-y-2 text-left">
        <label
          htmlFor="new-password"
          className="block text-[11px] font-black uppercase tracking-widest text-slate-600 ml-2"
        >
          New Team Password
        </label>
        <div className="relative">
          <Lock
            aria-hidden="true"
            className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-500"
          />
          <input
            id="new-password"
            name="newPassword"
            type="password"
            required
            minLength={PASSWORD_MIN_LENGTH}
            maxLength={PASSWORD_MAX_BYTES}
            autoComplete="new-password"
            value={newPassword}
            onChange={(e) => setNewPassword(e.target.value)}
            className="w-full bg-slate-50 border-2 border-slate-200 rounded-2xl py-4 pl-12 pr-6 text-sm font-bold outline-none focus:border-blue-600 focus:bg-white transition-all text-slate-900 placeholder:text-slate-500"
            placeholder="Minimum 8 characters"
          />
        </div>
      </div>

      <div className="space-y-2 text-left">
        <label
          htmlFor="confirm-password"
          className="block text-[11px] font-black uppercase tracking-widest text-slate-600 ml-2"
        >
          Confirm New Password
        </label>
        <div className="relative">
          <Lock
            aria-hidden="true"
            className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-500"
          />
          <input
            id="confirm-password"
            name="confirmPassword"
            type="password"
            required
            minLength={PASSWORD_MIN_LENGTH}
            maxLength={PASSWORD_MAX_BYTES}
            autoComplete="new-password"
            value={confirmPassword}
            onChange={(e) => setConfirmPassword(e.target.value)}
            className="w-full bg-slate-50 border-2 border-slate-200 rounded-2xl py-4 pl-12 pr-6 text-sm font-bold outline-none focus:border-blue-600 focus:bg-white transition-all text-slate-900 placeholder:text-slate-500"
            placeholder="Re-enter password"
          />
        </div>
      </div>

      <button
        type="submit"
        disabled={loading}
        className="w-full min-h-11 bg-blue-600 hover:bg-blue-700 disabled:bg-slate-200 disabled:text-slate-600 disabled:shadow-none disabled:cursor-not-allowed text-white font-black uppercase italic tracking-widest py-5 rounded-2xl shadow-xl shadow-blue-500/20 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-600 focus-visible:ring-offset-2 transition-all active:scale-[0.98]"
      >
        {loading ? "Updating Password..." : "Update Password"}
      </button>
    </form>
  );
}
