import LoginForm from "@/components/LoginForm";
import Image from "next/image";

export default function LoginPage() {
  return (
    <main className="flex min-h-screen items-center justify-center bg-slate-50 p-6">
      <div className="w-full max-w-md space-y-8">
        
        {/* League Logo & Header Section */}
        <div className="text-center flex flex-col items-center">
          <div className="bg-white p-4 rounded-2xl shadow-sm border border-slate-100 mb-6 inline-block">
            <Image 
              src="/icon.png" 
              alt="GFL Logo" 
              className="h-24 w-auto object-contain"
              width={96}
              height={96}
            />
          </div>
          
          <h1 className="text-4xl font-black text-gray-900 tracking-tighter uppercase italic leading-none">
            GFL <span className="text-blue-600">Login</span>
          </h1>
          <p className="mt-3 text-[10px] font-black text-slate-400 uppercase tracking-[0.3em]">
            Front Office Authentication
          </p>
        </div>

        {/* The White Form Card */}
        <div className="bg-white p-10 rounded-[2.5rem] shadow-2xl border border-slate-100 ring-1 ring-slate-200/50">
          <LoginForm />
        </div>

        {/* Footer info below the card */}
        <p className="text-center text-[10px] font-bold text-slate-300 uppercase tracking-widest">
          Established 1993 &bull; Gridiron Football League
        </p>
      </div>
    </main>
  );
}