"use client";

import { useSession, signOut } from "next-auth/react";
import Link from "next/link";

export default function AuthStatus() {
  const { data: session } = useSession();

  return (
    <div className="flex items-center justify-end px-8 py-3 bg-slate-50 border-b border-slate-100 space-x-4">
      {session ? (
        <>
          <span className="text-[10px] font-black uppercase tracking-widest text-slate-400">
            Coach Active: <span className="text-slate-900">{session.user?.name}</span>
          </span>
          <button
            onClick={() => signOut()}
            className="text-[10px] font-black uppercase tracking-widest text-red-500 hover:text-red-700 transition-colors"
          >
            Log Out
          </button>
        </>
      ) : (
        <Link
          href="/login"
          className="text-[10px] font-black uppercase tracking-widest text-blue-600 hover:text-blue-800 transition-colors"
        >
          League Login
        </Link>
      )}
    </div>
  );
}
