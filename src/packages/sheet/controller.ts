// Sheet store + commands.
import { createStore } from "../core/store";
import { createHistory } from "../core/history";
import {
  type WorkbookData,
  type SheetData,
  type Cell,
  type CellStyle,
  type CellValue,
  type BorderSides,
  type MergeRect,
  type DataValidation,
  type ChartSpec,
  type CondFormat,
  createWorkbook,
  createSheet,
  DEFAULT_COL_W,
  DEFAULT_ROW_H,
} from "./model";
import { a1, normalizeRange, type RangeRC } from "./address";
import { coerceInput } from "./format";
import { createEngine, type Engine, type WorkbookCtx } from "./formula/engine";
import { sortRange, recomputeHidden, type SortKey } from "./sortFilter";
import { mergeRange, unmergeRange } from "./merges";
import { type PersistAdapter } from "./persist";
import { findValidation, validate } from "./validation";

export interface SheetState {
  workbook: WorkbookData;
  selection: RangeRC; // active range
  /** Additional non-contiguous ranges (Ctrl+click selection). */
  extraSelections: RangeRC[];
  active: { row: number; col: number };
  editing: null | { row: number; col: number; draft: string };
}

export type Command =
  | { kind: "setCell"; row: number; col: number; raw: string }
  | { kind: "setRange"; range: RangeRC; values: string[][] }
  | { kind: "applyStyle"; range: RangeRC; style: Partial<CellStyle> }
  | { kind: "applyBorders"; range: RangeRC; borders: BorderSides; mode: "outside" | "all" | "clear" }
  | { kind: "clearRange"; range: RangeRC }
  | { kind: "setColWidth"; col: number; w: number }
  | { kind: "setRowHeight"; row: number; h: number }
  | { kind: "insertRow"; at: number }
  | { kind: "insertCol"; at: number }
  | { kind: "sort"; range: RangeRC; keys: SortKey[] }
  | { kind: "setFilter"; col: number; allowed: Set<string> | null }
  | { kind: "merge"; range: RangeRC }
  | { kind: "unmerge"; range: RangeRC }
  | { kind: "setFreeze"; rows: number; cols: number }
  | { kind: "addValidation"; v: DataValidation }
  | { kind: "removeValidation"; index: number }
  | { kind: "addChart"; chart: ChartSpec }
  | { kind: "updateChart"; id: string; patch: Partial<ChartSpec> }
  | { kind: "removeChart"; id: string }
  | { kind: "addCondFormat"; cf: CondFormat }
  | { kind: "removeCondFormat"; index: number }
  | { kind: "setComment"; row: number; col: number; text: string | null }
  | { kind: "setName"; name: string; ref: string | null };

export interface SheetController {
  store: ReturnType<typeof createStore<SheetState>>;
  history: ReturnType<typeof createHistory>;
  /** Engine for the active sheet */
  engine: Engine;
  exec: (cmd: Command, opts?: { coalesceTag?: string }) => void;
  setSelection: (sel: RangeRC, active?: { row: number; col: number }) => void;
  /** Add a non-contiguous selection range (Ctrl+click). */
  addSelection: (sel: RangeRC) => void;
  clearExtraSelections: () => void;
  /** Workbook-scoped named ranges. */
  listNames: () => { name: string; ref: string }[];
  beginEdit: (row: number, col: number, initial?: string) => void;
  updateDraft: (draft: string) => void;
  commitEdit: (next?: { dr: number; dc: number }) => void;
  cancelEdit: () => void;
  getActiveSheet: () => SheetData;
  colWidth: (c: number) => number;
  rowHeight: (r: number) => number;
  /** Display value (computed if formula, else literal) */
  getValue: (row: number, col: number) => CellValue;
  // Workbook ops
  addSheet: (name?: string) => void;
  removeSheet: (id: string) => void;
  renameSheet: (id: string, name: string) => void;
  setActiveSheet: (id: string) => void;
}

export interface SheetControllerOptions {
  persist?: PersistAdapter;
}

export function createSheetController(opts: SheetControllerOptions = {}): SheetController {
  const initialWb = opts.persist?.load() ?? createWorkbook();
  const store = createStore<SheetState>({
    workbook: initialWb,
    selection: { r1: 0, c1: 0, r2: 0, c2: 0 },
    extraSelections: [],
    active: { row: 0, col: 0 },
    editing: null,
  });
  const history = createHistory();
  // Build cross-sheet workbook context for the engines.
  const engines = new Map<string, Engine>();
  let notifyDepth = 0;
  const namesMap = new Map<string, string>();
  const refreshNames = () => {
    namesMap.clear();
    for (const n of initialWb.names ?? []) namesMap.set(n.name.toLowerCase(), n.ref);
  };
  refreshNames();
  const wbCtx: WorkbookCtx = {
    workbook: initialWb,
    names: namesMap,
    getEngine: (sheetName) => {
      const sh = initialWb.sheets.find((s) => s.name === sheetName);
      return sh ? engines.get(sh.id) : undefined;
    },
    notifyChange: (sheetName, _addr) => {
      if (notifyDepth > 0) return;
      notifyDepth++;
      try {
        for (const [sid, eng] of engines) {
          const sh = initialWb.sheets.find((s) => s.id === sid);
          if (!sh || sh.name === sheetName) continue;
          eng.recomputeAll();
        }
      } finally { notifyDepth--; }
    },
  };
  for (const s of initialWb.sheets) engines.set(s.id, createEngine(s, wbCtx));
  for (const e of engines.values()) e.recomputeAll();
  const getEngine = () => engines.get(store.get().workbook.activeSheetId)!;

  const touched = new Set<string>();
  const touch = (r: number, c: number) => touched.add(a1(r, c));
  const flushTouched = () => {
    const eng = getEngine();
    for (const addr of touched) eng.onCellChanged(addr);
    touched.clear();
  };

  const getValue = (row: number, col: number): CellValue => {
    const cell = getActiveSheet().cells.get(a1(row, col));
    if (cell?.f) {
      const r = getEngine().results.get(a1(row, col));
      return (r?.value ?? null) as CellValue;
    }
    return cell?.v ?? null;
  };

  const getActiveSheet = () => {
    const s = store.get();
    return s.workbook.sheets.find((x) => x.id === s.workbook.activeSheetId)!;
  };

  const colWidth = (c: number) =>
    getActiveSheet().cols.get(c)?.w ?? DEFAULT_COL_W;
  const rowHeight = (r: number) =>
    getActiveSheet().rows.get(r)?.h ?? DEFAULT_ROW_H;

  const cloneCell = (c: Cell | undefined): Cell | undefined =>
    c ? { ...c, s: c.s ? { ...c.s } : undefined } : undefined;

  // Apply a command in-place, returning an inverse for undo.
  function apply(cmd: Command): () => void {
    const sheet = getActiveSheet();
    switch (cmd.kind) {
      case "setCell": {
        const key = a1(cmd.row, cmd.col);
        const prev = cloneCell(sheet.cells.get(key));
        const isFormula = cmd.raw.startsWith("=");
        const cell: Cell = { ...(sheet.cells.get(key) ?? {}) };
        if (isFormula) {
          cell.f = cmd.raw.slice(1);
          cell.v = null;
        } else {
          delete cell.f;
          cell.v = coerceInput(cmd.raw);
        }
        // Strict data validation: reject invalid literal input.
        if (!isFormula) {
          const dv = findValidation(sheet, cmd.row, cmd.col);
          if (dv?.strict && !validate(dv.rule, cell.v ?? null)) {
            return () => {};
          }
        }
        if (cell.v === null && !cell.s && !cell.f) sheet.cells.delete(key);
        else sheet.cells.set(key, cell);
        touch(cmd.row, cmd.col);
        bump();
        return () => {
          if (prev) sheet.cells.set(key, prev);
          else sheet.cells.delete(key);
          touch(cmd.row, cmd.col);
          bump();
        };
      }
      case "setRange": {
        const n = normalizeRange(cmd.range);
        const prev = new Map<string, Cell | undefined>();
        for (let r = n.r1; r <= n.r2; r++) {
          for (let c = n.c1; c <= n.c2; c++) {
            const k = a1(r, c);
            prev.set(k, cloneCell(sheet.cells.get(k)));
            const raw = cmd.values[r - n.r1]?.[c - n.c1] ?? "";
            const cur = sheet.cells.get(k) ?? {};
            const next: Cell = { ...cur };
            if (raw.startsWith("=")) {
              next.f = raw.slice(1);
              next.v = null;
            } else {
              delete next.f;
              next.v = coerceInput(raw);
            }
            if (next.v === null && !next.s && !next.f) sheet.cells.delete(k);
            else sheet.cells.set(k, next);
            touch(r, c);
          }
        }
        bump();
        return () => {
          prev.forEach((v, k) => {
            if (v) sheet.cells.set(k, v);
            else sheet.cells.delete(k);
          });
          for (let r = n.r1; r <= n.r2; r++)
            for (let c = n.c1; c <= n.c2; c++) touch(r, c);
          bump();
        };
      }
      case "applyStyle": {
        const n = normalizeRange(cmd.range);
        const prev = new Map<string, Cell | undefined>();
        for (let r = n.r1; r <= n.r2; r++) {
          for (let c = n.c1; c <= n.c2; c++) {
            const k = a1(r, c);
            const cur = sheet.cells.get(k);
            prev.set(k, cloneCell(cur));
            const merged: CellStyle = { ...(cur?.s ?? {}), ...cmd.style };
            sheet.cells.set(k, { ...(cur ?? {}), s: merged });
          }
        }
        bump();
        return () => {
          prev.forEach((v, k) => {
            if (v) sheet.cells.set(k, v);
            else sheet.cells.delete(k);
          });
          bump();
        };
      }
      case "clearRange": {
        const n = normalizeRange(cmd.range);
        const prev = new Map<string, Cell | undefined>();
        for (let r = n.r1; r <= n.r2; r++) {
          for (let c = n.c1; c <= n.c2; c++) {
            const k = a1(r, c);
            prev.set(k, cloneCell(sheet.cells.get(k)));
            sheet.cells.delete(k);
            touch(r, c);
          }
        }
        bump();
        return () => {
          prev.forEach((v, k) => {
            if (v) sheet.cells.set(k, v);
          });
          for (let r = n.r1; r <= n.r2; r++)
            for (let c = n.c1; c <= n.c2; c++) touch(r, c);
          bump();
        };
      }
      case "setColWidth": {
        const prev = sheet.cols.get(cmd.col)?.w;
        sheet.cols.set(cmd.col, { w: cmd.w });
        bump();
        return () => {
          if (prev === undefined) sheet.cols.delete(cmd.col);
          else sheet.cols.set(cmd.col, { w: prev });
          bump();
        };
      }
      case "setRowHeight": {
        const prev = sheet.rows.get(cmd.row)?.h;
        sheet.rows.set(cmd.row, { h: cmd.h });
        bump();
        return () => {
          if (prev === undefined) sheet.rows.delete(cmd.row);
          else sheet.rows.set(cmd.row, { h: prev });
          bump();
        };
      }
      case "sort": {
        const inverse = sortRange(sheet, cmd.range, cmd.keys);
        // recompute every formula in the affected range
        const n = normalizeRange(cmd.range);
        for (let r = n.r1; r <= n.r2; r++)
          for (let c = n.c1; c <= n.c2; c++) touch(r, c);
        recomputeHidden(sheet);
        bump();
        return () => {
          inverse();
          for (let r = n.r1; r <= n.r2; r++)
            for (let c = n.c1; c <= n.c2; c++) touch(r, c);
          recomputeHidden(sheet);
          bump();
        };
      }
      case "setFilter": {
        const prev = sheet.filters.get(cmd.col) ?? null;
        if (cmd.allowed === null) sheet.filters.delete(cmd.col);
        else sheet.filters.set(cmd.col, cmd.allowed);
        recomputeHidden(sheet);
        bump();
        return () => {
          if (prev === null) sheet.filters.delete(cmd.col);
          else sheet.filters.set(cmd.col, prev);
          recomputeHidden(sheet);
          bump();
        };
      }
      case "merge": {
        const removed = mergeRange(sheet, cmd.range);
        bump();
        return () => {
          // remove the new merge we added (last one matching the range)
          const n = normalizeRange(cmd.range);
          sheet.merges = sheet.merges.filter(
            (m) => !(m.r1 === n.r1 && m.c1 === n.c1 && m.r2 === n.r2 && m.c2 === n.c2),
          );
          for (const m of removed) sheet.merges.push(m);
          bump();
        };
      }
      case "unmerge": {
        const removed = unmergeRange(sheet, cmd.range);
        bump();
        return () => {
          for (const m of removed) sheet.merges.push(m);
          bump();
        };
      }
      case "applyBorders": {
        const n = normalizeRange(cmd.range);
        const prev = new Map<string, Cell | undefined>();
        const setBorder = (r: number, c: number, sides: BorderSides) => {
          const k = a1(r, c);
          const cur = sheet.cells.get(k);
          if (!prev.has(k)) prev.set(k, cloneCell(cur));
          const base = cur ?? {};
          const curBorders = base.s?.borders ?? {};
          let nextBorders: BorderSides | undefined;
          if (cmd.mode === "clear") nextBorders = undefined;
          else nextBorders = { ...curBorders, ...sides };
          const newStyle: CellStyle = { ...(base.s ?? {}) };
          if (nextBorders === undefined || (
            !nextBorders.top && !nextBorders.right && !nextBorders.bottom && !nextBorders.left
          )) {
            delete newStyle.borders;
          } else {
            newStyle.borders = nextBorders;
          }
          sheet.cells.set(k, { ...base, s: newStyle });
        };
        if (cmd.mode === "all") {
          for (let r = n.r1; r <= n.r2; r++)
            for (let c = n.c1; c <= n.c2; c++)
              setBorder(r, c, { top: true, right: true, bottom: true, left: true });
        } else if (cmd.mode === "outside") {
          for (let r = n.r1; r <= n.r2; r++) {
            setBorder(r, n.c1, { left: true });
            setBorder(r, n.c2, { right: true });
          }
          for (let c = n.c1; c <= n.c2; c++) {
            setBorder(n.r1, c, { top: true });
            setBorder(n.r2, c, { bottom: true });
          }
        } else {
          for (let r = n.r1; r <= n.r2; r++)
            for (let c = n.c1; c <= n.c2; c++)
              setBorder(r, c, {});
        }
        bump();
        return () => {
          prev.forEach((v, k) => {
            if (v) sheet.cells.set(k, v);
            else sheet.cells.delete(k);
          });
          bump();
        };
      }
      case "setFreeze": {
        const pr = sheet.freezeRows; const pc = sheet.freezeCols;
        sheet.freezeRows = Math.max(0, cmd.rows);
        sheet.freezeCols = Math.max(0, cmd.cols);
        bump();
        return () => { sheet.freezeRows = pr; sheet.freezeCols = pc; bump(); };
      }
      case "addValidation": {
        sheet.validations.push(cmd.v);
        bump();
        return () => { sheet.validations.pop(); bump(); };
      }
      case "removeValidation": {
        const removed = sheet.validations.splice(cmd.index, 1)[0];
        bump();
        return () => {
          if (removed) sheet.validations.splice(cmd.index, 0, removed);
          bump();
        };
      }
      case "addChart": {
        sheet.charts.push(cmd.chart);
        bump();
        return () => { sheet.charts = sheet.charts.filter((c) => c.id !== cmd.chart.id); bump(); };
      }
      case "updateChart": {
        const idx = sheet.charts.findIndex((c) => c.id === cmd.id);
        if (idx < 0) return () => {};
        const prev = { ...sheet.charts[idx] };
        sheet.charts[idx] = { ...prev, ...cmd.patch };
        bump();
        return () => { sheet.charts[idx] = prev; bump(); };
      }
      case "removeChart": {
        const idx = sheet.charts.findIndex((c) => c.id === cmd.id);
        if (idx < 0) return () => {};
        const prev = sheet.charts[idx];
        sheet.charts.splice(idx, 1);
        bump();
        return () => { sheet.charts.splice(idx, 0, prev); bump(); };
      }
      case "addCondFormat": {
        sheet.condFormats.push(cmd.cf);
        bump();
        return () => { sheet.condFormats.pop(); bump(); };
      }
      case "removeCondFormat": {
        const removed = sheet.condFormats.splice(cmd.index, 1)[0];
        bump();
        return () => {
          if (removed) sheet.condFormats.splice(cmd.index, 0, removed);
          bump();
        };
      }
      case "setComment": {
        const k = a1(cmd.row, cmd.col);
        const cur = sheet.cells.get(k);
        const prev = cloneCell(cur);
        const next: Cell = { ...(cur ?? {}) };
        if (cmd.text == null || cmd.text === "") delete next.cm;
        else next.cm = cmd.text;
        if (next.v == null && !next.f && !next.s && !next.cm) sheet.cells.delete(k);
        else sheet.cells.set(k, next);
        bump();
        return () => {
          if (prev) sheet.cells.set(k, prev);
          else sheet.cells.delete(k);
          bump();
        };
      }
      case "setName": {
        const wb = store.get().workbook;
        const list = wb.names ?? (wb.names = []);
        const lower = cmd.name.toLowerCase();
        const idx = list.findIndex((n) => n.name.toLowerCase() === lower);
        const prev = idx >= 0 ? { ...list[idx] } : null;
        if (cmd.ref == null) {
          if (idx >= 0) list.splice(idx, 1);
        } else {
          if (idx >= 0) list[idx] = { name: cmd.name, ref: cmd.ref };
          else list.push({ name: cmd.name, ref: cmd.ref });
        }
        refreshNames();
        // Cross-sheet recompute
        for (const e of engines.values()) e.recomputeAll();
        bump();
        return () => {
          if (cmd.ref == null) {
            if (prev) list.splice(idx, 0, prev);
          } else if (prev) {
            list[idx] = prev;
          } else {
            const i2 = list.findIndex((n) => n.name.toLowerCase() === lower);
            if (i2 >= 0) list.splice(i2, 1);
          }
          refreshNames();
          for (const e of engines.values()) e.recomputeAll();
          bump();
        };
      }
      default:
        return () => {};
    }
  }

  // Force a store re-emit by replacing wb shallow.
  function bump() {
    store.set((s) => ({ ...s, workbook: { ...s.workbook } }));
  }

  function exec(cmd: Command, opts: { coalesceTag?: string } = {}) {
    const undo = apply(cmd);
    flushTouched();
    history.push({
      undo: () => { undo(); flushTouched(); },
      redo: () => { apply(cmd); flushTouched(); },
      tag: opts.coalesceTag,
    });
  }

  function setSelection(sel: RangeRC, active?: { row: number; col: number }) {
    store.set((s) => ({
      ...s,
      selection: sel,
      extraSelections: [],
      active: active ?? { row: sel.r1, col: sel.c1 },
    }));
  }
  function addSelection(sel: RangeRC) {
    store.set((s) => ({ ...s, extraSelections: [...s.extraSelections, sel] }));
  }
  function clearExtraSelections() {
    store.set((s) => ({ ...s, extraSelections: [] }));
  }
  function listNames() {
    return [...(store.get().workbook.names ?? [])];
  }

  function beginEdit(row: number, col: number, initial?: string) {
    const sheet = getActiveSheet();
    const cell = sheet.cells.get(a1(row, col));
    const draft =
      initial !== undefined
        ? initial
        : cell?.f
        ? "=" + cell.f
        : cell?.v == null
        ? ""
        : String(cell.v);
    store.set((s) => ({ ...s, editing: { row, col, draft } }));
  }

  function updateDraft(draft: string) {
    store.set((s) =>
      s.editing ? { ...s, editing: { ...s.editing, draft } } : s,
    );
  }

  function commitEdit(next?: { dr: number; dc: number }) {
    const s = store.get();
    if (!s.editing) return;
    const { row, col, draft } = s.editing;
    exec({ kind: "setCell", row, col, raw: draft });
    const sheet = getActiveSheet();
    let nr = row;
    let nc = col;
    if (next) {
      nr = Math.max(0, Math.min(sheet.numRows - 1, row + next.dr));
      nc = Math.max(0, Math.min(sheet.numCols - 1, col + next.dc));
    }
    store.set((st) => ({
      ...st,
      editing: null,
      active: { row: nr, col: nc },
      selection: { r1: nr, c1: nc, r2: nr, c2: nc },
    }));
  }

  function cancelEdit() {
    store.set((s) => ({ ...s, editing: null }));
  }

  function bumpWb() {
    store.set((s) => ({ ...s, workbook: { ...s.workbook, sheets: [...s.workbook.sheets] } }));
  }

  function addSheet(name?: string) {
    const wb = store.get().workbook;
    const n = name ?? `Sheet${wb.sheets.length + 1}`;
    const s = createSheet(n);
    wb.sheets.push(s);
    engines.set(s.id, createEngine(s, wbCtx));
    store.set((st) => ({
      ...st,
      workbook: { ...st.workbook, sheets: [...st.workbook.sheets], activeSheetId: s.id },
      selection: { r1: 0, c1: 0, r2: 0, c2: 0 },
      extraSelections: [],
      active: { row: 0, col: 0 },
      editing: null,
    }));
    history.clear();
  }

  function removeSheet(id: string) {
    const wb = store.get().workbook;
    if (wb.sheets.length <= 1) return;
    const idx = wb.sheets.findIndex((s) => s.id === id);
    if (idx < 0) return;
    wb.sheets.splice(idx, 1);
    engines.delete(id);
    const nextActive = wb.activeSheetId === id ? wb.sheets[Math.max(0, idx - 1)].id : wb.activeSheetId;
    store.set((st) => ({
      ...st,
      workbook: { ...st.workbook, sheets: [...st.workbook.sheets], activeSheetId: nextActive },
      selection: { r1: 0, c1: 0, r2: 0, c2: 0 },
      extraSelections: [],
      active: { row: 0, col: 0 },
      editing: null,
    }));
    history.clear();
  }

  function renameSheet(id: string, name: string) {
    const sh = store.get().workbook.sheets.find((s) => s.id === id);
    if (!sh) return;
    sh.name = name;
    bumpWb();
  }

  function setActiveSheet(id: string) {
    if (!engines.has(id)) return;
    store.set((st) => ({
      ...st,
      workbook: { ...st.workbook, activeSheetId: id },
      selection: { r1: 0, c1: 0, r2: 0, c2: 0 },
      extraSelections: [],
      active: { row: 0, col: 0 },
      editing: null,
    }));
    history.clear();
  }

  // Autosave
  if (opts.persist) {
    let t: ReturnType<typeof setTimeout> | null = null;
    let lastWb = store.get().workbook;
    store.subscribe(() => {
      const wb = store.get().workbook;
      if (wb === lastWb) return;
      lastWb = wb;
      if (t) clearTimeout(t);
      t = setTimeout(() => {
        opts.persist!.save(wb);
        t = null;
      }, 250);
    });
  }
  return {
    store,
    history,
    get engine() { return getEngine(); },
    exec,
    setSelection,
    addSelection,
    clearExtraSelections,
    listNames,
    beginEdit,
    updateDraft,
    commitEdit,
    cancelEdit,
    getActiveSheet,
    colWidth,
    rowHeight,
    getValue,
    addSheet,
    removeSheet,
    renameSheet,
    setActiveSheet,
  } as SheetController;
}
