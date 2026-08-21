// One-off: fire the email + WhatsApp notification that was missed when the
// Vico ↔ Crimson conditional trade was originally logged (2026-05-27 6:15 PM)
// — at that time the CONDITIONAL TRADE branch hadn't been wired up to call
// notifyTransaction. The transaction row is already in the DB; this only
// sends the notification.

import { notifyTransaction } from '../lib/notify';

const fromTeam = 'Crimson';
const toTeam = 'Vico';
const details =
  'Vico will get the 2027 3rd round pick if CB - Kenny Moore II is signed by ' +
  'a team in the 2026 NFL season. Otherwise, Vico will get the 2027 4th round pick.';
const leagueId = 1; // GFL

const directionKey = `${fromTeam} ➔ ${toTeam}`;

console.log('Sending CONDITIONAL TRADE notification:');
console.log('  league:', leagueId);
console.log('  ', directionKey);
console.log('  details:', details);
console.log('');

await notifyTransaction({
  type: 'CONDITIONAL TRADE',
  directions: { [directionKey]: [details] },
  leagueId,
});

console.log('Done.');
process.exit(0);
