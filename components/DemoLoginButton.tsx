"use client";

import { signIn } from "next-auth/react";
import { useState } from "react";

export default function DemoLoginButton() {
  const [loading, setLoading] = useState(false);

  async function handleClick() {
    setLoading(true);
    try {
      const result = await signIn("credentials", {
        username: "demo",
        password: "demo",
        redirect: false,
      });
      if (!result?.error) {
        document.cookie = `gfl-league-id=2; path=/; max-age=${60 * 60 * 24 * 365}; SameSite=Lax; Secure`;
        window.location.href = "/";
      } else {
        setLoading(false);
      }
    } catch {
      setLoading(false);
    }
  }

  return (
    <button
      onClick={handleClick}
      disabled={loading}
      className="ml-4 shrink-0 bg-white text-slate-900 font-black uppercase italic tracking-widest text-[11px] px-5 py-3 rounded-xl shadow hover:bg-slate-100 disabled:opacity-50 transition-all active:scale-95 whitespace-nowrap"
    >
      {loading ? "Loading..." : "Enter Demo →"}
    </button>
  );
}
