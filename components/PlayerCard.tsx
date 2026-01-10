import React from 'react';

interface PlayerCardProps {
  data: any;
  onClose: () => void;
}

const PlayerCard: React.FC<PlayerCardProps> = ({ data, onClose }) => {
  if (!data) return null;

  const core = data.core || data;
  const position = core.pos?.off || core.pos?.def || core.pos?.special || data.offense || 'ATH';
  
  // Metadata to ignore
  const excluded = ['id', 'identity', 'image', 'core', 'ratings', 'contract', 'uniform', 'team', 'offense', 'defense', 'special'];

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-slate-950/95 backdrop-blur-md animate-in fade-in duration-200">
      <div className="bg-[#020617] w-full max-w-6xl rounded-[2.5rem] border-2 border-slate-700 shadow-2xl overflow-hidden max-h-[90vh] flex flex-col">
        
        {/* HEADER */}
        <div className="p-6 bg-slate-900 border-b border-slate-700 flex justify-between items-center">
          <div className="flex flex-col">
            <div className="flex items-center gap-2 mb-1">
              <span className="bg-blue-600 text-white text-[10px] font-black px-2 py-0.5 rounded uppercase shadow-md">
                {position}
              </span>
              <span className="text-white font-black text-[10px] uppercase tracking-widest">
                AGE {core.age || '??'} // {core.college || 'Ratings & Stats'}
              </span>
            </div>
            <h2 className="text-4xl font-black italic uppercase text-white tracking-tighter leading-none">
              {core.first} <span className="text-blue-400">{core.last}</span>
            </h2>
          </div>
          <button onClick={onClose} className="p-3 bg-slate-800 hover:bg-red-500 rounded-full text-white transition-all border border-slate-600">
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="3" d="M6 18L18 6M6 6l12 12"/>
            </svg>
          </button>
        </div>

        {/* MAIN CONTENT AREA */}
        <div className="flex-1 overflow-y-auto p-8 grid grid-cols-1 lg:grid-cols-12 gap-8 custom-scrollbar">
          
          {/* LEFT COLUMN: Physical Ratings */}
          <div className="lg:col-span-4 space-y-8">
            <section>
              <h4 className="text-blue-400 font-black text-[12px] uppercase tracking-[0.2em] mb-4 italic">Physical Ratings</h4>
              <div className="grid grid-cols-1 gap-2">
                {data.ratings && Object.entries(data.ratings).map(([key, val]: any) => {
                  if (Number(val) === 0) return null;
                  return <RatingRow key={key} label={key} value={val} />;
                })}
              </div>
            </section>
          </div>

          {/* RIGHT COLUMN: Performance Data (Deep Search for Offense/Defense) */}
          <div className="lg:col-span-8 space-y-8 lg:border-l lg:border-slate-700 lg:pl-8">
            <h4 className="text-blue-400 font-black text-[12px] uppercase tracking-[0.2em] italic">Field Performance Breakdown</h4>
            
            <div className="space-y-10">
              {Object.entries(data)
                .filter(([key]) => !excluded.includes(key) && typeof data[key] === 'object')
                .map(([category, stats]: [string, any]) => {
                  
                  // Collect all non-zero stats recursively
                  const activeStats: {label: string, value: any}[] = [];
                  
                  const extractStats = (obj: any, prefix = '') => {
                    Object.entries(obj).forEach(([k, v]) => {
                      if (v && typeof v === 'object' && !Array.isArray(v)) {
                        extractStats(v, `${prefix}${k} `);
                      } else if (Number(v) > 0) {
                        activeStats.push({ label: `${prefix}${k}`, value: v });
                      }
                    });
                  };

                  extractStats(stats);

                  if (activeStats.length === 0) return null;

                  return (
                    <div key={category} className="space-y-4">
                      <p className="text-white font-black italic text-md uppercase border-l-4 border-emerald-500 pl-3">
                          <span className="tracking-widest">{category}</span>
                      </p>
                      <div className="flex flex-wrap gap-3">
                        {activeStats.map((stat, idx) => (
                          <DataChip key={idx} label={stat.label} value={stat.value} />
                        ))}
                      </div>
                    </div>
                  );
                })}
            </div>
          </div>
        </div>

        {/* FOOTER */}
        <div className="p-8 bg-slate-900 border-t border-slate-700">
           <button onClick={onClose} className="w-full py-5 bg-blue-600 hover:bg-blue-500 text-white font-black uppercase text-xs tracking-[0.4em] rounded-2xl transition-all shadow-xl active:scale-95">
             Close Profile
           </button>
        </div>
      </div>
    </div>
  );
};

function DataChip({ label, value }: { label: string, value: any }) {
    return (
        <div className="bg-slate-800 border border-slate-600 px-5 py-4 rounded-2xl flex flex-col min-w-[120px] shadow-lg border-b-4 border-b-emerald-500/20 hover:border-emerald-500 transition-colors">
            <span className="text-blue-200 text-[10px] font-black uppercase leading-none mb-2 tracking-wide">
                {label.replace(/_/g, ' ')}
            </span>
            <span className="text-emerald-400 text-3xl font-black tabular-nums italic leading-none">
                {value?.toString() || '0'}
            </span>
        </div>
    );
}

function RatingRow({ label, value }: { label: string, value: any }) {
  return (
    <div className="bg-slate-800/80 border border-slate-600 p-3 rounded-xl flex justify-between items-center px-5 group hover:border-emerald-500/50 transition-colors">
      <span className="text-blue-100 text-[11px] font-black uppercase tracking-tight">
        {label.replace(/_/g, ' ')}
      </span>
      <span className="text-emerald-400 text-xl font-black italic tabular-nums">{value ?? '0'}</span>
    </div>
  );
}

export default PlayerCard;