export type Player = {
  first: string;
  last: string;
  age: number;
  team: string;
  offense: string;
  defense: string;
  special: string;
  position: string; // new field
  isIR: boolean;
  identity: string;
};

export function buildPlayerIdentity(player: Player): string {
  return [
    player.first,
    player.last,
    player.age,
    player.offense,
    player.defense,
    player.special,
  ]
    .join('|')
    .toLowerCase();
}

export function parsePlayers(rows: string[][]): Player[] {
  const [, ...data] = rows; // skip header row

  return data.map((row) => {
    const team = row[0];

    const offense = row[6] || '';
    const defense = row[7] || '';
    const special = row[8] || '';

    const position = [offense, defense, special].filter((p) => p).join('/');

    const player: Player = {
      team,
      first: row[2],
      last: row[3],
      age: Number(row[5]),
      offense,
      defense,
      special,
      position, // set concatenated position
      isIR: team?.includes('-IR'),
      identity: '', // will fill below
    };

    return {
      ...player,
      identity: buildPlayerIdentity(player),
    };
  });
}
