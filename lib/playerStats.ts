// lib/playerStats.ts

const calcRatio = (num: any, den: any, isPercent: boolean = false): string => {
  const n = parseFloat(num) || 0;
  const d = parseFloat(den) || 0;
  if (d === 0) return "0.0";
  const ratio = n / d;
  return isPercent ? (ratio * 100).toFixed(1) : ratio.toFixed(1);
};

export const getPositionStats = (p: any) => {
  // Support all possible position keys found in your logs
  const rawPos = p.offense || p.defense || p.special || p.pos || p.core?.pos?.off || p.core?.pos?.def || p.position || "";
  const pos = rawPos.toUpperCase();
  
  // Data Mapping: Support both nested (Detailed API) and flat (Light API)
  const stats = p.stats || {};
  const ratings = p.ratings || {};
  const lightStats = p.allStats || {}; 

  const dur = ratings.durability || p.durability || p.dur || "0";

  if (pos === 'QB') {
    const qb = stats.passing || {};
    return [
      { label: "DUR", val: dur },
      { label: "CMP%", val: calcRatio(qb.comp || qb.completions || lightStats.completions, qb.att || qb.attempts || lightStats['pass attempts'], true) + "%" },
      { label: "YDS", val: qb.yds || qb.yards || lightStats['pass yards'] || "0" },
      { label: "INT", val: qb.int || qb.interceptions || lightStats['pass interceptions'] || "0" },
      { label: "TD", val: qb.td || qb.tds || lightStats['pass TD'] || "0" }
    ];
  }

  if (['RB', 'HB'].includes(pos)) {
    const rb = stats.rushing || {};
    const yds = rb.yds || rb.yards || lightStats['rush yards'] || 0;
    const att = rb.att || rb.attempts || lightStats['rush attempts'] || 0;
    return [
      { label: "DUR", val: dur },
      { label: "ATT", val: att },
      { label: "YDS", val: yds },
      { label: "YPC", val: calcRatio(yds, att) },
      { label: "TD", val: rb.td || rb.tds || lightStats['rush TD'] || "0" }
    ];
  }

  if (['WR', 'TE'].includes(pos)) {
    const wr = stats.receiving || {};
    const yds = wr.yds || wr.yards || lightStats['receiving yards'] || 0;
    const rec = wr.receptions || wr.rec || wr.rec || lightStats.receptions || 0;
    return [
      { label: "DUR", val: dur },
      { label: "REC", val: rec },
      { label: "YDS", val: yds },
      { label: "YPR", val: calcRatio(yds, rec) },
      { label: "TD", val: wr.td || wr.tds || lightStats['receiving TD'] || "0" }
    ];
  }

  if (['OL', 'C', 'G', 'T', 'C-G', 'G-T'].includes(pos)) {
    const rbR = parseFloat(ratings.run_block || p.run) || 0;
    const pbR = parseFloat(ratings.pass_block || p.pass) || 0;
    return [
      { label: "DUR", val: dur },
      { label: "AVG-B", val: ((rbR + pbR) / 2).toFixed(0) },
      { label: "R-BLK", val: rbR },
      { label: "P-BLK", val: pbR },
      { label: "GMS", val: stats.games || lightStats.games || "0" }
    ];
  }

  if (['DL', 'DE', 'DT', 'LB', 'OLB', 'ILB', 'DB', 'CB', 'S', 'SAF'].includes(pos)) {
    const isDB = ['DB', 'CB', 'S', 'SAF'].includes(pos);
    const def = stats.defense || {};
    return [
      { label: "DUR", val: dur },
      { label: "T-DEF", val: ratings.total_def || "0" },
      { label: "R-DEF", val: ratings.run_def || "0" },
      { label: "P-DEF", val: ratings.pass_def || "0" },
      { label: isDB ? "INT" : "PRUSH", val: isDB ? (def.int || def.interceptions || lightStats.interceptions || "0") : (ratings.pass_rush || "0") }
    ];
  }

  return [
    { label: "AGE", val: p.core?.age || p.age || "??" },
    { label: "OVRL", val: p.overall || "0" },
    { label: "DUR", val: dur },
    { label: "SAL", val: p.contract?.salary || p.salary || "N/A" },
    { label: "GMS", val: stats.games || lightStats.games || "0" }
  ];
};