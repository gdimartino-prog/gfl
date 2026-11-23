import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import ResetPasswordForm from "@/components/ResetPasswordForm";

export const metadata: Metadata = {
  title: "Reset Password",
  robots: { index: false, follow: false },
  referrer: "no-referrer",
};

export default async function ResetPasswordPage({
  searchParams,
}: {
  searchParams: Promise<{ token?: string | string[] }>;
}) {
  const sp = await searchParams;
  const initialToken = typeof sp.token === "string" ? sp.token : "";
  const leagueName = "Football League";

  return (
    <div className="flex min-h-screen items-center justify-center bg-slate-50 p-4 sm:p-6">
      <div className="w-full max-w-md space-y-8">
        <div className="text-center flex flex-col items-center">
          <div className="bg-white p-4 rounded-2xl shadow-sm border border-slate-100 mb-6 inline-block">
            <Image
              src="/icon.png"
              alt={`${leagueName} Logo`}
              className="h-24 w-auto object-contain"
              width={96}
              height={96}
            />
          </div>

          <h1 className="text-4xl font-black text-gray-900 tracking-tighter uppercase italic leading-none">
            Reset <span className="text-blue-600">Password</span>
          </h1>
          <p className="mt-3 text-[11px] font-black text-slate-600 uppercase tracking-[0.3em]">
            Front Office Recovery
          </p>
        </div>

        <div className="bg-white p-6 sm:p-10 rounded-[2.5rem] shadow-2xl border border-slate-100 ring-1 ring-slate-200/50">
          <ResetPasswordForm initialToken={initialToken} />
        </div>

        <p className="text-center text-xs font-bold text-slate-600">
          Remembered your password?{" "}
          <Link
            href="/login"
            className="inline-flex min-h-11 items-center text-blue-600 hover:text-blue-700 font-black uppercase tracking-wider text-xs transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-600 rounded px-1"
          >
            Back to Login
          </Link>
        </p>

        <p className="text-center text-[11px] font-bold text-slate-500 uppercase tracking-widest">
          Established 1993 &bull; {leagueName}
        </p>
      </div>
    </div>
  );
}
