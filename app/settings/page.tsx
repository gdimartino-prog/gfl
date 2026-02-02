"use client";

import { useState, useEffect } from "react";
import { useSession } from "next-auth/react";
import { updatePassword } from "@/lib/actions";
import { Lock, ShieldCheck, AlertCircle, CheckCircle2, Radio } from "lucide-react";
import Link from "next/link";

export default function SettingsPage() {
  const { data: session } = useSession();
  const [status, setStatus] = useState<"idle" | "loading" | "success" | "error">("idle");
  const [errorMessage, setErrorMessage] = useState("");
  const [teamInfo, setTeamInfo] = useState({ name: "", nickname: "" });

  // Fetch dynamic team info based on logged-in ID
  useEffect(() => {
    const fetchTeamDetails = async () => {
      if (!session?.user) return;
      const userTeamId = (session.user as any).id;

      try {
        const res = await fetch('/api/standings');
        const standings = await res.json();
        const myTeam = standings.find((s: any) => 
          s.teamshort?.toUpperCase() === userTeamId?.toUpperCase()
        );
        
        if (myTeam) {
          setTeamInfo({ 
            name: myTeam.team || "", 
            nickname: myTeam.nickname || "" 
          });
        }
      } catch (err) {
        console.error("Failed to fetch team details", err);
      }
    };

    fetchTeamDetails();
  }, [session]);

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setStatus("loading");
    setErrorMessage("");

    const formData = new FormData(e.currentTarget);
    const password = formData.get("password") as string;
    const confirmPassword = formData.get("confirmPassword") as string;

    if (password !== confirmPassword) {
      setStatus("error");
      setErrorMessage("Passwords do not match.");
      return;
    }

    if (password.length < 4) {
      setStatus("error");
      setErrorMessage("Password must be at least 4 characters.");
      return;
    }

    try {
      const result = await updatePassword(password);
      if (result.success) {
        setStatus("success");
        (e.target as HTMLFormElement).reset(); 
      } else {
        setStatus("error");
        setErrorMessage(result.error || "Failed to update password.");
      }
    } catch (err) {
      setStatus("error");
      setErrorMessage("Connection error. Please try again.");
    }
  }

  return (
    <div className="max-w-7xl mx-auto p-4 md:p-8 space-y-10 bg-gray-50 min-h-screen text-slate-900 text-left">
      
      <div className="border-b border-slate-200 pb-8">
        <h1 className="text-5xl font-black italic uppercase tracking-tighter text-slate-900 leading-none">
          Account <span className="text-blue-600">Security</span>
        </h1>
        <p className="text-[11px] font-black text-slate-400 uppercase tracking-[0.2em] italic mt-2">
          Coach Credentials • Season 2026 Security Protocol
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
        {/* LEFT COLUMN: INFO */}
        <div className="md:col-span-1 space-y-4">
          <div className="bg-slate-900 p-6 rounded-[2rem] text-white shadow-xl border border-slate-800">
             <p className="text-[10px] font-black text-slate-500 uppercase tracking-widest mb-4">Logged In Coach</p>
             <h2 className="text-2xl font-black uppercase italic leading-none">{session?.user?.name || "Active Coach"}</h2>
             
             <div className="mt-6 pt-6 border-t border-slate-800 space-y-4">
                <div>
                  <p className="text-slate-500 font-black text-[9px] uppercase tracking-widest mb-1">Team Name</p>
                  <p className="text-white font-bold text-sm uppercase italic">
                    {teamInfo.name} <span className="text-blue-500 not-italic">{teamInfo.nickname}</span>
                  </p>
                </div>
                <div>
                  <p className="text-slate-500 font-black text-[9px] uppercase tracking-widest mb-1">Authorized ID</p>
                  <p className="text-white font-mono text-sm">{(session?.user as any)?.id || "---"}</p>
                </div>
             </div>
          </div>
          
          <Link 
            href="/coaching"
            className="block bg-white p-6 rounded-[2rem] border border-slate-200 shadow-sm hover:shadow-md transition-all group"
          >
            <div className="flex items-center gap-4">
              <div className="bg-blue-50 p-3 rounded-2xl text-blue-600 group-hover:bg-blue-600 group-hover:text-white transition-colors">
                <Radio size={20} />
              </div>
              <div>
                <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Personnel Logistics</p>
                <h3 className="text-sm font-black uppercase italic text-slate-900">Update COA File →</h3>
              </div>
            </div>
          </Link>

          <div className="p-6 border-2 border-dashed border-slate-200 rounded-[2rem] text-slate-400">
            <p className="text-[10px] font-bold leading-relaxed uppercase italic">
              Updating your credentials will sync to Column H of the Coaches Master Sheet.
            </p>
          </div>
        </div>

        {/* RIGHT COLUMN: FORM */}
        <div className="md:col-span-2">
          <form onSubmit={handleSubmit} className="bg-white border border-slate-100 shadow-2xl rounded-[2.5rem] p-8 md:p-12 space-y-8">
            <div className="space-y-6">
              <div className="space-y-2 text-left">
                <label className="text-[10px] font-black uppercase tracking-widest text-slate-400 ml-2">New Team Password</label>
                <div className="relative">
                  <Lock className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-300" />
                  <input 
                    name="password"
                    type="password" 
                    required
                    className="w-full bg-slate-50 border-2 border-slate-50 rounded-2xl py-4 pl-12 pr-6 font-bold outline-none focus:border-blue-500 focus:bg-white transition-all text-slate-900"
                    placeholder="••••••••"
                  />
                </div>
              </div>

              <div className="space-y-2 text-left">
                <label className="text-[10px] font-black uppercase tracking-widest text-slate-400 ml-2">Confirm New Password</label>
                <div className="relative">
                  <ShieldCheck className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-300" />
                  <input 
                    name="confirmPassword"
                    type="password" 
                    required
                    className="w-full bg-slate-50 border-2 border-slate-50 rounded-2xl py-4 pl-12 pr-6 font-bold outline-none focus:border-blue-500 focus:bg-white transition-all text-slate-900"
                    placeholder="••••••••"
                  />
                </div>
              </div>
            </div>

            {status === "success" && (
              <div className="bg-emerald-50 text-emerald-700 p-4 rounded-2xl flex items-center gap-3 font-black text-[11px] uppercase italic animate-in zoom-in-95">
                <CheckCircle2 className="w-5 h-5" /> Success: Database Sync Complete.
              </div>
            )}

            {status === "error" && (
              <div className="bg-red-50 text-red-700 p-4 rounded-2xl flex items-center gap-3 font-black text-[11px] uppercase italic">
                <AlertCircle className="w-5 h-5" /> Error: {errorMessage}
              </div>
            )}

            <button 
              type="submit"
              disabled={status === "loading"}
              className="w-full bg-blue-600 hover:bg-blue-700 disabled:bg-slate-200 text-white font-black uppercase italic tracking-widest py-5 rounded-2xl shadow-xl shadow-blue-500/20 transition-all active:scale-[0.98]"
            >
              {status === "loading" ? "Updating Database..." : "Save Security Settings"}
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}