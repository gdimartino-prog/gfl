"use client";

import { useState } from "react";
import { User, Lock, Mail, Phone, Hash, ShieldCheck, AlertCircle, CheckCircle } from "lucide-react";
import Link from "next/link";

export default function SignupForm() {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setLoading(true);
    setError(null);

    const formData = new FormData(event.currentTarget);
    const password = formData.get("password") as string;
    const confirm = formData.get("confirm") as string;

    if (password !== confirm) {
      setError("Passwords do not match.");
      setLoading(false);
      return;
    }

    if (password.length < 6) {
      setError("Password must be at least 6 characters.");
      setLoading(false);
      return;
    }

    try {
      const res = await fetch("/api/signup", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          leagueId: formData.get("leagueId"),
          teamName: formData.get("teamName"),
          teamShort: formData.get("teamShort"),
          coachName: formData.get("coachName"),
          email: formData.get("email"),
          mobile: formData.get("mobile"),
          password,
        }),
      });

      const data = await res.json();

      if (!res.ok) {
        setError(data.error || "Registration failed.");
      } else {
        setSuccess(true);
      }
    } catch {
      setError("A connection error occurred.");
    } finally {
      setLoading(false);
    }
  }

  if (success) {
    return (
      <div className="text-center space-y-6">
        <div className="w-16 h-16 bg-emerald-50 text-emerald-600 rounded-2xl flex items-center justify-center mx-auto">
          <CheckCircle size={32} />
        </div>
        <div>
          <h3 className="text-2xl font-black uppercase italic tracking-tighter text-slate-900">
            Registration <span className="text-emerald-600">Submitted</span>
          </h3>
          <p className="text-[11px] font-bold text-slate-500 uppercase tracking-tight mt-3 leading-relaxed">
            Your application is pending approval by the League Commissioner. You will be able to log in once approved.
          </p>
        </div>
        <Link
          href="/login"
          className="block w-full bg-slate-900 text-white text-center font-black uppercase tracking-widest py-4 rounded-xl text-[10px] hover:bg-blue-600 transition-all"
        >
          Back to Login
        </Link>
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-5">
      {error && (
        <div className="flex items-center gap-3 p-4 bg-red-50 border border-red-100 rounded-xl text-red-600 animate-in slide-in-from-top-2">
          <AlertCircle size={18} />
          <p className="text-[10px] font-black uppercase tracking-widest">{error}</p>
        </div>
      )}

      {/* League ID */}
      <div className="space-y-2">
        <label className="block text-[10px] font-black uppercase tracking-widest text-slate-400 ml-2">
          League ID <span className="text-red-400">*</span>
        </label>
        <div className="relative">
          <ShieldCheck className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-300" />
          <input
            name="leagueId"
            type="number"
            required
            min={1}
            className="w-full bg-slate-50 border-2 border-slate-50 rounded-2xl py-4 pl-12 pr-6 text-sm font-bold outline-none focus:border-blue-500 focus:bg-white transition-all text-slate-900 placeholder:text-slate-300"
            placeholder="Provided by your commissioner"
          />
        </div>
      </div>

      {/* Coach Name */}
      <div className="space-y-2">
        <label className="block text-[10px] font-black uppercase tracking-widest text-slate-400 ml-2">
          Coach Name <span className="text-red-400">*</span>
        </label>
        <div className="relative">
          <User className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-300" />
          <input
            name="coachName"
            type="text"
            required
            className="w-full bg-slate-50 border-2 border-slate-50 rounded-2xl py-4 pl-12 pr-6 text-sm font-bold outline-none focus:border-blue-500 focus:bg-white transition-all text-slate-900 placeholder:text-slate-300"
            placeholder="Your full name"
          />
        </div>
      </div>

      {/* Team Name + Shortcode row */}
      <div className="grid grid-cols-2 gap-3">
        <div className="space-y-2">
          <label className="block text-[10px] font-black uppercase tracking-widest text-slate-400 ml-2">
            Team Name <span className="text-red-400">*</span>
          </label>
          <input
            name="teamName"
            type="text"
            required
            className="w-full bg-slate-50 border-2 border-slate-50 rounded-2xl py-4 px-4 text-sm font-bold outline-none focus:border-blue-500 focus:bg-white transition-all text-slate-900 placeholder:text-slate-300"
            placeholder="e.g. Amalfi"
          />
        </div>
        <div className="space-y-2">
          <label className="block text-[10px] font-black uppercase tracking-widest text-slate-400 ml-2">
            Shortcode <span className="text-red-400">*</span>
          </label>
          <div className="relative">
            <Hash className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-300" />
            <input
              name="teamShort"
              type="text"
              required
              maxLength={6}
              className="w-full bg-slate-50 border-2 border-slate-50 rounded-2xl py-4 pl-9 pr-4 text-sm font-bold outline-none focus:border-blue-500 focus:bg-white transition-all text-slate-900 placeholder:text-slate-300 uppercase"
              placeholder="e.g. AML"
              onChange={e => { e.target.value = e.target.value.toUpperCase(); }}
            />
          </div>
        </div>
      </div>

      {/* Email */}
      <div className="space-y-2">
        <label className="block text-[10px] font-black uppercase tracking-widest text-slate-400 ml-2">
          Email Address
        </label>
        <div className="relative">
          <Mail className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-300" />
          <input
            name="email"
            type="email"
            className="w-full bg-slate-50 border-2 border-slate-50 rounded-2xl py-4 pl-12 pr-6 text-sm font-bold outline-none focus:border-blue-500 focus:bg-white transition-all text-slate-900 placeholder:text-slate-300"
            placeholder="Optional"
          />
        </div>
      </div>

      {/* Mobile */}
      <div className="space-y-2">
        <label className="block text-[10px] font-black uppercase tracking-widest text-slate-400 ml-2">
          Mobile
        </label>
        <div className="relative">
          <Phone className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-300" />
          <input
            name="mobile"
            type="tel"
            className="w-full bg-slate-50 border-2 border-slate-50 rounded-2xl py-4 pl-12 pr-6 text-sm font-bold outline-none focus:border-blue-500 focus:bg-white transition-all text-slate-900 placeholder:text-slate-300"
            placeholder="Optional"
          />
        </div>
      </div>

      {/* Password */}
      <div className="space-y-2">
        <label className="block text-[10px] font-black uppercase tracking-widest text-slate-400 ml-2">
          Password <span className="text-red-400">*</span>
        </label>
        <div className="relative">
          <Lock className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-300" />
          <input
            name="password"
            type="password"
            required
            className="w-full bg-slate-50 border-2 border-slate-50 rounded-2xl py-4 pl-12 pr-6 text-sm font-bold outline-none focus:border-blue-500 focus:bg-white transition-all text-slate-900 placeholder:text-slate-300"
            placeholder="Min. 6 characters"
          />
        </div>
      </div>

      {/* Confirm Password */}
      <div className="space-y-2">
        <label className="block text-[10px] font-black uppercase tracking-widest text-slate-400 ml-2">
          Confirm Password <span className="text-red-400">*</span>
        </label>
        <div className="relative">
          <Lock className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-300" />
          <input
            name="confirm"
            type="password"
            required
            className="w-full bg-slate-50 border-2 border-slate-50 rounded-2xl py-4 pl-12 pr-6 text-sm font-bold outline-none focus:border-blue-500 focus:bg-white transition-all text-slate-900 placeholder:text-slate-300"
            placeholder="••••••••"
          />
        </div>
      </div>

      <button
        type="submit"
        disabled={loading}
        className="w-full bg-blue-600 hover:bg-blue-700 disabled:bg-slate-200 text-white font-black uppercase italic tracking-widest py-5 rounded-2xl shadow-xl shadow-blue-500/20 transition-all active:scale-[0.98]"
      >
        {loading ? "Submitting Application..." : "Submit Registration"}
      </button>

      <p className="text-center text-[10px] font-black text-slate-400 uppercase tracking-widest">
        Already have an account?{" "}
        <Link href="/login" className="text-blue-500 hover:text-blue-700 transition-colors">
          Login
        </Link>
      </p>
    </form>
  );
}
