// Prefix-sum cache for variable-sized rows/cols. O(log n) lookup via binary search.
import type { SheetData } from "./model";
import { DEFAULT_COL_W, DEFAULT_ROW_H } from "./model";

export class AxisCache {
  private offsets: number[] = [0];
  constructor(
    private count: number,
    private getSize: (i: number) => number,
  ) {
    this.rebuild();
  }
  rebuild() {
    this.offsets = new Array(this.count + 1);
    this.offsets[0] = 0;
    for (let i = 0; i < this.count; i++) {
      this.offsets[i + 1] = this.offsets[i] + this.getSize(i);
    }
  }
  total() {
    return this.offsets[this.count];
  }
  offsetOf(i: number) {
    return this.offsets[Math.max(0, Math.min(this.count, i))];
  }
  sizeOf(i: number) {
    return this.offsets[i + 1] - this.offsets[i];
  }
  // returns the index whose start <= pos < next start
  indexAt(pos: number): number {
    let lo = 0;
    let hi = this.count - 1;
    while (lo <= hi) {
      const mid = (lo + hi) >>> 1;
      const start = this.offsets[mid];
      const end = this.offsets[mid + 1];
      if (pos < start) hi = mid - 1;
      else if (pos >= end) lo = mid + 1;
      else return mid;
    }
    return Math.max(0, Math.min(this.count - 1, lo));
  }
  // visible range for [scroll, scroll+viewport]
  rangeFor(scroll: number, viewport: number, overscan = 4): [number, number] {
    const start = Math.max(0, this.indexAt(scroll) - overscan);
    const end = Math.min(this.count - 1, this.indexAt(scroll + viewport) + overscan);
    return [start, end];
  }
}

export function buildAxes(sheet: SheetData) {
  const cols = new AxisCache(
    sheet.numCols,
    (c) => sheet.cols.get(c)?.w ?? DEFAULT_COL_W,
  );
  const rows = new AxisCache(
    sheet.numRows,
    (r) => (sheet.hiddenRows.has(r) ? 0 : sheet.rows.get(r)?.h ?? DEFAULT_ROW_H),
  );
  return { cols, rows };
}
