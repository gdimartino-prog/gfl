export const IR_LIMIT_RULE = 'limit_ir';
export const DEFAULT_GFL_IR_LIMIT = 5;

/**
 * Resolves the active Injured Reserve cap for a league.
 * - Explicit non-negative integer `limit_ir` wins (`0` means unlimited -> `null`).
 * - When unset, blank, or invalid, GFL (league 1) defaults to 5 per Constitution B7;
 *   other leagues default to unlimited (`null`).
 */
export function resolveIrLimit(leagueId: number, rawValue?: string | null): number | null {
  const trimmed = rawValue?.trim() ?? '';
  if (trimmed !== '' && /^\d+$/.test(trimmed)) {
    const parsed = parseInt(trimmed, 10);
    return parsed === 0 ? null : parsed;
  }
  return leagueId === 1 ? DEFAULT_GFL_IR_LIMIT : null;
}

/**
 * Returns true when `currentIrCount` has reached or exceeded the configured cap.
 */
export function isIrCapReached(currentIrCount: number, irLimit: number | null): boolean {
  return irLimit !== null && currentIrCount >= irLimit;
}
