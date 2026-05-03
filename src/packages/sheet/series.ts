// Series detection for auto-fill.
import type { CellValue } from "./model";

export interface FillSource {
  values: CellValue[]; // along the fill direction (row or col)
}

export interface FillResult {
  values: CellValue[];
}

// Detect numeric arithmetic progression. Returns step or null.
function numericStep(vals: CellValue[]): number | null {
  if (vals.length < 2) return null;
  let step = 0;
  for (let i = 1; i < vals.length; i++) {
    const a = vals[i - 1];
    const b = vals[i];
    if (typeof a !== "number" || typeof b !== "number") return null;
    const d = b - a;
    if (i === 1) step = d;
    else if (Math.abs(d - step) > 1e-9) return null;
  }
  return step;
}

// Split a string like "Item 12" into prefix + number + suffix.
function splitNumeric(s: string): { prefix: string; n: number; suffix: string } | null {
  const m = /^(.*?)(-?\d+)([^\d]*)$/.exec(s);
  if (!m) return null;
  return { prefix: m[1], n: parseInt(m[2], 10), suffix: m[3] };
}

export function fillSeries(source: CellValue[], length: number): CellValue[] {
  if (length <= 0) return [];
  if (source.length === 0) return new Array(length).fill(null);

  // Single cell: copy or extrapolate basic patterns.
  if (source.length === 1) {
    const v = source[0];
    if (typeof v === "number") {
      // Increment by 1 by default? Excel copies. Keep copy for safety.
      return new Array(length).fill(v);
    }
    if (typeof v === "string") {
      const parts = splitNumeric(v);
      if (parts) {
        const out: CellValue[] = [];
        for (let i = 0; i < length; i++) {
          out.push(parts.prefix + (parts.n + i + 1) + parts.suffix);
        }
        return out;
      }
    }
    return new Array(length).fill(v);
  }

  // Numeric arithmetic progression
  const step = numericStep(source);
  if (step !== null) {
    const out: CellValue[] = [];
    const last = source[source.length - 1] as number;
    for (let i = 1; i <= length; i++) out.push(last + step * i);
    return out;
  }

  // String + numeric suffix progression (e.g. "Q1", "Q2" -> "Q3"...)
  if (source.every((v) => typeof v === "string")) {
    const parts = (source as string[]).map(splitNumeric);
    if (parts.every((p) => p !== null)) {
      const ps = parts as { prefix: string; n: number; suffix: string }[];
      const samePrefix = ps.every((p) => p.prefix === ps[0].prefix && p.suffix === ps[0].suffix);
      if (samePrefix) {
        // detect step in numeric part
        let step = 0;
        let ok = true;
        for (let i = 1; i < ps.length; i++) {
          const d = ps[i].n - ps[i - 1].n;
          if (i === 1) step = d;
          else if (d !== step) { ok = false; break; }
        }
        if (ok) {
          const out: CellValue[] = [];
          const lastN = ps[ps.length - 1].n;
          for (let i = 1; i <= length; i++) {
            out.push(ps[0].prefix + (lastN + step * i) + ps[0].suffix);
          }
          return out;
        }
      }
    }
  }

  // Fallback: cycle the source values.
  const out: CellValue[] = [];
  for (let i = 0; i < length; i++) out.push(source[i % source.length]);
  return out;
}
