import { clsx, type ClassValue } from "clsx"
import { twMerge } from "tailwind-merge"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

export const positionWeights: Record<string, number> = {
  'QB': 1, 'RB': 2, 'HB': 2, 'FB': 3, 'WR': 4, 'TE': 5,
  'OT': 6, 'LT': 6, 'RT': 6, 'T': 6, 'OG': 7, 'LG': 7, 'RG': 7, 'G': 7, 'C': 8, 'OL': 9,
  'DT': 10, 'NT': 11, 'DE': 12, 'DL': 13, 'MLB': 14, 'ILB': 15, 'OLB': 16, 'LB': 17,
  'CB': 18, 'FS': 19, 'SS': 20, 'S': 21, 'DB': 22,
  'K': 30, 'P': 31, 'LS': 32, 'KR': 33, 'PR': 34
};

/**
 * Normalizes raw position strings (including hybrids like DE-OLB) into 
 * standard tactical categories (QB, RB, WR, TE, OL, DL, LB, DB, K, P).
 */
export function getNormalizedCategories(rawPos: string): string[] {
  if (!rawPos) return [];
  const parts = rawPos.trim().toUpperCase().split('-');
  const categories = new Set<string>();

  parts.forEach(part => {
    const pt = part.trim();
    // Offensive Line
    if (['OT', 'LT', 'RT', 'OG', 'LG', 'RG', 'C', 'T', 'G', 'OL', 'C-G', 'G-T', 'C-T'].includes(pt)) categories.add('OL');
    // Defensive Line
    else if (['DE', 'DT', 'NT', 'DL'].includes(pt)) categories.add('DL');
    // Linebackers
    else if (['ILB', 'OLB', 'MLB', 'LB'].includes(pt)) categories.add('LB');
    // Defensive Backs
    else if (['CB', 'S', 'FS', 'SS', 'DB'].includes(pt)) categories.add('DB');
    // Special Hybrid Case
    else if (pt === 'LB-S') { categories.add('LB'); categories.add('DB'); }
    // Standard Skills & Specialists
    else if (['QB', 'RB', 'HB', 'FB', 'WR', 'TE', 'K', 'P'].includes(pt)) {
      categories.add(['HB', 'FB'].includes(pt) ? 'RB' : pt);
    }
  });

  return Array.from(categories);
}
