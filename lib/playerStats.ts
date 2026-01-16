// lib/playerStats.ts

/**
 * Helper to safely calculate ratios (YPC, YPR, CMP%) 
 * and prevent NaN/Infinity errors.
 */
const calcRatio = (num: any, den: any, isPercent: boolean = false): string => {
  const n = parseFloat(num) || 0;
  const d = parseFloat(den) || 0;
  if (d === 0) return "0.0";
  
  const ratio = n / d;
  
  if (isPercent) {
    // Multiplies by 100 to get a whole number (60.0 instead of 0.6)
    return (ratio * 100).toFixed(1);
  }
  
  return ratio.toFixed(1);
};

export const getPositionStats = (p: any) => {
  const pos = p.position?.toUpperCase() || "";
  const stats = p.allStats || {};
  const ratings = p.ratings || {};

  // Standard Durability check (checks multiple possible keys)
  const dur = p.durability || ratings.durability || p.dur || "0";

  // 1. QB: Durability, CMP%, Yds, INT, TD
  if (pos === 'QB') {
    return [
      { label: "DUR", val: dur },
      { label: "CMP%", val: calcRatio(stats.completions, stats['pass attempts'], true) + "%" },
      { label: "YDS", val: stats['pass yards'] || "0" },
      { label: "INT", val: stats['pass interceptions'] || "0" },
      { label: "TD", val: stats['pass TD'] || "0" }
    ];
  }

  // 2. RB & HB: Durability, Att, Yds, YPC, TD
  if (['RB', 'HB'].includes(pos)) {
    return [
      { label: "DUR", val: dur },
      { label: "ATT", val: stats['rush attempts'] || "0" },
      { label: "YDS", val: stats['rush yards'] || "0" },
      { label: "YPC", val: calcRatio(stats['rush yards'], stats['rush attempts']) },
      { label: "TD", val: stats['rush TD'] || "0" }
    ];
  }

  // 3. WR & TE: Durability, Rec, Yds, YPR, TD
  if (['WR', 'TE'].includes(pos)) {
    return [
      { label: "DUR", val: dur },
      { label: "REC", val: stats.receptions || "0" },
      { label: "YDS", val: stats['receiving yards'] || "0" },
      { label: "YPR", val: calcRatio(stats['receiving yards'], stats.receptions) },
      { label: "TD", val: stats['receiving TD'] || "0" }
    ];
  }

  // 4. OL: Durability, Avg-Blk, R-Blk, P-Blk, Games
  if (['OL', 'C', 'G', 'T', 'C-G', 'G-T'].includes(pos)) {
    const rb = parseFloat(ratings.run_block || p.run) || 0;
    const pb = parseFloat(ratings.pass_block || p.pass) || 0;
    return [
      { label: "DUR", val: dur },
      { label: "AVG-B", val: ((rb + pb) / 2).toFixed(0) },
      { label: "R-BLK", val: rb },
      { label: "P-BLK", val: pb },
      { label: "GMS", val: stats.games || "0" }
    ];
  }

  // 5. DL: Durability, T-Def, R-Def, P-Def, P-Rush
  if (pos === 'DL') {
    return [
      { label: "DUR", val: dur },
      { label: "T-DEF", val: ratings.total_def || "0" },
      { label: "R-DEF", val: ratings.run_def || "0" },
      { label: "P-DEF", val: ratings.pass_def || "0" },
      { label: "PRUSH", val: ratings.pass_rush || "0" }
    ];
  }

  // 6. LB / OLB / ILB: Durability, T-Def, R-Def, P-Def, P-Rush
  if (['LB', 'OLB', 'ILB'].includes(pos)) {
    return [
      { label: "DUR", val: dur },
      { label: "T-DEF", val: ratings.total_def || "0" },
      { label: "R-DEF", val: ratings.run_def || "0" },
      { label: "P-DEF", val: ratings.pass_def || "0" },
      { label: "PRUSH", val: ratings.pass_rush || "0" }
    ];
  }

  // 7. DB / CB / S: Durability, T-Def, R-Def, P-Def, INT
  if (['DB', 'CB', 'S'].includes(pos)) {
    return [
      { label: "DUR", val: dur },
      { label: "T-DEF", val: ratings.total_def || "0" },
      { label: "R-DEF", val: ratings.run_def || "0" },
      { label: "P-DEF", val: ratings.pass_def || "0" },
      { label: "INT", val: stats.interceptions || "0" }
    ];
  }

    // 8. Punters 
if (pos === 'P') {
    return [
      { label: "DUR", val: dur },
      { label: "PUNTS", val: stats['punts'] || "0" },
      { label: "TB", val: stats['punt touchbacks'] || stats['punt tb'] || "0" },
      { label: "I-20", val: stats['punts inside 20'] || stats['punt i20'] || "0" },
      { label: "BLK", val: stats['punts blocked'] || "0" }
    ];
  }

  // 9. Kicker: Durability, FG Att, FG Made, Long, 50+ Made
  if (pos === 'K') {
    return [
      { label: "DUR", val: dur },
      { label: "FGA", val: stats['field goal attempts'] || stats['fga'] || "0" },
      { label: "FGM", val: stats['field goals made'] || stats['fgm'] || "0" },
      { label: "LONG", val: stats['field goals long'] || stats['fg long'] || "0" },
      { label: "50+", val: stats['field goals made 50+'] || stats['fg 50+'] || "0" }
    ];
  }    
    // DEFAULT / ALL VIEW: Age, Overall, Durability, Salary, Games
  return [
    { label: "AGE", val: p.age || "??" },
    { label: "OVRL", val: p.overall || "0" },
    { label: "DUR", val: dur },
    { label: "SAL", val: p.salary || "N/A" },
    { label: "GMS", val: stats.games || "0" }
  ];
};