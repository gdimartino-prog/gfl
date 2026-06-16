export type PositionGroup = {
  label: string;
  positions: string[];
};

export const POSITION_GROUPS: PositionGroup[] = [
  { label: 'Quarterbacks',         positions: ['QB'] },
  { label: 'Running Backs',        positions: ['RB', 'FB', 'HB'] },
  { label: 'Wide Receivers',       positions: ['WR'] },
  { label: 'Tight Ends',           positions: ['TE'] },
  { label: 'Centers',              positions: ['C', 'C-G'] },
  { label: 'Guards',               positions: ['G', 'G-T'] },
  { label: 'Tackles',              positions: ['T', 'OT', 'OL'] },
  { label: 'Defensive Tackles',    positions: ['DT', 'NT'] },
  { label: 'Defensive Ends',       positions: ['DE', 'DL', 'DE-LB'] },
  { label: 'Inside Linebackers',   positions: ['ILB', 'MLB', 'LB'] },
  { label: 'Outside Linebackers',  positions: ['OLB', 'LB-S'] },
  { label: 'Cornerbacks',          positions: ['CB'] },
  { label: 'Safeties',             positions: ['S', 'SAF', 'FS', 'SS', 'DB'] },
  { label: 'Kickers',              positions: ['K', 'K-P'] },
  { label: 'Punters',              positions: ['P'] },
];

export function expandPositionGroups(labels: string[]): string[] {
  const out = new Set<string>();
  for (const label of labels) {
    const g = POSITION_GROUPS.find(g => g.label === label);
    if (g) g.positions.forEach(p => out.add(p));
  }
  return Array.from(out);
}
