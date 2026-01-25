"use client";

import { signIn } from "next-auth/react";
import { useState } from "react";

export default function LoginForm() {
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setLoading(true);
    setError(null);

    const formData = new FormData(event.currentTarget);
    const data = Object.fromEntries(formData);

    // Note: Since we set the 30-day maxAge in auth.ts, 
    // the session will persist automatically. 
    const result = await signIn("credentials", {
      username: data.username,
      password: data.password,
      redirect: true,
      callbackUrl: "/", 
    });

    if (result?.error) {
      setError("Invalid team name or password.");
      setLoading(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      {error && (
        <p className="text-[10px] font-black text-red-500 uppercase tracking-widest bg-red-50 p-3 rounded-lg border border-red-100">
          ⚠️ {error}
        </p>
      )}
      
      <div>
        <label className="block text-[10px] font-black uppercase tracking-widest text-slate-400 mb-2">
          League Team Name
        </label>
        <input
          name="username"
          type="text"
          required
          className="w-full rounded-xl border border-slate-200 p-4 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 text-slate-900"
          placeholder="e.g. Vico or Amalfi"
        />
      </div>

      <div>
        <label className="block text-[10px] font-black uppercase tracking-widest text-slate-400 mb-2">
          Team Password
        </label>
        <input
          name="password"
          type="password"
          required
          className="w-full rounded-xl border border-slate-200 p-4 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 text-slate-900"
          placeholder="••••••••"
        />
      </div>

      {/* Remember Me Checkbox */}
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
        className="w-full rounded-xl bg-slate-900 p-4 text-[11px] font-black uppercase tracking-widest text-white hover:bg-slate-800 transition-all shadow-lg active:scale-[0.98] disabled:bg-slate-400"
      >
        {loading ? "Verifying..." : "Access Front Office"}
      </button>

      <div className="flex flex-col gap-3 pt-2">
        <p className="text-center text-[9px] font-bold text-slate-400 uppercase tracking-tighter italic">
          Authorized GFL Personnel Only
        </p>
        
        <a 
          href="mailto:gdimartino@gmail.com?subject=GFL Password Reset Request&body=Coach Name:%0D%0ATeam Name:" 
          className="text-center text-[10px] font-black text-blue-500 uppercase tracking-widest hover:text-blue-700 transition-colors"
        >
          Forgot Password? Contact Commissioner
        </a>
      </div>
    </form>
  );
}