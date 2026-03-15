import React from 'react';
import { auth } from "@/auth";
import Link from 'next/link';
import CutsClient from '@/components/CutsClient';

export default async function CutsPage() {
  const session = await auth();

  return (
    <div className="max-w-7xl mx-auto p-8">
      <header className="mb-10 text-center md:text-left">
        <h1 className="text-5xl font-black uppercase italic tracking-tighter text-slate-900 leading-none">Roster Cuts</h1>
        <p className="text-slate-500 font-bold uppercase text-[10px] tracking-[0.3em] mt-3">
          Select protected and pullback players for the new season
        </p>
      </header>

      {!session ? (
        <div className="mt-10 p-12 bg-white border-2 border-dashed border-slate-200 rounded-[3rem] text-center">
          <div className="text-6xl mb-6">🔒</div>
          <h2 className="text-2xl font-black uppercase text-slate-800">Restricted Access</h2>
          <p className="text-slate-500 font-bold mt-2">Please login to manage roster cuts.</p>
          <Link href="/login" className="inline-block mt-8 px-8 py-4 bg-blue-600 text-white rounded-2xl font-black uppercase text-sm shadow-xl hover:bg-blue-700 transition-all">
            Coach Login
          </Link>
        </div>
      ) : (
        <CutsClient />
      )}
    </div>
  );
}
