export function posGroup(
  offense: string | null,
  defense: string | null,
  special: string | null,
  position: string | null,
): string {
  const pos = (offense || defense || special || position || '').toUpperCase();
  if (pos === 'QB') return 'QB';
  if (['RB', 'HB', 'FB'].includes(pos)) return 'RB';
  if (pos === 'WR') return 'WR';
  if (pos === 'TE') return 'TE';
  if (['OL', 'OT', 'OG', 'C', 'G', 'T'].includes(pos)) return 'OL';
  if (['DL', 'DE', 'DT', 'NT'].includes(pos)) return 'DL';
  if (['LB', 'ILB', 'OLB', 'MLB'].includes(pos)) return 'LB';
  if (['DB', 'CB', 'S', 'SS', 'FS'].includes(pos)) return 'DB';
  if (pos === 'K') return 'K';
  if (pos === 'P') return 'P';
  return 'OTHER';
}

export function powerScore(
  offense: string | null,
  defense: string | null,
  special: string | null,
  position: string | null,
  stats: Record<string, number> | null,
): number {
  if (!stats) return 0;
  const group = posGroup(offense, defense, special, position);
  const g = (k: string) => stats[k] ?? 0;
  let raw = 0;
  switch (group) {
    case 'QB':
      raw = g('passingYards') * 0.04 + g('passingTouchdowns') * 4 - g('interceptions') * 2 + g('rushingYards') * 0.1 + g('rushingTouchdowns') * 6;
      break;
    case 'RB':
      raw = g('rushingYards') * 0.1 + g('rushingTouchdowns') * 6 + g('receivingYards') * 0.1 + g('receivingTouchdowns') * 6;
      break;
    case 'WR':
    case 'TE':
      raw = g('receivingYards') * 0.1 + g('receivingTouchdowns') * 6;
      break;
    case 'K':
      raw = g('fieldGoalsMade') * 3 + g('extraPointsMade') * 1;
      break;
    case 'DL':
    case 'LB':
    case 'DB':
      raw = g('totalTackles') * 0.5 + g('sacks') * 3 + g('interceptions') * 3 + g('passesDefended') * 1 + g('tacklesForLoss') * 1 + g('forcedFumbles') * 2 + g('fumbleRecoveries') * 2;
      break;
    case 'OL':
      raw = g('gamesPlayed') * 1;
      break;
    default:
      raw = 0;
  }
  return Math.round(raw * 10) / 10;
}
