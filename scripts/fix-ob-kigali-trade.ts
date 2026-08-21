// Manually applies the OB ↔ Kigali trade pick transfers that were skipped due to case mismatch
import { upsertPickTransfer } from '../lib/draftPicks';

const LEAGUE_ID = 1;
const OB_TEAM_ID = 52;
const KIGALI_TEAM_ID = 46;

const transfers = [
  { pickId: 2350, toTeamId: KIGALI_TEAM_ID, label: 'OB R2 pick#22 → Kigali' },
  { pickId: 2355, toTeamId: OB_TEAM_ID,     label: 'Kigali R2 pick#27 → Old Bridge' },
  { pickId: 2371, toTeamId: OB_TEAM_ID,     label: 'Kigali R3 pick#43 → Old Bridge' },
  { pickId: 2392, toTeamId: KIGALI_TEAM_ID, label: 'OB R4 pick#64 (via Carolina) → Kigali' },
];

for (const t of transfers) {
  await upsertPickTransfer({ leagueId: LEAGUE_ID, pickId: t.pickId, toTeamId: t.toTeamId, touchId: 'commissioner' });
  console.log(`✓ ${t.label}`);
}

console.log('Done.');
process.exit(0);
