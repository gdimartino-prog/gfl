import { buildPlayerIdentity } from './players';

export function findPlayerRowIndex(rows: string[][], target: any): number {
  const [header, ...data] = rows;

  const index = Object.fromEntries(
    header.map((key, i) => [key.toLowerCase(), i])
  );

const foundIndex = data.findIndex(row => {
  const player = {
  first: row[2],
  last: row[3],
  age: Number(row[5]),
  offense: row[6] || '',
  defense: row[7] || '',
  special: row[8] || '',
};

  return buildPlayerIdentity(player) === target.identity;
});

if (foundIndex === -1) {
  throw new Error('Player row index not found');
}

return foundIndex + 2;
}
