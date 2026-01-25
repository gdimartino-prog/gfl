"use client";

import { useState } from "react";
import { updatePassword } from "@/lib/actions";

export default function SettingsPage() {
  const [status, setStatus] = useState<"idle" | "loading" | "success" | "error">("idle");
  const [errorMessage, setErrorMessage] = useState("");

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setStatus("loading");
    setErrorMessage("");

    const formData = new FormData(e.currentTarget);
    const password = formData.get("password") as string;
    const confirmPassword = formData.get("confirmPassword") as string;

    // 1. Client-side validation
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

    // 2. Call the Server Action to update Google Sheets
    const result = await updatePassword(password);
    
    if (result.success) {
      setStatus("success");
      e.currentTarget.reset(); // Clear the form
    } else {
      setStatus("error");
      setErrorMessage(result.error || "Failed to update password.");
    }
  }

  return (
    <div className="max-w-md mx-auto mt-20 p-8 bg-white rounded-[2rem] shadow-xl border border-slate-100">
      <div className="text-center mb-8">
        <h1 className="text-2xl font-black uppercase italic tracking-tighter text-slate-900">
          Account <span className="text-blue-600">Security</span>
        </h1>
        <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mt-1">
          Update your league credentials
        </p>
      </div>
      
      <form onSubmit={handleSubmit} className="space-y-5">
        <div>
          <label className="block text-[10px] font-black uppercase tracking-widest text-slate-400 mb-2">
            New Team Password
          </label>
          <input
            name="password"
            type="password"
            required
            className="w-full rounded-xl border border-slate-200 p-4 text-sm focus:ring-2 focus:ring-blue-500 text-slate-900"
            placeholder="••••••••"
          />
        </div>

        <div>
          <label className="block text-[10px] font-black uppercase tracking-widest text-slate-400 mb-2">
            Confirm New Password
          </label>
          <input
            name="confirmPassword"
            type="password"
            required
            className="w-full rounded-xl border border-slate-200 p-4 text-sm focus:ring-2 focus:ring-blue-500 text-slate-900"
            placeholder="••••••••"
          />
        </div>
        
        <button
          type="submit"
          disabled={status === "loading"}
          className="w-full rounded-xl bg-slate-900 p-4 text-[11px] font-black uppercase tracking-widest text-white hover:bg-slate-800 disabled:bg-slate-300 transition-all shadow-lg active:scale-95"
        >
          {status === "loading" ? "Updating Sheet..." : "Update Password"}
        </button>

        {/* Status Messages */}
        {status === "success" && (
          <div className="p-4 bg-green-50 border border-green-100 rounded-xl">
            <p className="text-[10px] font-black text-green-600 uppercase text-center">
              ✅ Success! Password updated in Google Sheets.
            </p>
          </div>
        )}

        {status === "error" && (
          <div className="p-4 bg-red-50 border border-red-100 rounded-xl">
            <p className="text-[10px] font-black text-red-600 uppercase text-center">
              ❌ {errorMessage}
            </p>
          </div>
        )}
      </form>
    </div>
  );
}