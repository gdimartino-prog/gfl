"use client";

import { signIn, SignInResponse } from "next-auth/react";
import { useState } from "react";
import { User, Lock, HelpCircle, X, AlertCircle } from "lucide-react";

export default function LoginForm() {
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [showForgotModal, setShowForgotModal] = useState(false);

async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setLoading(true);
    setError(null);

    const formData = new FormData(event.currentTarget);
    const data = Object.fromEntries(formData);

    try {
      const result = (await signIn("credentials", {
        username: data.username as string,
        password: data.password as string,
        redirect: false, // Set to false so we can handle the error ourselves
      })) as SignInResponse;

      if (result?.error) {
        setError("Invalid credentials. Please check your team name, email, or password.");
        setLoading(false);
      } else {
        // If no error, manually redirect to the home page
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
      {/* 1. CREDENTIAL RECOVERY MODAL */}
      {showForgotModal && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-in fade-in duration-300">
          <div className="bg-white rounded-[2.5rem] p-8 md:p-10 max-w-sm w-full shadow-2xl relative border border-slate-100 text-left">
            <button 
              onClick={() => setShowForgotModal(false)}
              className="absolute top-6 right-6 text-slate-300 hover:text-slate-600 transition-colors"
            >
              <X size={20} />
            </button>
            
            <div className="w-14 h-14 bg-blue-50 text-blue-600 rounded-2xl flex items-center justify-center mb-6">
              <HelpCircle size={28} />
            </div>
            
            <h3 className="text-2xl font-black uppercase italic tracking-tighter text-slate-900 mb-3">
              Credential <span className="text-blue-600">Recovery</span>
            </h3>
            
            <p className="text-[11px] font-bold text-slate-500 leading-relaxed uppercase tracking-tight">
              Passwords are managed by the League Office. If you are locked out, please contact <span className="text-blue-600">George Di Martino</span> to reset your temporary credentials to your Team ID.
            </p>
            
            <div className="mt-8 space-y-3">
               <a 
                href="mailto:gdimartino@gmail.com?subject=GFL Password Reset Request&body=Coach Name:%0D%0ATeam Name:"
                className="block w-full bg-blue-600 text-white text-center font-black uppercase tracking-widest py-4 rounded-xl text-[10px] shadow-lg shadow-blue-500/20 hover:bg-blue-700 transition-all"
               >
                 Send Reset Email
               </a>
               <button 
                onClick={() => setShowForgotModal(false)}
                className="w-full bg-slate-50 text-slate-400 font-black uppercase tracking-widest py-4 rounded-xl text-[10px] hover:bg-slate-100 transition-all"
               >
                 Back to Login
               </button>
            </div>
          </div>
        </div>
      )}

      {/* 2. LOGIN FORM */}
      <form onSubmit={handleSubmit} className="space-y-6">
        {error && (
          <div className="flex items-center gap-3 p-4 bg-red-50 border border-red-100 rounded-xl text-red-600 animate-in slide-in-from-top-2">
            <AlertCircle size={18} />
            <p className="text-[10px] font-black uppercase tracking-widest">
               {error}
            </p>
          </div>
        )}
        
        <div className="space-y-2 text-left">
          <label className="block text-[10px] font-black uppercase tracking-widest text-slate-400 ml-2">
            Team Name or Email
          </label>
          <div className="relative">
            <User className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-300" />
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
            <Lock className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-300" />
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
          className="w-full bg-blue-600 hover:bg-blue-700 disabled:bg-slate-200 text-white font-black uppercase italic tracking-widest py-5 rounded-2xl shadow-xl shadow-blue-500/20 transition-all active:scale-[0.98]"
        >
          {loading ? "Verifying Credentials..." : "Enter Front Office"}
        </button>

        <div className="flex flex-col gap-4 pt-2">
          <p className="text-center text-[9px] font-bold text-slate-400 uppercase tracking-tighter italic">
            Authorized Personnel Only
          </p>

          <button
            type="button"
            onClick={() => setShowForgotModal(true)}
            className="text-center text-[10px] font-black text-slate-400 uppercase tracking-widest hover:text-blue-500 transition-colors"
          >
            Forgot Password?
          </button>
        </div>

        <div className="border-t border-slate-100 pt-6">
          <p className="text-center text-[9px] font-bold text-slate-400 uppercase tracking-widest mb-4">
            Just browsing?
          </p>
          <button
            type="button"
            disabled={loading}
            onClick={handleDemoLogin}
            className="w-full bg-slate-800 hover:bg-slate-700 disabled:bg-slate-200 text-white font-black uppercase italic tracking-widest py-4 rounded-2xl transition-all active:scale-[0.98] text-sm"
          >
            View Demo League →
          </button>
        </div>
      </form>
    </>
  );
}