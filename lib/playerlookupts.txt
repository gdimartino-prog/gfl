export function findPlayerRowIndex(
  rows: string[][],
  target: { identity: string }
): number {
  const [, ...data] = rows; // skip header

  const foundIndex = data.findIndex((row) => {
    const identity = [
      row[2],               // first
      row[3],               // last
      Number(row[5]),       // age
      row[6] || '',         // offense
      row[7] || '',         // defense
      row[8] || '',         // special
    ]
      .join('|')
      .toLowerCase();

    return identity === target.identity;
  });

  if (foundIndex === -1) {
    throw new Error('Player row index not found');
  }

  // +2 = header row + 1-based sheet index
  return foundIndex + 2;
}
