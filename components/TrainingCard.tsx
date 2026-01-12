'use client';

export default function TrainingCard() {
  const handleSearch = () => {
    const query = encodeURIComponent("asian massage spa near me");
    window.open(`https://www.google.com/search?q=${query}`, '_blank');
  };

  return (
    <div className="group relative overflow-hidden bg-white p-6 rounded-2xl border border-emerald-100 shadow-sm hover:shadow-md transition-all cursor-pointer" onClick={handleSearch}>
      {/* Background Decor */}
      <div className="absolute -right-4 -top-4 text-6xl opacity-10 group-hover:scale-110 transition-transform">
        💆‍♂️
      </div>

      <div className="relative z-10">
        <h3 className="text-sm font-black uppercase tracking-widest text-emerald-600 mb-1">
          Player Recovery
        </h3>
        <p className="text-xl font-bold text-slate-800 mb-4">
          Training & Wellness
        </p>
        
        <div className="flex items-center text-xs font-bold text-emerald-700 gap-2">
          <span>FIND NEARBY FACILITIES</span>
          <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M17 8l4 4m0 0l-4 4m4-4H3" />
          </svg>
        </div>
      </div>
    </div>
  );
}