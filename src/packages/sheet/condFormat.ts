// Conditional formatting evaluation.
import type { CellStyle, CellValue, CondFormat, SheetData } from "./model";
import { a1 } from "./address";

export interface AppliedCF {
  bg?: string;
  color?: string;
  bold?: boolean;
  italic?: boolean;
}

/** Find the first matching cond-format style for the cell. */
export function evalCondFormat(
  sheet: SheetData,
  row: number,
  col: number,
  value: CellValue,
): AppliedCF | null {
  for (const cf of sheet.condFormats) {
    if (row < cf.r1 || row > cf.r2 || col < cf.c1 || col > cf.c2) continue;
    const matched = matchRule(sheet, cf, row, col, value);
    if (matched === null) continue; // not applicable
    if (matched === "scale") {
      const bg = colorScaleColor(sheet, cf, value);
      if (bg) return { bg };
      continue;
    }
    if (matched) return cf.style ?? { bg: "#fff7b3" };
  }
  return null;
}

function matchRule(
  sheet: SheetData,
  cf: CondFormat,
  row: number,
  col: number,
  v: CellValue,
): boolean | "scale" | null {
  const r = cf.rule;
  switch (r.kind) {
    case "greater": return typeof v === "number" && v > r.value;
    case "less": return typeof v === "number" && v < r.value;
    case "between":
      return typeof v === "number" && v >= r.min && v <= r.max;
    case "equal":
      return typeof r.value === "number"
        ? Number(v) === r.value
        : String(v ?? "").toLowerCase() === String(r.value).toLowerCase();
    case "contains":
      return String(v ?? "").toLowerCase().includes(r.text.toLowerCase());
    case "duplicates": {
      if (v == null || v === "") return false;
      let count = 0;
      for (let rr = cf.r1; rr <= cf.r2; rr++) {
        for (let cc = cf.c1; cc <= cf.c2; cc++) {
          const other = sheet.cells.get(a1(rr, cc))?.v;
          if (other === v) {
            count++;
            if (count > 1) return true;
          }
        }
      }
      return false;
    }
    case "topN": {
      if (typeof v !== "number") return false;
      const nums: number[] = [];
      for (let rr = cf.r1; rr <= cf.r2; rr++)
        for (let cc = cf.c1; cc <= cf.c2; cc++) {
          const x = sheet.cells.get(a1(rr, cc))?.v;
          if (typeof x === "number") nums.push(x);
        }
      nums.sort((a, b) => (r.bottom ? a - b : b - a));
      const cutoff = nums[Math.min(r.n, nums.length) - 1];
      if (cutoff === undefined) return false;
      return r.bottom ? v <= cutoff : v >= cutoff;
    }
    case "colorScale": return "scale";
  }
}

function colorScaleColor(sheet: SheetData, cf: CondFormat, v: CellValue): string | null {
  if (typeof v !== "number") return null;
  if (cf.rule.kind !== "colorScale") return null;
  let lo = Infinity, hi = -Infinity;
  for (let rr = cf.r1; rr <= cf.r2; rr++)
    for (let cc = cf.c1; cc <= cf.c2; cc++) {
      const x = sheet.cells.get(a1(rr, cc))?.v;
      if (typeof x === "number") { if (x < lo) lo = x; if (x > hi) hi = x; }
    }
  if (!isFinite(lo) || lo === hi) return cf.rule.mid ?? "#ffeb84";
  const t = (v - lo) / (hi - lo);
  const c1 = hex(cf.rule.min ?? "#f8696b");
  const c2 = hex(cf.rule.max ?? "#63be7b");
  return lerp(c1, c2, t);
}

function hex(s: string): [number, number, number] {
  const m = /^#?([0-9a-f]{6})$/i.exec(s);
  if (!m) return [255, 255, 255];
  const n = parseInt(m[1], 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}
function lerp(a: [number, number, number], b: [number, number, number], t: number) {
  const r = Math.round(a[0] + (b[0] - a[0]) * t);
  const g = Math.round(a[1] + (b[1] - a[1]) * t);
  const bl = Math.round(a[2] + (b[2] - a[2]) * t);
  return `rgb(${r},${g},${bl})`;
}

export function mergeStyleWithCF(base: CellStyle | undefined, cf: AppliedCF | null): CellStyle | undefined {
  if (!cf) return base;
  return {
    ...(base ?? {}),
    ...(cf.bg ? { bg: cf.bg } : {}),
    ...(cf.color ? { color: cf.color } : {}),
    ...(cf.bold ? { bold: true } : {}),
    ...(cf.italic ? { italic: true } : {}),
  };
}
