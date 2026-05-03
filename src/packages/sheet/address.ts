// Address helpers: A1 ↔ {row, col} (0-based internally).
export function colToLetters(col: number): string {
  let n = col;
  let s = "";
  do {
    s = String.fromCharCode(65 + (n % 26)) + s;
    n = Math.floor(n / 26) - 1;
  } while (n >= 0);
  return s;
}

export function lettersToCol(letters: string): number {
  let n = 0;
  for (let i = 0; i < letters.length; i++) {
    n = n * 26 + (letters.charCodeAt(i) - 64);
  }
  return n - 1;
}

export const a1 = (row: number, col: number) =>
  `${colToLetters(col)}${row + 1}`;

export function parseA1(addr: string): { row: number; col: number } | null {
  const m = /^([A-Z]+)(\d+)$/.exec(addr);
  if (!m) return null;
  return { col: lettersToCol(m[1]), row: parseInt(m[2], 10) - 1 };
}

export interface RangeRC {
  r1: number;
  c1: number;
  r2: number;
  c2: number;
}

export const normalizeRange = (r: RangeRC): RangeRC => ({
  r1: Math.min(r.r1, r.r2),
  r2: Math.max(r.r1, r.r2),
  c1: Math.min(r.c1, r.c2),
  c2: Math.max(r.c1, r.c2),
});

export const inRange = (r: RangeRC, row: number, col: number) => {
  const n = normalizeRange(r);
  return row >= n.r1 && row <= n.r2 && col >= n.c1 && col <= n.c2;
};
