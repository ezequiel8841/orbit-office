// Sort + filter operations on a SheetData. Mutate-in-place; caller bumps store.
import type { SheetData, CellValue, Cell } from "./model";
import { a1, normalizeRange, type RangeRC } from "./address";

function readDisplay(sheet: SheetData, r: number, c: number): CellValue {
  const cell = sheet.cells.get(a1(r, c));
  return cell?.v ?? null;
}

function compare(a: CellValue, b: CellValue): number {
  // null/empty go last
  const aE = a === null || a === "" || a === undefined;
  const bE = b === null || b === "" || b === undefined;
  if (aE && bE) return 0;
  if (aE) return 1;
  if (bE) return -1;
  if (typeof a === "number" && typeof b === "number") return a - b;
  if (typeof a === "boolean" && typeof b === "boolean") return (a ? 1 : 0) - (b ? 1 : 0);
  return String(a).localeCompare(String(b), undefined, { numeric: true, sensitivity: "base" });
}

export interface SortKey { col: number; desc?: boolean; }

/**
 * Sort rows of `range` by the given keys. Operates in-place on cells (formulas
 * will be moved as-is, with addresses NOT rewritten — caveat documented).
 * Returns inverse function for undo.
 */
export function sortRange(
  sheet: SheetData,
  range: RangeRC,
  keys: SortKey[],
): () => void {
  const n = normalizeRange(range);
  const nRows = n.r2 - n.r1 + 1;
  const nCols = n.c2 - n.c1 + 1;
  // Snapshot cells in range
  const before = new Map<string, Cell | undefined>();
  const matrix: (Cell | undefined)[][] = [];
  for (let r = 0; r < nRows; r++) {
    const row: (Cell | undefined)[] = [];
    for (let c = 0; c < nCols; c++) {
      const k = a1(n.r1 + r, n.c1 + c);
      const cur = sheet.cells.get(k);
      before.set(k, cur ? { ...cur, s: cur.s ? { ...cur.s } : undefined } : undefined);
      row.push(cur ? { ...cur, s: cur.s ? { ...cur.s } : undefined } : undefined);
    }
    matrix.push(row);
  }
  const indexes = matrix.map((_, i) => i);
  indexes.sort((ia, ib) => {
    for (const k of keys) {
      const ci = k.col - n.c1;
      if (ci < 0 || ci >= nCols) continue;
      const va = matrix[ia][ci]?.v ?? null;
      const vb = matrix[ib][ci]?.v ?? null;
      const cmp = compare(va, vb) * (k.desc ? -1 : 1);
      if (cmp !== 0) return cmp;
    }
    return 0;
  });
  for (let r = 0; r < nRows; r++) {
    const src = indexes[r];
    for (let c = 0; c < nCols; c++) {
      const k = a1(n.r1 + r, n.c1 + c);
      const cell = matrix[src][c];
      if (cell) sheet.cells.set(k, cell);
      else sheet.cells.delete(k);
    }
  }
  // Inverse: restore snapshot
  return () => {
    before.forEach((v, k) => {
      if (v) sheet.cells.set(k, v);
      else sheet.cells.delete(k);
    });
  };
}

export function uniqueColumnValues(sheet: SheetData, col: number): string[] {
  const set = new Set<string>();
  for (let r = 0; r < sheet.numRows; r++) {
    const v = readDisplay(sheet, r, col);
    if (v === null || v === "") continue;
    set.add(String(v));
  }
  // also include "(Blanks)" sentinel if any blank exists
  for (let r = 0; r < sheet.numRows; r++) {
    const v = readDisplay(sheet, r, col);
    if (v === null || v === "") {
      set.add("");
      break;
    }
  }
  return [...set].sort((a, b) => a.localeCompare(b, undefined, { numeric: true }));
}

export function recomputeHidden(sheet: SheetData) {
  sheet.hiddenRows.clear();
  if (sheet.filters.size === 0) return;
  for (let r = 0; r < sheet.numRows; r++) {
    let hidden = false;
    for (const [col, allowed] of sheet.filters) {
      const v = readDisplay(sheet, r, col);
      const key = v === null || v === undefined ? "" : String(v);
      if (!allowed.has(key)) {
        hidden = true;
        break;
      }
    }
    if (hidden) sheet.hiddenRows.add(r);
  }
}
