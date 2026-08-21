import { db } from '../lib/db';
import { cuts, teams } from '../schema';
import { eq, and } from 'drizzle-orm';

const LEAGUE_ID = 1;
const TOUCH_ID = 'manual-import-2026-03-28';

// Get Newark Bay team ID
const [nbt] = await db.select({ id: teams.id })
  .from(teams)
  .where(and(eq(teams.leagueId, LEAGUE_ID), eq(teams.teamshort, 'NBT')));

if (!nbt) { console.error('Newark Bay team not found'); process.exit(1); }
console.log('Newark Bay team id:', nbt.id);

// Delete existing bad 2025 data
const deleted = await db.delete(cuts)
  .where(and(eq(cuts.leagueId, LEAGUE_ID), eq(cuts.teamId, nbt.id), eq(cuts.year, 2025)));
console.log('Deleted existing rows:', deleted.rowCount);

type Status = 'cut' | 'protected' | 'pullback';
type Row = { firstName: string; lastName: string; age: number; offense: string|null; defense: string|null; special: string|null; status: Status };

const rows: Row[] = [
  { firstName:'cal',       lastName:'adomitis',         age:26, offense:'c',   defense:null,  special:null,  status:'cut' },
  { firstName:'braxton',   lastName:'berrios',           age:29, offense:'wr',  defense:null,  special:'ret', status:'cut' },
  { firstName:'garett',    lastName:'bolles',            age:32, offense:'t',   defense:null,  special:null,  status:'protected' },
  { firstName:'a.j.',      lastName:'brown',             age:27, offense:'wr',  defense:null,  special:null,  status:'protected' },
  { firstName:'deforest',  lastName:'buckner',           age:30, offense:null,  defense:'dt',  special:null,  status:'protected' },
  { firstName:'javon',     lastName:'bullard',           age:22, offense:null,  defense:'s',   special:null,  status:'protected' },
  { firstName:"de'vondre", lastName:'campbell',          age:31, offense:null,  defense:'olb', special:null,  status:'cut' },
  { firstName:'jalen',     lastName:'carter',            age:23, offense:null,  defense:'dl',  special:null,  status:'protected' },
  { firstName:'zach',      lastName:'charbonnet',        age:23, offense:'rb',  defense:null,  special:null,  status:'protected' },
  { firstName:'charles',   lastName:'cross',             age:24, offense:'t',   defense:null,  special:null,  status:'protected' },
  { firstName:'romeo',     lastName:'doubs',             age:24, offense:'wr',  defense:null,  special:null,  status:'protected' },
  { firstName:'ashton',    lastName:'dulin',             age:27, offense:'wr',  defense:null,  special:'kr',  status:'pullback' },
  { firstName:'daniel',    lastName:'faalele',           age:25, offense:'g',   defense:null,  special:null,  status:'protected' },
  { firstName:'nick',      lastName:'folk',              age:40, offense:null,  defense:null,  special:'k',   status:'protected' },
  { firstName:'jack',      lastName:'fox',               age:28, offense:null,  defense:null,  special:'p',   status:'cut' },
  { firstName:'stephon',   lastName:'gilmore',           age:34, offense:null,  defense:'cb',  special:null,  status:'cut' },
  { firstName:'kyler',     lastName:'gordon',            age:25, offense:null,  defense:'cb',  special:null,  status:'pullback' },
  { firstName:'jt',        lastName:'gray',              age:28, offense:null,  defense:'s',   special:null,  status:'cut' },
  { firstName:'kyle',      lastName:'hamilton',          age:23, offense:null,  defense:'s',   special:null,  status:'protected' },
  { firstName:'shelby',    lastName:'harris',            age:33, offense:null,  defense:'dt',  special:null,  status:'pullback' },
  { firstName:'hunter',    lastName:'henry',             age:30, offense:'te',  defense:null,  special:null,  status:'protected' },
  { firstName:'will',      lastName:'hernandez',         age:29, offense:'g',   defense:null,  special:null,  status:'cut' },
  { firstName:'noah',      lastName:'igbinoghene',       age:25, offense:null,  defense:'cb',  special:'kr',  status:'pullback' },
  { firstName:'aaron',     lastName:'jones',             age:30, offense:'rb',  defense:null,  special:null,  status:'protected' },
  { firstName:'jaylon',    lastName:'jones',             age:22, offense:null,  defense:'cb',  special:null,  status:'cut' },
  { firstName:'cameron',   lastName:'jordan',            age:35, offense:null,  defense:'de',  special:null,  status:'protected' },
  { firstName:'ted',       lastName:'karras',            age:31, offense:'c',   defense:null,  special:null,  status:'protected' },
  { firstName:'arden',     lastName:'key',               age:28, offense:null,  defense:'olb', special:null,  status:'protected' },
  { firstName:'malcolm',   lastName:'koonce',            age:0,  offense:null,  defense:'de',  special:null,  status:'pullback' }, // duplicate resolved: pullback wins
  { firstName:'trevor',    lastName:'lawrence',          age:25, offense:'qb',  defense:null,  special:null,  status:'protected' },
  { firstName:'xavier',    lastName:'legette',           age:23, offense:'wr',  defense:null,  special:'kr',  status:'pullback' },
  { firstName:'hunter',    lastName:'luepke',            age:24, offense:'hb',  defense:null,  special:null,  status:'pullback' },
  { firstName:'jordan',    lastName:'mason',             age:25, offense:'rb',  defense:null,  special:'kr',  status:'protected' },
  { firstName:'trey',      lastName:'mcbride',           age:25, offense:'te',  defense:null,  special:null,  status:'protected' },
  { firstName:'luke',      lastName:'mccaffrey',         age:23, offense:'wr',  defense:null,  special:'kr',  status:'protected' },
  { firstName:'dj',        lastName:'moore',             age:27, offense:'wr',  defense:null,  special:null,  status:'protected' },
  { firstName:'bo',        lastName:'nix',               age:24, offense:'qb',  defense:null,  special:null,  status:'protected' },
  { firstName:'levi',      lastName:'onwuzurike',        age:26, offense:null,  defense:'dl',  special:null,  status:'cut' },
  { firstName:'ivan',      lastName:'pace jr.',          age:24, offense:null,  defense:'ilb', special:null,  status:'cut' },
  { firstName:'germaine',  lastName:'pratt',             age:28, offense:null,  defense:'lb',  special:null,  status:'protected' },
  { firstName:'bernhard',  lastName:'raimann',           age:27, offense:'t',   defense:null,  special:null,  status:'protected' },
  { firstName:'chad',      lastName:'ryland',            age:25, offense:null,  defense:null,  special:'k-p', status:'cut' },
  { firstName:'juice',     lastName:'scruggs',           age:24, offense:'c-g', defense:null,  special:null,  status:'cut' },
  { firstName:'harrison',  lastName:'smith',             age:35, offense:null,  defense:'s',   special:null,  status:'protected' },
  { firstName:'ihmir',     lastName:'smith-marsette',    age:25, offense:'wr',  defense:null,  special:'ret', status:'cut' },
  { firstName:'montez',    lastName:'sweat',             age:28, offense:null,  defense:'de',  special:null,  status:'protected' },
  { firstName:'henry',     lastName:"to'o to'o",         age:23, offense:null,  defense:'lb',  special:null,  status:'protected' },
  { firstName:'carrington',lastName:'valentine',         age:23, offense:null,  defense:'cb',  special:null,  status:'protected' },
  { firstName:'quay',      lastName:'walker',            age:24, offense:null,  defense:'ilb', special:null,  status:'cut' },
  { firstName:'travon',    lastName:'walker',            age:24, offense:null,  defense:'de',  special:null,  status:'protected' },
  { firstName:'nic',       lastName:'westbrook-ikhine',  age:27, offense:'wr',  defense:null,  special:null,  status:'cut' },
  { firstName:'d.j.',      lastName:'wonnum',            age:27, offense:null,  defense:'olb', special:null,  status:'pullback' },
  { firstName:'kevin',     lastName:'zeitler',           age:34, offense:'g',   defense:null,  special:null,  status:'protected' },
];

const dt = new Date('2026-02-16 17:08:15');
for (const r of rows) {
  await db.insert(cuts).values({
    leagueId: LEAGUE_ID, year: 2025, teamId: nbt.id,
    firstName: r.firstName, lastName: r.lastName, age: r.age,
    offense: r.offense, defense: r.defense, special: r.special,
    status: r.status, datetime: dt, touch_id: TOUCH_ID,
  });
}

console.log(`Inserted ${rows.length} rows for Newark Bay.`);

// Verify
const summary = await db.select().from(cuts)
  .where(and(eq(cuts.leagueId, LEAGUE_ID), eq(cuts.teamId, nbt.id), eq(cuts.year, 2025)));
const p = summary.filter(r => r.status === 'protected').length;
const c = summary.filter(r => r.status === 'cut').length;
const pb = summary.filter(r => r.status === 'pullback').length;
console.log(`Newark Bay 2025: protected=${p} cut=${c} pullback=${pb} total=${summary.length}`);
