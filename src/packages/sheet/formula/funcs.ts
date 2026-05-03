// Built-in functions. All receive an array of evaluated arguments
// (which may themselves be arrays for ranges).
import type { CellValue } from "../model";

export type Val = CellValue | CellValue[][];
export class FormulaError extends Error {
  constructor(public code: string) { super(code); }
}

export const ERR = {
  DIV0: "#DIV/0!",
  VALUE: "#VALUE!",
  NAME: "#NAME?",
  NA: "#N/A",
  REF: "#REF!",
  NUM: "#NUM!",
  CIRC: "#CIRC!",
};

const isArr = (v: Val): v is CellValue[][] => Array.isArray(v);

function flatten(args: Val[]): CellValue[] {
  const out: CellValue[] = [];
  for (const a of args) {
    if (isArr(a)) for (const row of a) for (const v of row) out.push(v);
    else out.push(a);
  }
  return out;
}

function nums(args: Val[]): number[] {
  const out: number[] = [];
  for (const v of flatten(args)) {
    if (typeof v === "number") out.push(v);
    else if (typeof v === "boolean") out.push(v ? 1 : 0);
    else if (typeof v === "string" && v !== "" && !isNaN(Number(v))) out.push(Number(v));
  }
  return out;
}

const toNum = (v: CellValue): number => {
  if (typeof v === "number") return v;
  if (typeof v === "boolean") return v ? 1 : 0;
  if (v == null || v === "") return 0;
  const n = Number(v);
  if (isNaN(n)) throw new FormulaError(ERR.VALUE);
  return n;
};
const toStr = (v: CellValue): string => (v == null ? "" : String(v));
const toBool = (v: CellValue): boolean => {
  if (typeof v === "boolean") return v;
  if (typeof v === "number") return v !== 0;
  if (v == null || v === "") return false;
  const s = String(v).toUpperCase();
  if (s === "TRUE") return true;
  if (s === "FALSE") return false;
  return Boolean(v);
};
const single = (v: Val): CellValue => (isArr(v) ? v[0]?.[0] ?? null : v);

type Fn = (args: Val[]) => CellValue;

export const FUNCS: Record<string, Fn> = {
  // math
  SUM: (a) => nums(a).reduce((s, n) => s + n, 0),
  AVERAGE: (a) => {
    const n = nums(a);
    if (!n.length) throw new FormulaError(ERR.DIV0);
    return n.reduce((s, x) => s + x, 0) / n.length;
  },
  COUNT: (a) => nums(a).length,
  COUNTA: (a) => flatten(a).filter((v) => v !== null && v !== "").length,
  MAX: (a) => { const n = nums(a); if (!n.length) return 0; return Math.max(...n); },
  MIN: (a) => { const n = nums(a); if (!n.length) return 0; return Math.min(...n); },
  ABS: (a) => Math.abs(toNum(single(a[0]))),
  ROUND: (a) => {
    const x = toNum(single(a[0]));
    const d = a[1] != null ? toNum(single(a[1])) : 0;
    const k = Math.pow(10, d);
    return Math.round(x * k) / k;
  },
  FLOOR: (a) => Math.floor(toNum(single(a[0]))),
  CEILING: (a) => Math.ceil(toNum(single(a[0]))),
  MOD: (a) => {
    const d = toNum(single(a[1]));
    if (d === 0) throw new FormulaError(ERR.DIV0);
    return toNum(single(a[0])) % d;
  },
  POWER: (a) => Math.pow(toNum(single(a[0])), toNum(single(a[1]))),
  SQRT: (a) => {
    const x = toNum(single(a[0]));
    if (x < 0) throw new FormulaError(ERR.NUM);
    return Math.sqrt(x);
  },
  RAND: () => Math.random(),
  RANDBETWEEN: (a) => {
    const lo = Math.ceil(toNum(single(a[0])));
    const hi = Math.floor(toNum(single(a[1])));
    return Math.floor(Math.random() * (hi - lo + 1)) + lo;
  },
  PI: () => Math.PI,

  // logic
  IF: (a) => (toBool(single(a[0])) ? single(a[1]) : a[2] != null ? single(a[2]) : false),
  IFERROR: (a) => single(a[0]), // errors throw before reaching here; second arg used by evaluator wrapper
  AND: (a) => flatten(a).every(toBool),
  OR: (a) => flatten(a).some(toBool),
  NOT: (a) => !toBool(single(a[0])),
  TRUE: () => true,
  FALSE: () => false,

  // info
  ISBLANK: (a) => { const v = single(a[0]); return v === null || v === ""; },
  ISNUMBER: (a) => typeof single(a[0]) === "number",
  ISTEXT: (a) => typeof single(a[0]) === "string",

  // text
  CONCAT: (a) => flatten(a).map(toStr).join(""),
  CONCATENATE: (a) => flatten(a).map(toStr).join(""),
  LEN: (a) => toStr(single(a[0])).length,
  UPPER: (a) => toStr(single(a[0])).toUpperCase(),
  LOWER: (a) => toStr(single(a[0])).toLowerCase(),
  TRIM: (a) => toStr(single(a[0])).trim(),
  LEFT: (a) => toStr(single(a[0])).slice(0, a[1] != null ? toNum(single(a[1])) : 1),
  RIGHT: (a) => {
    const s = toStr(single(a[0]));
    const n = a[1] != null ? toNum(single(a[1])) : 1;
    return s.slice(Math.max(0, s.length - n));
  },
  MID: (a) => {
    const s = toStr(single(a[0]));
    const start = toNum(single(a[1])) - 1;
    const len = toNum(single(a[2]));
    return s.slice(Math.max(0, start), Math.max(0, start) + len);
  },

  PROPER: (a) =>
    toStr(single(a[0])).replace(/\b\w+/g, (w) => w[0].toUpperCase() + w.slice(1).toLowerCase()),
  SUBSTITUTE: (a) => {
    const s = toStr(single(a[0]));
    const find = toStr(single(a[1]));
    const repl = toStr(single(a[2]));
    const nth = a[3] != null ? toNum(single(a[3])) : null;
    if (!find) return s;
    if (nth == null) return s.split(find).join(repl);
    let i = 0; let from = 0; let idx;
    while ((idx = s.indexOf(find, from)) !== -1) {
      i++;
      if (i === nth) return s.slice(0, idx) + repl + s.slice(idx + find.length);
      from = idx + find.length;
    }
    return s;
  },
  REPLACE: (a) => {
    const s = toStr(single(a[0]));
    const start = toNum(single(a[1])) - 1;
    const len = toNum(single(a[2]));
    const repl = toStr(single(a[3]));
    return s.slice(0, Math.max(0, start)) + repl + s.slice(Math.max(0, start) + len);
  },
  FIND: (a) => {
    const find = toStr(single(a[0]));
    const within = toStr(single(a[1]));
    const start = a[2] != null ? toNum(single(a[2])) - 1 : 0;
    const i = within.indexOf(find, start);
    if (i < 0) throw new FormulaError(ERR.VALUE);
    return i + 1;
  },
  SEARCH: (a) => {
    const find = toStr(single(a[0])).toLowerCase();
    const within = toStr(single(a[1])).toLowerCase();
    const start = a[2] != null ? toNum(single(a[2])) - 1 : 0;
    const i = within.indexOf(find, start);
    if (i < 0) throw new FormulaError(ERR.VALUE);
    return i + 1;
  },
  TEXT: (a) => {
    const v = toNum(single(a[0]));
    const fmt = toStr(single(a[1]));
    if (fmt.endsWith("%")) {
      const dec = (fmt.match(/0\.(0+)%/)?.[1].length) ?? 0;
      return (v * 100).toFixed(dec) + "%";
    }
    const hasComma = fmt.includes(",");
    const dec = (fmt.match(/\.(0+)/)?.[1].length) ?? 0;
    return v.toLocaleString(undefined, {
      minimumFractionDigits: dec,
      maximumFractionDigits: dec,
      useGrouping: hasComma,
    });
  },
  VALUE: (a) => {
    const s = toStr(single(a[0])).trim().replace(/,/g, "");
    const n = Number(s);
    if (isNaN(n)) throw new FormulaError(ERR.VALUE);
    return n;
  },

  // info extras (ISERROR/ISNA wrapped specially in evaluator)
  ISERROR: () => false,
  ISNA: () => false,
  ISLOGICAL: (a) => typeof single(a[0]) === "boolean",

  // statistics
  MEDIAN: (a) => {
    const n = nums(a).slice().sort((x, y) => x - y);
    if (!n.length) throw new FormulaError(ERR.NUM);
    const m = Math.floor(n.length / 2);
    return n.length % 2 ? n[m] : (n[m - 1] + n[m]) / 2;
  },
  STDEV: (a) => {
    const n = nums(a);
    if (n.length < 2) throw new FormulaError(ERR.DIV0);
    const mean = n.reduce((s, x) => s + x, 0) / n.length;
    const v = n.reduce((s, x) => s + (x - mean) ** 2, 0) / (n.length - 1);
    return Math.sqrt(v);
  },
  VAR: (a) => {
    const n = nums(a);
    if (n.length < 2) throw new FormulaError(ERR.DIV0);
    const mean = n.reduce((s, x) => s + x, 0) / n.length;
    return n.reduce((s, x) => s + (x - mean) ** 2, 0) / (n.length - 1);
  },
  RANK: (a) => {
    const x = toNum(single(a[0]));
    const arr = nums([a[1]]);
    const asc = a[2] != null && toBool(single(a[2]));
    const sorted = arr.slice().sort((p, q) => (asc ? p - q : q - p));
    const i = sorted.indexOf(x);
    if (i < 0) throw new FormulaError(ERR.NA);
    return i + 1;
  },

  // conditional aggregates
  COUNTIF: (a) => countIf(a[0], a[1]),
  SUMIF: (a) => sumIf(a[0], a[1], a[2] ?? a[0]),
  AVERAGEIF: (a) => {
    const cnt = countIf(a[0], a[1]);
    if (cnt === 0) throw new FormulaError(ERR.DIV0);
    return sumIf(a[0], a[1], a[2] ?? a[0]) / cnt;
  },
  COUNTIFS: (a) => countIfs(a),
  SUMIFS: (a) => sumIfs(a),
  AVERAGEIFS: (a) => {
    const cnt = countIfs(a.slice(1));
    if (cnt === 0) throw new FormulaError(ERR.DIV0);
    return sumIfs(a) / cnt;
  },
  IFS: (a) => {
    for (let i = 0; i < a.length; i += 2) {
      if (toBool(single(a[i]))) return single(a[i + 1]) ?? null;
    }
    throw new FormulaError(ERR.NA);
  },

  // lookup
  VLOOKUP: (a) => vlookup(a, "v"),
  HLOOKUP: (a) => vlookup(a, "h"),
  INDEX: (a) => {
    const m = a[0];
    if (!isArr(m)) return single(m);
    const r = toNum(single(a[1])) - 1;
    const c = a[2] != null ? toNum(single(a[2])) - 1 : 0;
    return m[r]?.[c] ?? null;
  },
  MATCH: (a) => {
    const lookup = single(a[0]);
    const range = a[1];
    const type = a[2] != null ? toNum(single(a[2])) : 1;
    const arr = isArr(range) ? (range.flat() as CellValue[]) : [single(range)];
    if (type === 0) {
      const i = arr.findIndex((v) => v === lookup);
      if (i < 0) throw new FormulaError(ERR.NA);
      return i + 1;
    }
    let best = -1;
    for (let i = 0; i < arr.length; i++) {
      const v = arr[i];
      if (type === 1 && (v as number) <= (lookup as number)) best = i;
      else if (type === -1 && (v as number) >= (lookup as number)) best = i;
    }
    if (best < 0) throw new FormulaError(ERR.NA);
    return best + 1;
  },
  XLOOKUP: (a) => {
    const lookup = single(a[0]);
    const lookArr = isArr(a[1]) ? (a[1].flat() as CellValue[]) : [single(a[1])];
    const retArr = isArr(a[2]) ? (a[2].flat() as CellValue[]) : [single(a[2])];
    const notFound = a[3] != null ? single(a[3]) : null;
    const i = lookArr.findIndex((v) => v === lookup);
    if (i < 0) {
      if (notFound !== null) return notFound;
      throw new FormulaError(ERR.NA);
    }
    return retArr[i] ?? null;
  },

  // dates
  TODAY: () => Math.floor(Date.now() / 86400000),
  NOW: () => Date.now() / 86400000,
  YEAR: (a) => new Date(toNum(single(a[0])) * 86400000).getUTCFullYear(),
  MONTH: (a) => new Date(toNum(single(a[0])) * 86400000).getUTCMonth() + 1,
  DAY: (a) => new Date(toNum(single(a[0])) * 86400000).getUTCDate(),
  DATE: (a) => {
    const y = toNum(single(a[0]));
    const m = toNum(single(a[1])) - 1;
    const d = toNum(single(a[2]));
    return Math.floor(Date.UTC(y, m, d) / 86400000);
  },
  HOUR: (a) => new Date(toNum(single(a[0])) * 86400000).getUTCHours(),
  MINUTE: (a) => new Date(toNum(single(a[0])) * 86400000).getUTCMinutes(),
  SECOND: (a) => new Date(toNum(single(a[0])) * 86400000).getUTCSeconds(),
  WEEKDAY: (a) => {
    const v = toNum(single(a[0]));
    const type = a[1] != null ? toNum(single(a[1])) : 1;
    const d = new Date(v * 86400000).getUTCDay();
    if (type === 1) return d + 1;
    if (type === 2) return ((d + 6) % 7) + 1;
    if (type === 3) return (d + 6) % 7;
    return d + 1;
  },
  EOMONTH: (a) => {
    const v = toNum(single(a[0]));
    const months = toNum(single(a[1]));
    const d = new Date(v * 86400000);
    const r = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth() + months + 1, 0));
    return Math.floor(r.getTime() / 86400000);
  },
  DATEDIF: (a) => {
    const s = new Date(toNum(single(a[0])) * 86400000);
    const e = new Date(toNum(single(a[1])) * 86400000);
    const unit = toStr(single(a[2])).toUpperCase();
    if (unit === "D") return Math.floor((+e - +s) / 86400000);
    if (unit === "M") {
      return (e.getUTCFullYear() - s.getUTCFullYear()) * 12 + (e.getUTCMonth() - s.getUTCMonth());
    }
    if (unit === "Y") {
      let y = e.getUTCFullYear() - s.getUTCFullYear();
      if (e.getUTCMonth() < s.getUTCMonth() ||
          (e.getUTCMonth() === s.getUTCMonth() && e.getUTCDate() < s.getUTCDate())) y--;
      return y;
    }
    throw new FormulaError(ERR.VALUE);
  },
  NETWORKDAYS: (a) => {
    let s = toNum(single(a[0]));
    const e = toNum(single(a[1]));
    if (s > e) s = e;
    let n = 0;
    for (let d = s; d <= e; d++) {
      const wd = new Date(d * 86400000).getUTCDay();
      if (wd !== 0 && wd !== 6) n++;
    }
    return n;
  },

  // financial
  PMT: (a) => {
    const r = toNum(single(a[0]));
    const n = toNum(single(a[1]));
    const pv = toNum(single(a[2]));
    const fv = a[3] != null ? toNum(single(a[3])) : 0;
    if (r === 0) return -(pv + fv) / n;
    const p = Math.pow(1 + r, n);
    return -(r * (pv * p + fv)) / (p - 1);
  },
  FV: (a) => {
    const r = toNum(single(a[0]));
    const n = toNum(single(a[1]));
    const pmt = toNum(single(a[2]));
    const pv = a[3] != null ? toNum(single(a[3])) : 0;
    if (r === 0) return -(pv + pmt * n);
    const p = Math.pow(1 + r, n);
    return -(pv * p + pmt * (p - 1) / r);
  },
  PV: (a) => {
    const r = toNum(single(a[0]));
    const n = toNum(single(a[1]));
    const pmt = toNum(single(a[2]));
    const fv = a[3] != null ? toNum(single(a[3])) : 0;
    if (r === 0) return -(fv + pmt * n);
    const p = Math.pow(1 + r, n);
    return -(fv + pmt * (p - 1) / r) / p;
  },
  NPV: (a) => {
    const r = toNum(single(a[0]));
    const flows = nums(a.slice(1));
    let s = 0;
    for (let i = 0; i < flows.length; i++) s += flows[i] / Math.pow(1 + r, i + 1);
    return s;
  },
  IRR: (a) => {
    const flows = nums([a[0]]);
    let guess = a[1] != null ? toNum(single(a[1])) : 0.1;
    for (let it = 0; it < 100; it++) {
      let npv = 0; let dnpv = 0;
      for (let i = 0; i < flows.length; i++) {
        const p = Math.pow(1 + guess, i);
        npv += flows[i] / p;
        dnpv += -i * flows[i] / (p * (1 + guess));
      }
      if (dnpv === 0) throw new FormulaError(ERR.NUM);
      const next = guess - npv / dnpv;
      if (Math.abs(next - guess) < 1e-7) return next;
      guess = next;
    }
    throw new FormulaError(ERR.NUM);
  },
  RATE: (a) => {
    const n = toNum(single(a[0]));
    const pmt = toNum(single(a[1]));
    const pv = toNum(single(a[2]));
    const fv = a[3] != null ? toNum(single(a[3])) : 0;
    let r = a[5] != null ? toNum(single(a[5])) : 0.1;
    for (let it = 0; it < 100; it++) {
      const p = Math.pow(1 + r, n);
      const f = pv * p + pmt * (p - 1) / r + fv;
      const dp = n * Math.pow(1 + r, n - 1);
      const df = pv * dp + pmt * (dp * r - (p - 1)) / (r * r);
      if (df === 0) throw new FormulaError(ERR.NUM);
      const next = r - f / df;
      if (Math.abs(next - r) < 1e-7) return next;
      r = next;
    }
    throw new FormulaError(ERR.NUM);
  },
};

// ---- helpers for *IF and lookup ----

function asMatrix(v: Val): CellValue[][] {
  return isArr(v) ? v : [[v as CellValue]];
}
function flatVals(v: Val): CellValue[] {
  return isArr(v) ? (v.flat() as CellValue[]) : [v as CellValue];
}

/** Excel-style criterion: ">10", "<>x", "apple", "*x*". */
function makeMatcher(crit: CellValue): (v: CellValue) => boolean {
  if (typeof crit === "number" || typeof crit === "boolean")
    return (v) => v === crit;
  const s = String(crit ?? "");
  const m = /^(<>|<=|>=|<|>|=)?(.*)$/.exec(s)!;
  const op = m[1] || "=";
  const rhs = m[2];
  const rhsNum = Number(rhs);
  const isNum = rhs !== "" && !isNaN(rhsNum);
  if (op === "=" || op === "<>") {
    if (rhs.includes("*") || rhs.includes("?")) {
      const re = new RegExp(
        "^" + rhs.replace(/[.+^${}()|[\]\\]/g, "\\$&").replace(/\*/g, ".*").replace(/\?/g, ".") + "$",
        "i",
      );
      return (v) => (op === "=" ? re.test(String(v ?? "")) : !re.test(String(v ?? "")));
    }
    if (isNum) return (v) => (op === "=" ? Number(v) === rhsNum : Number(v) !== rhsNum);
    return (v) =>
      op === "="
        ? String(v ?? "").toLowerCase() === rhs.toLowerCase()
        : String(v ?? "").toLowerCase() !== rhs.toLowerCase();
  }
  return (v) => {
    const n = Number(v);
    if (isNaN(n) || !isNum) return false;
    switch (op) {
      case "<": return n < rhsNum;
      case "<=": return n <= rhsNum;
      case ">": return n > rhsNum;
      case ">=": return n >= rhsNum;
    }
    return false;
  };
}

function countIf(range: Val, crit: Val): number {
  const m = makeMatcher(single(crit));
  return flatVals(range).filter(m).length;
}
function sumIf(range: Val, crit: Val, sumRange: Val): number {
  const m = makeMatcher(single(crit));
  const rs = flatVals(range);
  const ss = flatVals(sumRange);
  let s = 0;
  for (let i = 0; i < rs.length; i++) {
    if (m(rs[i])) {
      const n = Number(ss[i]);
      if (!isNaN(n)) s += n;
    }
  }
  return s;
}
function countIfs(args: Val[]): number {
  const pairs: Array<[CellValue[], (v: CellValue) => boolean]> = [];
  for (let i = 0; i < args.length; i += 2) {
    pairs.push([flatVals(args[i]), makeMatcher(single(args[i + 1]))]);
  }
  const len = pairs[0]?.[0].length ?? 0;
  let n = 0;
  for (let i = 0; i < len; i++) {
    if (pairs.every(([r, m]) => m(r[i]))) n++;
  }
  return n;
}
function sumIfs(args: Val[]): number {
  const sumR = flatVals(args[0]);
  const pairs: Array<[CellValue[], (v: CellValue) => boolean]> = [];
  for (let i = 1; i < args.length; i += 2) {
    pairs.push([flatVals(args[i]), makeMatcher(single(args[i + 1]))]);
  }
  let s = 0;
  for (let i = 0; i < sumR.length; i++) {
    if (pairs.every(([r, m]) => m(r[i]))) {
      const n = Number(sumR[i]);
      if (!isNaN(n)) s += n;
    }
  }
  return s;
}

function vlookup(a: Val[], dir: "v" | "h"): CellValue {
  const lookup = single(a[0]);
  const table = asMatrix(a[1]);
  const idx = toNum(single(a[2])) - 1;
  const exact = a[3] != null ? !toBool(single(a[3])) : false;
  if (dir === "v") {
    for (let r = 0; r < table.length; r++) {
      const v = table[r][0];
      if (exact ? v === lookup : v == lookup) return table[r][idx] ?? null;
    }
  } else {
    const head = table[0] ?? [];
    for (let c = 0; c < head.length; c++) {
      if (exact ? head[c] === lookup : head[c] == lookup) return table[idx]?.[c] ?? null;
    }
  }
  throw new FormulaError(ERR.NA);
}
