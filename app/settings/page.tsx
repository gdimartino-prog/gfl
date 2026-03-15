"use client";

import { useState, useEffect } from "react";
import { useSession } from "next-auth/react";
import { updatePassword } from "@/lib/actions";
import { Lock, ShieldCheck, AlertCircle, CheckCircle2, Radio, Mail, Phone, Users, User, Shield, Tag } from "lucide-react";
import { formatPhone } from "@/lib/utils";
import Link from "next/link";

export default function SettingsPage() {
  // 🔒 Enforce authentication
  const { data: session, status: authStatus } = useSession({ required: true });
  const [status, setStatus] = useState<"idle" | "loading" | "success" | "error">("idle");
  const [errorMessage, setErrorMessage] = useState("");
  const [teamInfo, setTeamInfo] = useState({ name: "", nickname: "", email: "", mobile: "", coach: "" });
  const [lastUpload, setLastUpload] = useState<string | null>(null);
  const [seasonYear, setSeasonYear] = useState("2026");

  // Fetch dynamic team info based on logged-in ID
  useEffect(() => {
    const fetchTeamDetails = async () => {
      if (!session?.user) return;
      const userTeamId = (session.user as { id?: string }).id;

      try {
        // 🚀 Fetch from /api/teams to get Coaches tab data including sync info
        const [teamsRes, rulesRes] = await Promise.all([
          fetch('/api/teams'),
          fetch('/api/rules')
        ]);
        const teams = await teamsRes.json();
        const rules = await rulesRes.json();

        const year = rules.find((r: { setting: string }) => r.setting === 'cuts_year')?.value;
        if (year) setSeasonYear(year);

        const myTeam = teams.find((s: { short: string }) => 
          s.short?.toUpperCase() === userTeamId?.toUpperCase()
        );
        
        if (myTeam) {
          setTeamInfo({
            name: myTeam.name || "",
            nickname: myTeam.nickname || "",
            email: myTeam.email || "",
            mobile: formatPhone(myTeam.mobile || ""),
            coach: myTeam.coach || "",
          });
          // 🚀 Set the last upload from the new column in your Coaches tab
          if (myTeam.lastSync) setLastUpload(myTeam.lastSync);
        }
      } catch (err) {
        console.error("Failed to fetch team details", err);
      }
    };

    fetchTeamDetails();
  }, [session]);

  async function handleContactUpdate(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setStatus("loading");
    setErrorMessage("");

    const formData = new FormData(e.currentTarget);
    const email = formData.get("email") as string;
    const rawMobile = formData.get("mobile") as string;
    const mobile = formatPhone(rawMobile);
    const coach = formData.get("coach") as string;
    const nickname = formData.get("nickname") as string;
    const team = formData.get("team") as string;

    try {
      const res = await fetch('/api/teams', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, mobile, coach, nickname, team }),
      });
      const result = await res.json();

      if (result.success) {
        setStatus("success");
        setTeamInfo(prev => ({ ...prev, email, mobile, coach, nickname, name: team }));
      } else {
        setStatus("error");
        setErrorMessage(result.error || "Failed to update contact info.");
      }
    } catch (err) {
      console.error("Contact update failed:", err);
      setStatus("error");
      setErrorMessage("Connection error. Please try again.");
    }
  }

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
    } catch {
      setStatus("error");
      setErrorMessage("Connection error. Please try again.");
    }
  }

  if (authStatus === "loading") {
    return <div className="p-20 text-center font-black animate-pulse text-slate-400 uppercase italic">Verifying Credentials...</div>;
  }

  return (
    <div className="max-w-7xl mx-auto p-4 md:p-8 space-y-10 bg-gray-50 min-h-screen text-slate-900 text-left">
      
      <div className="border-b border-slate-200 pb-8">
        <h1 className="text-5xl font-black italic uppercase tracking-tighter text-slate-900 leading-none">
          Franchise Settings <span className="text-blue-600">Security</span>
        </h1>
        <p className="text-[11px] font-black text-slate-400 uppercase tracking-[0.2em] italic mt-2">
          Coach Credentials • Season {seasonYear} Security Protocol
        </p>
      </div>

      {/* COACH PROFILE HEADER */}
      <div className="bg-slate-900 p-8 rounded-[2.5rem] text-white shadow-2xl border border-slate-800 flex flex-col md:flex-row justify-between items-center gap-8">
        <div className="flex items-center gap-6">
          <div className="w-3 h-12 bg-blue-600 rounded-full" />
          <div>
            <p className="text-[10px] font-black text-slate-500 uppercase tracking-widest mb-1">Logged In Coach</p>
            <h2 className="text-3xl font-black uppercase italic leading-none">{session?.user?.name || "Active Coach"}</h2>
          </div>
        </div>

        <div className="flex gap-12">
          <div>
            <p className="text-slate-500 font-black text-[9px] uppercase tracking-widest mb-1">Franchise</p>
            <p className="text-white font-bold text-lg uppercase italic leading-none">
              {teamInfo.name} <span className="text-blue-500 not-italic">{teamInfo.nickname}</span>
            </p>
          </div>
          <div>
            <p className="text-slate-500 font-black text-[9px] uppercase tracking-widest mb-1">Authorized ID</p>
            <p className="text-white font-mono text-lg leading-none">{(session?.user as { id?: string })?.id || "---"}</p>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
        {/* LEFT COLUMN: INFO */}
        <div className="md:col-span-1 space-y-4">
          <Link 
            href="/coaching"
            className="block bg-white p-6 rounded-[2rem] border border-slate-200 shadow-sm hover:shadow-md transition-all group"
          >
            <div className="flex items-center gap-4">
              <div className="bg-blue-50 p-3 rounded-2xl text-blue-600 group-hover:bg-blue-600 group-hover:text-white transition-colors">
                <Radio size={20} />
              </div>
              <div>
                <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest flex items-center gap-2">
                  Personnel Logistics 
                  {lastUpload && <span className="text-blue-500 font-bold">• Sync: {lastUpload}</span>}
                </p>
                <h3 className="text-sm font-black uppercase italic text-slate-900">Update COA File →</h3>
              </div>
            </div>
          </Link>

          <Link 
            href="/directory"
            className="block bg-white p-6 rounded-[2rem] border border-slate-200 shadow-sm hover:shadow-md transition-all group"
          >
            <div className="flex items-center gap-4">
              <div className="bg-emerald-50 p-3 rounded-2xl text-emerald-600 group-hover:bg-emerald-600 group-hover:text-white transition-colors">
                <Users size={20} />
              </div>
              <div>
                <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">League Directory</p>
                <h3 className="text-sm font-black uppercase italic text-slate-900">View Coach Contacts →</h3>
              </div>
            </div>
          </Link>
        </div>

        {/* RIGHT COLUMN: FORM */}
        <div className="md:col-span-2 space-y-8">
          {/* CONTACT INFO FORM */}
          <div className="bg-white border border-slate-100 shadow-2xl rounded-[2.5rem] p-8 md:p-12 space-y-8">
            <div className="space-y-1">
              <h2 className="text-2xl font-black uppercase italic tracking-tighter">League <span className="text-blue-600">Directory</span></h2>
              <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Update your contact details for other coaches</p>
            </div>
            
            <form onSubmit={handleContactUpdate} className="space-y-6">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="space-y-2 text-left">
                  <label className="text-[10px] font-black uppercase tracking-widest text-slate-400 ml-2">Coach Name</label>
                  <div className="relative">
                    <User className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-300" />
                    <input
                      key={teamInfo.coach}
                      name="coach"
                      type="text"
                      defaultValue={teamInfo.coach}
                      className="w-full bg-slate-50 border-2 border-slate-50 rounded-2xl py-4 pl-12 pr-6 font-bold outline-none focus:border-blue-500 focus:bg-white transition-all text-slate-900"
                      placeholder="Your name"
                    />
                  </div>
                </div>

                <div className="space-y-2 text-left">
                  <label className="text-[10px] font-black uppercase tracking-widest text-slate-400 ml-2">Team Nickname</label>
                  <div className="relative">
                    <Tag className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-300" />
                    <input
                      key={teamInfo.nickname}
                      name="nickname"
                      type="text"
                      defaultValue={teamInfo.nickname}
                      className="w-full bg-slate-50 border-2 border-slate-50 rounded-2xl py-4 pl-12 pr-6 font-bold outline-none focus:border-blue-500 focus:bg-white transition-all text-slate-900"
                      placeholder="e.g. Eagles"
                    />
                  </div>
                </div>

                <div className="space-y-2 text-left md:col-span-2">
                  <label className="text-[10px] font-black uppercase tracking-widest text-slate-400 ml-2">Team Name</label>
                  <div className="relative">
                    <Shield className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-300" />
                    <input
                      key={teamInfo.name}
                      name="team"
                      type="text"
                      defaultValue={teamInfo.name}
                      className="w-full bg-slate-50 border-2 border-slate-50 rounded-2xl py-4 pl-12 pr-6 font-bold outline-none focus:border-blue-500 focus:bg-white transition-all text-slate-900"
                      placeholder="e.g. Philadelphia"
                    />
                  </div>
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="space-y-2 text-left">
                  <label className="text-[10px] font-black uppercase tracking-widest text-slate-400 ml-2">Email Address</label>
                  <div className="relative">
                    <Mail className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-300" />
                    <input
                      key={teamInfo.email}
                      name="email"
                      type="email"
                      defaultValue={teamInfo.email}
                      className="w-full bg-slate-50 border-2 border-slate-50 rounded-2xl py-4 pl-12 pr-6 font-bold outline-none focus:border-blue-500 focus:bg-white transition-all text-slate-900"
                      placeholder="coach@example.com"
                    />
                  </div>
                </div>

                <div className="space-y-2 text-left">
                  <label className="text-[10px] font-black uppercase tracking-widest text-slate-400 ml-2">Phone Number</label>
                  <div className="relative">
                    <Phone className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-300" />
                    <input 
                      key={teamInfo.mobile}
                      name="mobile"
                      type="text" 
                      defaultValue={teamInfo.mobile}
                      className="w-full bg-slate-50 border-2 border-slate-50 rounded-2xl py-4 pl-12 pr-6 font-bold outline-none focus:border-blue-500 focus:bg-white transition-all text-slate-900"
                      placeholder="+1-xxx-xxx-xxxx"
                    />
                  </div>
                </div>
              </div>

              <button 
                type="submit"
                disabled={status === "loading"}
                className="w-full bg-slate-900 hover:bg-blue-600 disabled:bg-slate-200 text-white font-black uppercase italic tracking-widest py-5 rounded-2xl shadow-xl transition-all active:scale-[0.98]"
              >
                {status === "loading" ? "Updating Directory..." : "Update Directory Info"}
              </button>
            </form>
          </div>

          {/* PASSWORD FORM */}
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