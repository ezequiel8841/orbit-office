// Helpers for merged cell rectangles.
import type { SheetData, MergeRect } from "./model";
import { normalizeRange, type RangeRC } from "./address";

export function rectsOverlap(a: MergeRect, b: MergeRect): boolean {
  return !(a.r2 < b.r1 || b.r2 < a.r1 || a.c2 < b.c1 || b.c2 < a.c1);
}

export function findMergeAt(sheet: SheetData, row: number, col: number): MergeRect | undefined {
  for (const m of sheet.merges) {
    if (row >= m.r1 && row <= m.r2 && col >= m.c1 && col <= m.c2) return m;
  }
  return undefined;
}

export function isMergeAnchor(m: MergeRect, row: number, col: number): boolean {
  return m.r1 === row && m.c1 === col;
}

export function mergeRange(sheet: SheetData, range: RangeRC): MergeRect[] {
  const n = normalizeRange(range);
  if (n.r1 === n.r2 && n.c1 === n.c2) return [];
  const removed: MergeRect[] = [];
  // Remove any merge intersecting this range
  sheet.merges = sheet.merges.filter((m) => {
    if (rectsOverlap(m, n)) {
      removed.push(m);
      return false;
    }
    return true;
  });
  sheet.merges.push({ r1: n.r1, c1: n.c1, r2: n.r2, c2: n.c2 });
  return removed;
}

export function unmergeRange(sheet: SheetData, range: RangeRC): MergeRect[] {
  const n = normalizeRange(range);
  const removed: MergeRect[] = [];
  sheet.merges = sheet.merges.filter((m) => {
    if (rectsOverlap(m, n)) {
      removed.push(m);
      return false;
    }
    return true;
  });
  return removed;
}
