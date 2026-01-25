'use client';

import { signOut } from "next-auth/react";
import { LogOut } from "lucide-react";

export default function LogoutButton() {
  return (
    <button
      onClick={() => signOut({ callbackUrl: '/' })}
      className="flex items-center gap-2 text-[10px] font-black uppercase tracking-widest text-red-400 hover:text-red-600 transition-colors group"
    >
      <LogOut size={16} className="group-hover:-translate-x-1 transition-transform" />
      Secure Logout
    </button>
  );
}