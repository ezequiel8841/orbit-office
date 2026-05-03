// Evaluator + dependency graph + incremental recalc.
import type { SheetData, CellValue, WorkbookData } from "../model";
import { a1, parseA1 } from "../address";
import { lex } from "./lex";
import { parse, type Node, ParseError } from "./parse";
import { FUNCS, FormulaError, ERR, type Val } from "./funcs";

export interface ComputedCell {
  value: CellValue | string;
  error?: string;
}

export interface Engine {
  recomputeAll: () => void;
  recomputeCell: (addr: string) => void;
  onCellChanged: (addr: string) => void;
  results: Map<string, ComputedCell>;
}

interface ParsedEntry {
  ast: Node;
  /** External keys: "SheetName!ADDR" */
  deps: Set<string>;
}

/** Optional cross-sheet workbook context. When provided, formulas may reference
 *  other sheets and named ranges. */
export interface WorkbookCtx {
  workbook: WorkbookData;
  /** key: name (case-insensitive) → "SheetName!A1:B2" or "SheetName!A1" */
  names: Map<string, string>;
  /** Get the engine for a sheet by name (so its computed results feed refs). */
  getEngine: (sheetName: string) => Engine | undefined;
  /** Notify cross-sheet dependents when a sheet's cell changed. */
  notifyChange: (sheetName: string, addr: string) => void;
}

export function createEngine(sheet: SheetData, ctx?: WorkbookCtx): Engine {
  const parsed = new Map<string, ParsedEntry>();
  // Local dependents map: external key → Set<localAddr>
  const localDependents = new Map<string, Set<string>>();
  const results = new Map<string, ComputedCell>();
  const computing = new Set<string>();

  const selfName = sheet.name;
  const extKey = (sheetName: string | undefined, addr: string) =>
    (sheetName ?? selfName) + "!" + addr;

  function resolveName(name: string): { sheet?: string; from: string; to?: string } | null {
    if (!ctx) return null;
    const ref = ctx.names.get(name.toLowerCase());
    if (!ref) return null;
    const i = ref.indexOf("!");
    const sheetName = i > 0 ? ref.slice(0, i) : undefined;
    const rest = i > 0 ? ref.slice(i + 1) : ref;
    if (rest.includes(":")) {
      const [a, b] = rest.split(":");
      return { sheet: sheetName, from: a.toUpperCase(), to: b.toUpperCase() };
    }
    return { sheet: sheetName, from: rest.toUpperCase() };
  }

  function collectDeps(node: Node, out: Set<string>) {
    switch (node.t) {
      case "ref": out.add(extKey(node.sheet, node.addr)); return;
      case "range": {
        const a = parseA1(node.from);
        const b = parseA1(node.to);
        if (!a || !b) return;
        const r1 = Math.min(a.row, b.row), r2 = Math.max(a.row, b.row);
        const c1 = Math.min(a.col, b.col), c2 = Math.max(a.col, b.col);
        for (let r = r1; r <= r2; r++)
          for (let c = c1; c <= c2; c++)
            out.add(extKey(node.sheet, a1(r, c)));
        return;
      }
      case "name": {
        const r = resolveName(node.name);
        if (!r) return;
        if (r.to) {
          const a = parseA1(r.from);
          const b = parseA1(r.to);
          if (!a || !b) return;
          const r1 = Math.min(a.row, b.row), r2 = Math.max(a.row, b.row);
          const c1 = Math.min(a.col, b.col), c2 = Math.max(a.col, b.col);
          for (let rr = r1; rr <= r2; rr++)
            for (let cc = c1; cc <= c2; cc++)
              out.add(extKey(r.sheet, a1(rr, cc)));
        } else out.add(extKey(r.sheet, r.from));
        return;
      }
      case "call": for (const ar of node.args) collectDeps(ar, out); return;
      case "unary": collectDeps(node.rhs, out); return;
      case "postfix": collectDeps(node.lhs, out); return;
      case "binary": collectDeps(node.lhs, out); collectDeps(node.rhs, out); return;
    }
  }

  function unregister(addr: string) {
    const prev = parsed.get(addr);
    if (!prev) return;
    for (const dep of prev.deps) {
      const set = localDependents.get(dep);
      if (set) {
        set.delete(addr);
        if (set.size === 0) localDependents.delete(dep);
      }
    }
    parsed.delete(addr);
  }

  function register(addr: string, formula: string) {
    try {
      const ast = parse(lex(formula));
      const deps = new Set<string>();
      collectDeps(ast, deps);
      parsed.set(addr, { ast, deps });
      for (const dep of deps) {
        let set = localDependents.get(dep);
        if (!set) localDependents.set(dep, (set = new Set()));
        set.add(addr);
      }
    } catch (e) {
      const err = e instanceof ParseError ? ERR.NAME : ERR.VALUE;
      results.set(addr, { value: err, error: err });
    }
  }

  function rawValue(sheetName: string | undefined, addr: string): CellValue {
    const sn = sheetName ?? selfName;
    if (sn === selfName) {
      const computed = results.get(addr);
      if (computed) {
        if (computed.error) throw new FormulaError(computed.error);
        return computed.value as CellValue;
      }
      const cell = sheet.cells.get(addr);
      return cell?.v ?? null;
    }
    if (!ctx) throw new FormulaError(ERR.REF);
    const otherSheet = ctx.workbook.sheets.find((s) => s.name === sn);
    if (!otherSheet) throw new FormulaError(ERR.REF);
    const otherEngine = ctx.getEngine(sn);
    const computed = otherEngine?.results.get(addr);
    if (computed) {
      if (computed.error) throw new FormulaError(computed.error);
      return computed.value as CellValue;
    }
    const cell = otherSheet.cells.get(addr);
    return cell?.v ?? null;
  }

  function evalNode(node: Node): Val {
    switch (node.t) {
      case "num": return node.v;
      case "str": return node.v;
      case "bool": return node.v;
      case "ref": return rawValue(node.sheet, node.addr);
      case "name": {
        const r = resolveName(node.name);
        if (!r) throw new FormulaError(ERR.NAME);
        if (!r.to) return rawValue(r.sheet, r.from);
        const a = parseA1(r.from); const b = parseA1(r.to);
        if (!a || !b) throw new FormulaError(ERR.REF);
        const r1 = Math.min(a.row, b.row), r2 = Math.max(a.row, b.row);
        const c1 = Math.min(a.col, b.col), c2 = Math.max(a.col, b.col);
        const out: CellValue[][] = [];
        for (let rr = r1; rr <= r2; rr++) {
          const row: CellValue[] = [];
          for (let cc = c1; cc <= c2; cc++) row.push(rawValue(r.sheet, a1(rr, cc)));
          out.push(row);
        }
        return out;
      }
      case "range": {
        const a = parseA1(node.from);
        const b = parseA1(node.to);
        if (!a || !b) throw new FormulaError(ERR.REF);
        const r1 = Math.min(a.row, b.row), r2 = Math.max(a.row, b.row);
        const c1 = Math.min(a.col, b.col), c2 = Math.max(a.col, b.col);
        const out: CellValue[][] = [];
        for (let r = r1; r <= r2; r++) {
          const row: CellValue[] = [];
          for (let c = c1; c <= c2; c++) row.push(rawValue(node.sheet, a1(r, c)));
          out.push(row);
        }
        return out;
      }
      case "unary": {
        const v = num(evalNode(node.rhs));
        return node.op === "-" ? -v : v;
      }
      case "postfix": {
        const v = num(evalNode(node.lhs));
        return v / 100;
      }
      case "binary": {
        const op = node.op;
        if (op === "&") return str(evalNode(node.lhs)) + str(evalNode(node.rhs));
        const lv = evalNode(node.lhs);
        const rv = evalNode(node.rhs);
        if (op === "=" || op === "<>" || op === "<" || op === ">" || op === "<=" || op === ">=") {
          const a = single(lv), b = single(rv);
          const cmp = compare(a, b);
          switch (op) {
            case "=": return a === b || (typeof a === "number" && typeof b === "number" && a === b);
            case "<>": return !(a === b);
            case "<": return cmp < 0;
            case ">": return cmp > 0;
            case "<=": return cmp <= 0;
            case ">=": return cmp >= 0;
          }
        }
        const a = num(lv);
        const b = num(rv);
        switch (op) {
          case "+": return a + b;
          case "-": return a - b;
          case "*": return a * b;
          case "/":
            if (b === 0) throw new FormulaError(ERR.DIV0);
            return a / b;
          case "^": return Math.pow(a, b);
        }
        throw new FormulaError(ERR.VALUE);
      }
      case "call": {
        const name = node.name;
        if (name === "IFERROR") {
          try { return single(evalNode(node.args[0])); }
          catch { return node.args[1] != null ? single(evalNode(node.args[1])) : ""; }
        }
        if (name === "ISERROR") {
          try { evalNode(node.args[0]); return false; } catch { return true; }
        }
        if (name === "ISNA") {
          try { evalNode(node.args[0]); return false; }
          catch (e) { return e instanceof FormulaError && e.code === ERR.NA; }
        }
        if (name === "IF") {
          const c = toBool(single(evalNode(node.args[0])));
          if (c) return single(evalNode(node.args[1]));
          return node.args[2] != null ? single(evalNode(node.args[2])) : false;
        }
        const fn = FUNCS[name];
        if (!fn) throw new FormulaError(ERR.NAME);
        const args = node.args.map(evalNode);
        return fn(args) ?? null;
      }
    }
  }

  function num(v: Val): number {
    const s = single(v);
    if (typeof s === "number") return s;
    if (typeof s === "boolean") return s ? 1 : 0;
    if (s == null || s === "") return 0;
    const n = Number(s);
    if (isNaN(n)) throw new FormulaError(ERR.VALUE);
    return n;
  }
  function str(v: Val): string {
    const s = single(v);
    return s == null ? "" : String(s);
  }
  function single(v: Val): CellValue {
    return Array.isArray(v) ? v[0]?.[0] ?? null : v;
  }
  function toBool(v: CellValue): boolean {
    if (typeof v === "boolean") return v;
    if (typeof v === "number") return v !== 0;
    if (v == null || v === "") return false;
    const s = String(v).toUpperCase();
    return s === "TRUE";
  }
  function compare(a: CellValue, b: CellValue): number {
    if (typeof a === "number" && typeof b === "number") return a - b;
    return String(a ?? "").localeCompare(String(b ?? ""));
  }

  function computeCell(addr: string) {
    const entry = parsed.get(addr);
    if (!entry) return;
    if (computing.has(addr)) {
      results.set(addr, { value: ERR.CIRC, error: ERR.CIRC });
      return;
    }
    computing.add(addr);
    try {
      const v = evalNode(entry.ast);
      const single = Array.isArray(v) ? v[0]?.[0] ?? null : v;
      results.set(addr, { value: single });
    } catch (e) {
      const code = e instanceof FormulaError ? e.code : ERR.VALUE;
      results.set(addr, { value: code, error: code });
    } finally {
      computing.delete(addr);
    }
  }

  function recomputeAll() {
    parsed.clear();
    localDependents.clear();
    results.clear();
    sheet.cells.forEach((cell, addr) => {
      if (cell.f) register(addr, cell.f);
    });
    const visited = new Set<string>();
    const visit = (addr: string) => {
      if (visited.has(addr)) return;
      visited.add(addr);
      const entry = parsed.get(addr);
      if (entry) {
        for (const d of entry.deps) {
          // only revisit local deps
          if (d.startsWith(selfName + "!")) {
            const local = d.slice(selfName.length + 1);
            if (parsed.has(local)) visit(local);
          }
        }
        computeCell(addr);
      }
    };
    parsed.forEach((_, addr) => visit(addr));
    // Notify cross-sheet listeners that all our cells "changed"
    if (ctx) {
      results.forEach((_, addr) => ctx.notifyChange(selfName, addr));
    }
  }

  function recomputeCell(addr: string) {
    const order: string[] = [];
    const seen = new Set<string>();
    const stack = [addr];
    while (stack.length) {
      const a = stack.pop()!;
      if (seen.has(a)) continue;
      seen.add(a);
      order.push(a);
      const ds = localDependents.get(extKey(undefined, a));
      if (ds) ds.forEach((d) => stack.push(d));
    }
    const visited = new Set<string>();
    const visit = (a: string) => {
      if (visited.has(a)) return;
      visited.add(a);
      const entry = parsed.get(a);
      if (entry) {
        for (const d of entry.deps) {
          if (d.startsWith(selfName + "!")) {
            const local = d.slice(selfName.length + 1);
            if (parsed.has(local)) visit(local);
          }
        }
        computeCell(a);
      }
    };
    for (const a of order) visit(a);
    // Notify cross-sheet dependents
    if (ctx) for (const a of order) ctx.notifyChange(selfName, a);
  }

  function onCellChanged(addr: string) {
    unregister(addr);
    const cell = sheet.cells.get(addr);
    if (cell?.f) register(addr, cell.f);
    else results.delete(addr);
    recomputeCell(addr);
  }

  return { recomputeAll, recomputeCell, onCellChanged, results };
}
