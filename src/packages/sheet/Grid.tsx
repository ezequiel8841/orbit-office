import { useEffect, useLayoutEffect, useRef, useState } from "react";
import {
  ContextMenu,
  ContextMenuContent,
  ContextMenuItem,
  ContextMenuSeparator,
  ContextMenuTrigger,
} from "../../components/ui/context-menu";
import { useStore } from "../core/store";
import { rafThrottle } from "../core/utils";
import {
  type SheetController,
} from "./controller";
import { buildAxes } from "./axis";
import {
  HEADER_H,
  HEADER_W,
} from "./model";
import {
  a1,
  colToLetters,
  inRange,
  normalizeRange,
  type RangeRC,
} from "./address";
import { defaultAlign, formatCell } from "./format";
import { parseDelimited, writeDelimited } from "./csv";
import { fillSeries } from "./series";
import { findMergeAt, isMergeAnchor } from "./merges";
import { findValidation } from "./validation";
import { evalCondFormat } from "./condFormat";
import { ChartView, extractSeries } from "./Chart";
import { DEFAULT_COL_W, DEFAULT_ROW_H } from "./model";

interface GridProps {
  ctrl: SheetController;
}

export function Grid({ ctrl }: GridProps) {
  const state = useStore(ctrl.store);
  const scrollRef = useRef<HTMLDivElement>(null);
  const [scroll, setScroll] = useState({ top: 0, left: 0 });
  const [viewport, setViewport] = useState({ w: 0, h: 0 });
  // Active drag for column/row resize or fill handle
  const [drag, setDrag] = useState<
    | null
    | { kind: "col"; index: number; startX: number; startW: number; w: number }
    | { kind: "row"; index: number; startY: number; startH: number; h: number }
    | { kind: "fill"; preview: RangeRC | null }
    | { kind: "chart"; id: string; startX: number; startY: number; ox: number; oy: number; x: number; y: number }
  >(null);

  const sheet = ctrl.getActiveSheet();
  // rebuild axes whenever workbook changes (cheap for our sizes)
  const axes = buildAxes(sheet);

  // Track viewport size
  useLayoutEffect(() => {
    const el = scrollRef.current;
    if (!el) return;
    const update = () =>
      setViewport({ w: el.clientWidth, h: el.clientHeight });
    update();
    const ro = new ResizeObserver(update);
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  // Scroll handler (rAF-throttled)
  // Refocus grid when editing ends so keyboard nav/typing keeps working
  useEffect(() => {
    if (!state.editing) {
      const el = scrollRef.current;
      if (el && !el.contains(document.activeElement)) {
        el.focus({ preventScroll: true });
      }
    }
  }, [state.editing]);

  useEffect(() => {
    const el = scrollRef.current;
    if (!el) return;
    const onScroll = rafThrottle(() => {
      setScroll({ top: el.scrollTop, left: el.scrollLeft });
    });
    el.addEventListener("scroll", onScroll, { passive: true });
    return () => el.removeEventListener("scroll", onScroll);
  }, []);

  // Global mousemove/up for resize + fill drags
  useEffect(() => {
    if (!drag) return;
    const onMove = (e: MouseEvent) => {
      if (drag.kind === "col") {
        const w = Math.max(24, drag.startW + (e.clientX - drag.startX));
        setDrag({ ...drag, w });
      } else if (drag.kind === "row") {
        const h = Math.max(16, drag.startH + (e.clientY - drag.startY));
        setDrag({ ...drag, h });
      } else if (drag.kind === "fill") {
        const cell = cellAtPoint(e.clientX, e.clientY);
        if (!cell) return;
        const sel = normalizeRange(state.selection);
        // constrain to one direction
        const dRow = cell.row < sel.r1 ? sel.r1 - cell.row : cell.row > sel.r2 ? cell.row - sel.r2 : 0;
        const dCol = cell.col < sel.c1 ? sel.c1 - cell.col : cell.col > sel.c2 ? cell.col - sel.c2 : 0;
        let preview: RangeRC = sel;
        if (dRow >= dCol) {
          // vertical
          if (cell.row < sel.r1) preview = { ...sel, r1: cell.row };
          else if (cell.row > sel.r2) preview = { ...sel, r2: cell.row };
        } else {
          if (cell.col < sel.c1) preview = { ...sel, c1: cell.col };
          else if (cell.col > sel.c2) preview = { ...sel, c2: cell.col };
        }
        setDrag({ kind: "fill", preview });
      } else if (drag.kind === "chart") {
        const x = Math.max(0, drag.ox + (e.clientX - drag.startX));
        const y = Math.max(0, drag.oy + (e.clientY - drag.startY));
        setDrag({ ...drag, x, y });
      }
    };
    const onUp = () => {
      if (drag.kind === "col") {
        ctrl.exec({ kind: "setColWidth", col: drag.index, w: drag.w });
      } else if (drag.kind === "row") {
        ctrl.exec({ kind: "setRowHeight", row: drag.index, h: drag.h });
      } else if (drag.kind === "fill" && drag.preview) {
        applyFill(drag.preview);
      } else if (drag.kind === "chart") {
        ctrl.exec({ kind: "updateChart", id: drag.id, patch: { x: drag.x, y: drag.y } });
      }
      setDrag(null);
    };
    window.addEventListener("mousemove", onMove);
    window.addEventListener("mouseup", onUp);
    return () => {
      window.removeEventListener("mousemove", onMove);
      window.removeEventListener("mouseup", onUp);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [drag]);

  function applyFill(target: RangeRC) {
    const sel = normalizeRange(state.selection);
    const sh = ctrl.getActiveSheet();
    const readVal = (r: number, c: number): import("./model").CellValue => {
      const cell = sh.cells.get(a1(r, c));
      // For fill we use the literal value or formula text
      if (cell?.f) return "=" + cell.f;
      return cell?.v ?? null;
    };
    const writeMatrix: string[][] = [];
    // Vertical fill
    if (target.r1 < sel.r1 || target.r2 > sel.r2) {
      const fullR1 = Math.min(target.r1, sel.r1);
      const fullR2 = Math.max(target.r2, sel.r2);
      for (let r = fullR1; r <= fullR2; r++) writeMatrix.push([]);
      for (let c = sel.c1; c <= sel.c2; c++) {
        const source: import("./model").CellValue[] = [];
        for (let r = sel.r1; r <= sel.r2; r++) source.push(readVal(r, c));
        // upward fill: reverse, generate, reverse back
        if (target.r1 < sel.r1) {
          const upLen = sel.r1 - target.r1;
          const generated = fillSeries([...source].reverse(), upLen).reverse();
          for (let i = 0; i < upLen; i++) {
            writeMatrix[i].push(toRaw(generated[i]));
          }
        } else {
          for (let i = 0; i < sel.r1 - fullR1; i++) writeMatrix[i].push(toRaw(readVal(fullR1 + i, c)));
        }
        // selection itself (unchanged)
        for (let r = sel.r1; r <= sel.r2; r++) {
          writeMatrix[r - fullR1].push(toRaw(readVal(r, c)));
        }
        // downward fill
        if (target.r2 > sel.r2) {
          const downLen = target.r2 - sel.r2;
          const generated = fillSeries(source, downLen);
          for (let i = 0; i < downLen; i++) {
            writeMatrix[sel.r2 + 1 - fullR1 + i].push(toRaw(generated[i]));
          }
        }
      }
      ctrl.exec({
        kind: "setRange",
        range: { r1: fullR1, c1: sel.c1, r2: fullR2, c2: sel.c2 },
        values: writeMatrix,
      });
      ctrl.setSelection({ r1: Math.min(target.r1, sel.r1), c1: sel.c1, r2: Math.max(target.r2, sel.r2), c2: sel.c2 });
      return;
    }
    // Horizontal fill
    if (target.c1 < sel.c1 || target.c2 > sel.c2) {
      const fullC1 = Math.min(target.c1, sel.c1);
      const fullC2 = Math.max(target.c2, sel.c2);
      for (let r = sel.r1; r <= sel.r2; r++) {
        const row: string[] = [];
        const source: import("./model").CellValue[] = [];
        for (let c = sel.c1; c <= sel.c2; c++) source.push(readVal(r, c));
        if (target.c1 < sel.c1) {
          const len = sel.c1 - target.c1;
          const gen = fillSeries([...source].reverse(), len).reverse();
          for (let i = 0; i < len; i++) row.push(toRaw(gen[i]));
        }
        for (let c = sel.c1; c <= sel.c2; c++) row.push(toRaw(readVal(r, c)));
        if (target.c2 > sel.c2) {
          const len = target.c2 - sel.c2;
          const gen = fillSeries(source, len);
          for (let i = 0; i < len; i++) row.push(toRaw(gen[i]));
        }
        writeMatrix.push(row);
      }
      ctrl.exec({
        kind: "setRange",
        range: { r1: sel.r1, c1: fullC1, r2: sel.r2, c2: fullC2 },
        values: writeMatrix,
      });
      ctrl.setSelection({ r1: sel.r1, c1: Math.min(target.c1, sel.c1), r2: sel.r2, c2: Math.max(target.c2, sel.c2) });
    }
  }
  function toRaw(v: import("./model").CellValue): string {
    if (v == null) return "";
    return String(v);
  }
  const totalW = HEADER_W + axes.cols.total();
  const totalH = HEADER_H + axes.rows.total();

  const bodyW = Math.max(0, viewport.w - HEADER_W);
  const bodyH = Math.max(0, viewport.h - HEADER_H);
  const [c1, c2] = axes.cols.rangeFor(scroll.left, bodyW);
  const [r1, r2] = axes.rows.rangeFor(scroll.top, bodyH);

  // ----- mouse selection -----
  const dragRef = useRef<{ row: number; col: number } | null>(null);
  const editorRef = useRef<HTMLInputElement>(null);
  const ctxTargetRef = useRef<{ row: number; col: number; kind: "cell" | "rowHeader" | "colHeader" } | null>(null);
  // Internal clipboard stores both formula text and computed values for Paste Special
  const internalClipRef = useRef<{ raw: string[][]; computed: string[][] } | null>(null);
  const [pasteSpecialOpen, setPasteSpecialOpen] = useState(false);
  const pickRef = useRef<null | {
    anchor: { row: number; col: number };
    prefix: string;
    suffix: string;
  }>(null);
  const cellAtPoint = (clientX: number, clientY: number) => {
    const el = scrollRef.current;
    if (!el) return null;
    const rect = el.getBoundingClientRect();
    const x = clientX - rect.left + el.scrollLeft - HEADER_W;
    const y = clientY - rect.top + el.scrollTop - HEADER_H;
    if (x < 0 || y < 0) return null;
    return { row: axes.rows.indexAt(y), col: axes.cols.indexAt(x) };
  };

  function pickContext(): null | { prefix: string; suffix: string } {
    if (!state.editing) return null;
    const draft = state.editing.draft;
    if (!draft.startsWith("=")) return null;
    const inp = editorRef.current;
    const pos = inp?.selectionStart ?? draft.length;
    let before = draft.slice(0, pos);
    const after = draft.slice(pos);
    const refRe = /(\$?[A-Za-z]+\$?\d+(?::\$?[A-Za-z]+\$?\d+)?)$/;
    const m = before.match(refRe);
    if (m) {
      before = before.slice(0, before.length - m[1].length);
      return { prefix: before, suffix: after };
    }
    const trimmed = before.replace(/\s+$/, "");
    if (trimmed === "" || trimmed === "=") return { prefix: before, suffix: after };
    const ch = trimmed[trimmed.length - 1];
    if ("=+-*/^,(<>:;& ".includes(ch)) return { prefix: before, suffix: after };
    return null;
  }

  function refFor(r1: number, c1: number, r2: number, c2: number): string {
    const a = `${colToLetters(c1)}${r1 + 1}`;
    if (r1 === r2 && c1 === c2) return a;
    return `${a}:${colToLetters(c2)}${r2 + 1}`;
  }

  function onMouseDown(e: React.MouseEvent) {
    if (state.editing) {
      const ctx = pickContext();
      if (ctx) {
        const cell = cellAtPoint(e.clientX, e.clientY);
        if (!cell) return;
        e.preventDefault();
        pickRef.current = { anchor: cell, prefix: ctx.prefix, suffix: ctx.suffix };
        const ref = refFor(cell.row, cell.col, cell.row, cell.col);
        ctrl.updateDraft(ctx.prefix + ref + ctx.suffix);
        return;
      }
    }
    if (state.editing) ctrl.commitEdit();
    const cell = cellAtPoint(e.clientX, e.clientY);
    if (!cell) return;
    dragRef.current = cell;
    ctrl.setSelection(
      { r1: cell.row, c1: cell.col, r2: cell.row, c2: cell.col },
      cell,
    );
  }
  function onMouseMove(e: React.MouseEvent) {
    if (pickRef.current && e.buttons === 1) {
      const cell = cellAtPoint(e.clientX, e.clientY);
      if (!cell) return;
      e.preventDefault();
      const a = pickRef.current.anchor;
      const r1 = Math.min(a.row, cell.row),
        r2 = Math.max(a.row, cell.row);
      const c1 = Math.min(a.col, cell.col),
        c2 = Math.max(a.col, cell.col);
      const ref = refFor(r1, c1, r2, c2);
      ctrl.updateDraft(pickRef.current.prefix + ref + pickRef.current.suffix);
      return;
    }
    if (!dragRef.current || e.buttons !== 1) return;
    const cell = cellAtPoint(e.clientX, e.clientY);
    if (!cell) return;
    const a = dragRef.current;
    ctrl.setSelection(
      { r1: a.row, c1: a.col, r2: cell.row, c2: cell.col },
      a,
    );
  }
  function onMouseUp() {
    dragRef.current = null;
    if (pickRef.current) {
      // Restore focus + caret to end of the inserted reference
      const inp = editorRef.current;
      if (inp) {
        const draft = state.editing?.draft ?? "";
        const caret = draft.length - pickRef.current.suffix.length;
        requestAnimationFrame(() => {
          inp.focus();
          try {
            inp.setSelectionRange(caret, caret);
          } catch {}
        });
      }
    }
  }
  function onDoubleClick(e: React.MouseEvent) {
    const cell = cellAtPoint(e.clientX, e.clientY);
    if (!cell) return;
    ctrl.beginEdit(cell.row, cell.col);
  }

  // ----- keyboard -----
  function onKeyDown(e: React.KeyboardEvent) {
    if (state.editing) return; // editor handles its own keys
    const { active } = state;
    const sh = ctrl.getActiveSheet();
    const move = (dr: number, dc: number, extend = false) => {
      const nr = Math.max(0, Math.min(sh.numRows - 1, active.row + dr));
      const nc = Math.max(0, Math.min(sh.numCols - 1, active.col + dc));
      if (extend) {
        ctrl.setSelection(
          { r1: state.selection.r1, c1: state.selection.c1, r2: nr, c2: nc },
          { row: state.selection.r1, col: state.selection.c1 },
        );
      } else {
        ctrl.setSelection({ r1: nr, c1: nc, r2: nr, c2: nc }, { row: nr, col: nc });
      }
      e.preventDefault();
      ensureVisible(nr, nc);
    };
    const meta = e.ctrlKey || e.metaKey;
    if (meta && e.key.toLowerCase() === "z") {
      e.preventDefault();
      e.shiftKey ? ctrl.history.redo() : ctrl.history.undo();
      ctrl.store.set((s) => ({ ...s }));
      return;
    }
    if (meta && e.key.toLowerCase() === "y") {
      e.preventDefault();
      ctrl.history.redo();
      ctrl.store.set((s) => ({ ...s }));
      return;
    }
    if (meta && e.key.toLowerCase() === "b") {
      e.preventDefault();
      const cur = sh.cells.get(a1(active.row, active.col))?.s?.bold;
      ctrl.exec({
        kind: "applyStyle",
        range: state.selection,
        style: { bold: !cur },
      });
      return;
    }
    if (meta && e.key.toLowerCase() === "i") {
      e.preventDefault();
      const cur = sh.cells.get(a1(active.row, active.col))?.s?.italic;
      ctrl.exec({
        kind: "applyStyle",
        range: state.selection,
        style: { italic: !cur },
      });
      return;
    }
    if (meta && e.key.toLowerCase() === "c") {
      copySelection();
      return;
    }
    if (meta && e.key.toLowerCase() === "x") {
      copySelection();
      ctrl.exec({ kind: "clearRange", range: state.selection });
      return;
    }
    if (meta && e.key.toLowerCase() === "v") {
      if (e.shiftKey) {
        e.preventDefault();
        setPasteSpecialOpen(true);
      }
      // plain paste handled by paste event
      return;
    }
    switch (e.key) {
      case "ArrowUp": return move(-1, 0, e.shiftKey);
      case "ArrowDown": return move(1, 0, e.shiftKey);
      case "ArrowLeft": return move(0, -1, e.shiftKey);
      case "ArrowRight": return move(0, 1, e.shiftKey);
      case "Tab":
        e.preventDefault();
        return move(0, e.shiftKey ? -1 : 1);
      case "Enter":
        e.preventDefault();
        return move(e.shiftKey ? -1 : 1, 0);
      case "Delete":
      case "Backspace":
        e.preventDefault();
        ctrl.exec({ kind: "clearRange", range: state.selection });
        return;
      case "F2":
        e.preventDefault();
        ctrl.beginEdit(active.row, active.col);
        return;
      case "Escape":
        return;
    }
    // printable char starts editing
    if (e.key.length === 1 && !meta && !e.altKey) {
      ctrl.beginEdit(active.row, active.col, e.key);
      e.preventDefault();
    }
  }

  function onContextMenu(e: React.MouseEvent) {
    const el = scrollRef.current;
    if (!el) return;
    const rect = el.getBoundingClientRect();
    const x = e.clientX - rect.left + el.scrollLeft;
    const y = e.clientY - rect.top + el.scrollTop;
    if (x < HEADER_W && y < HEADER_H) return;
    if (x < HEADER_W) {
      const row = axes.rows.indexAt(y - HEADER_H);
      ctxTargetRef.current = { row, col: state.active.col, kind: "rowHeader" };
      ctrl.setSelection({ r1: row, c1: 0, r2: row, c2: sheet.numCols - 1 }, { row, col: 0 });
    } else if (y < HEADER_H) {
      const col = axes.cols.indexAt(x - HEADER_W);
      ctxTargetRef.current = { row: state.active.row, col, kind: "colHeader" };
      ctrl.setSelection({ r1: 0, c1: col, r2: sheet.numRows - 1, c2: col }, { row: 0, col });
    } else {
      const row = axes.rows.indexAt(y - HEADER_H);
      const col = axes.cols.indexAt(x - HEADER_W);
      ctxTargetRef.current = { row, col, kind: "cell" };
      if (!inRange(normalizeRange(state.selection), row, col)) {
        ctrl.setSelection({ r1: row, c1: col, r2: row, c2: col }, { row, col });
      }
    }
  }

  function ensureVisible(row: number, col: number) {
    const el = scrollRef.current;
    if (!el) return;
    const x = axes.cols.offsetOf(col);
    const w = axes.cols.sizeOf(col);
    const y = axes.rows.offsetOf(row);
    const h = axes.rows.sizeOf(row);
    const vw = el.clientWidth - HEADER_W;
    const vh = el.clientHeight - HEADER_H;
    if (x < el.scrollLeft) el.scrollLeft = x;
    else if (x + w > el.scrollLeft + vw) el.scrollLeft = x + w - vw;
    if (y < el.scrollTop) el.scrollTop = y;
    else if (y + h > el.scrollTop + vh) el.scrollTop = y + h - vh;
  }

  // ----- clipboard -----
  function selectionToMatrix(): string[][] {
    const n = normalizeRange(state.selection);
    const out: string[][] = [];
    for (let r = n.r1; r <= n.r2; r++) {
      const row: string[] = [];
      for (let c = n.c1; c <= n.c2; c++) {
        const cell = sheet.cells.get(a1(r, c));
        row.push(cell?.f ? "=" + cell.f : cell?.v == null ? "" : String(cell.v));
      }
      out.push(row);
    }
    return out;
  }

  function selectionToComputedMatrix(): string[][] {
    const n = normalizeRange(state.selection);
    const out: string[][] = [];
    for (let r = n.r1; r <= n.r2; r++) {
      const row: string[] = [];
      for (let c = n.c1; c <= n.c2; c++) {
        const v = ctrl.getValue(r, c);
        row.push(v == null ? "" : String(v));
      }
      out.push(row);
    }
    return out;
  }

  async function copySelection() {
    const raw = selectionToMatrix();
    const computed = selectionToComputedMatrix();
    internalClipRef.current = { raw, computed };
    const m = raw;
    const tsv = writeDelimited(m, "\t");
    const html = matrixToHtml(m);
    try {
      // Rich clipboard: write both HTML and plain TSV when supported.
      if (typeof ClipboardItem !== "undefined" && navigator.clipboard?.write) {
        await navigator.clipboard.write([
          new ClipboardItem({
            "text/html": new Blob([html], { type: "text/html" }),
            "text/plain": new Blob([tsv], { type: "text/plain" }),
          }),
        ]);
      } else {
        await navigator.clipboard.writeText(tsv);
      }
    } catch {
      try { await navigator.clipboard.writeText(tsv); } catch { /* ignore */ }
    }
  }

  async function pasteFromClipboard() {
    try {
      const text = await navigator.clipboard.readText();
      if (!text) return;
      const delim = text.includes("\t") ? "\t" : ",";
      const rows = parseDelimited(text, delim);
      if (!rows.length) return;
      const n = normalizeRange(state.selection);
      const range: RangeRC = {
        r1: n.r1, c1: n.c1,
        r2: n.r1 + rows.length - 1,
        c2: n.c1 + (rows[0]?.length ?? 1) - 1,
      };
      ctrl.exec({ kind: "setRange", range, values: rows });
      ctrl.setSelection(range, { row: n.r1, col: n.c1 });
    } catch { /* clipboard access denied */ }
  }

  function applyPasteSpecial(mode: "values" | "formulas" | "transpose") {
    const clip = internalClipRef.current;
    if (!clip) return;
    let rows = mode === "values" ? clip.computed : clip.raw;
    if (mode === "transpose") {
      const cols = rows[0]?.length ?? 0;
      const transposed: string[][] = [];
      for (let c = 0; c < cols; c++) transposed.push(rows.map((row) => row[c] ?? ""));
      rows = transposed;
    }
    if (!rows.length) return;
    const n = normalizeRange(state.selection);
    const range: RangeRC = {
      r1: n.r1, c1: n.c1,
      r2: n.r1 + rows.length - 1,
      c2: n.c1 + (rows[0]?.length ?? 1) - 1,
    };
    ctrl.exec({ kind: "setRange", range, values: rows });
    ctrl.setSelection(range, { row: n.r1, col: n.c1 });
    setPasteSpecialOpen(false);
  }

  function matrixToHtml(m: string[][]): string {
    const esc = (s: string) =>
      s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
    const rows = m
      .map((row) => "<tr>" + row.map((c) => `<td>${esc(c)}</td>`).join("") + "</tr>")
      .join("");
    return `<table data-orbitoffice="1" border="1" cellspacing="0" cellpadding="2">${rows}</table>`;
  }

  function htmlToMatrix(html: string): string[][] | null {
    try {
      const doc = new DOMParser().parseFromString(html, "text/html");
      const table = doc.querySelector("table");
      if (!table) return null;
      const out: string[][] = [];
      table.querySelectorAll("tr").forEach((tr) => {
        const row: string[] = [];
        tr.querySelectorAll("th,td").forEach((td) => {
          row.push((td.textContent ?? "").replace(/\u00a0/g, " "));
        });
        if (row.length) out.push(row);
      });
      return out.length ? out : null;
    } catch {
      return null;
    }
  }

  function onPaste(e: React.ClipboardEvent) {
    if (state.editing) return;
    const html = e.clipboardData.getData("text/html");
    let rows: string[][] | null = null;
    if (html) rows = htmlToMatrix(html);
    if (!rows) {
      const text = e.clipboardData.getData("text/plain");
      if (!text) return;
      const delim = text.includes("\t") ? "\t" : ",";
      rows = parseDelimited(text, delim);
    }
    if (!rows || !rows.length) return;
    e.preventDefault();
    const n = normalizeRange(state.selection);
    const range: RangeRC = {
      r1: n.r1,
      c1: n.c1,
      r2: n.r1 + rows.length - 1,
      c2: n.c1 + (rows[0]?.length ?? 1) - 1,
    };
    ctrl.exec({ kind: "setRange", range, values: rows });
    ctrl.setSelection(range, { row: n.r1, col: n.c1 });
  }

  // ----- render visible cells -----
  const cells: JSX.Element[] = [];
  const selN = normalizeRange(state.selection);
  // (merge anchors are rendered via findMergeAt below)
  for (let r = r1; r <= r2; r++) {
    const top = HEADER_H + axes.rows.offsetOf(r);
    const h = axes.rows.sizeOf(r);
    for (let c = c1; c <= c2; c++) {
      const left = HEADER_W + axes.cols.offsetOf(c);
      const w = axes.cols.sizeOf(c);
      const key = a1(r, c);
      const merge = findMergeAt(sheet, r, c);
      // Only render the anchor of a merge; skip covered cells.
      if (merge && !isMergeAnchor(merge, r, c)) continue;
      const cellW = merge
        ? axes.cols.offsetOf(merge.c2) + axes.cols.sizeOf(merge.c2) - axes.cols.offsetOf(merge.c1)
        : w;
      const cellH = merge
        ? axes.rows.offsetOf(merge.r2) + axes.rows.sizeOf(merge.r2) - axes.rows.offsetOf(merge.r1)
        : h;
      const cell = sheet.cells.get(key);
      const v = ctrl.getValue(r, c);
      const isErr = (typeof v === "string" && v.startsWith("#") && v.endsWith("!")) || v === "#N/A" || v === "#CIRC!";
      const text = formatCell(v, cell?.s);
      const align = cell?.s?.align ?? defaultAlign(v);
      const selected = inRange(selN, r, c);
      const b = cell?.s?.borders;
      const cf = evalCondFormat(sheet, r, c, v);
      const style: React.CSSProperties = {
        left,
        top,
        width: cellW,
        height: cellH,
        textAlign: align,
        fontWeight: (cell?.s?.bold || cf?.bold) ? 600 : undefined,
        fontStyle: (cell?.s?.italic || cf?.italic) ? "italic" : undefined,
        textDecoration: cell?.s?.underline ? "underline" : undefined,
        color: isErr ? "var(--oo-color-danger)" : (cf?.color ?? cell?.s?.color),
        background: cf?.bg ?? cell?.s?.bg,
        zIndex: merge ? 1 : undefined,
        fontFamily: cell?.s?.fontFamily,
        fontSize: cell?.s?.fontSize ? `${cell.s.fontSize}px` : undefined,
        whiteSpace: cell?.s?.wrapText ? "normal" : "nowrap",
        overflow: "hidden",
        overflowWrap: cell?.s?.wrapText ? "break-word" : undefined,
      };
      if (b?.top) style.borderTop = "1px solid var(--oo-color-fg)";
      if (b?.right) style.borderRight = "1px solid var(--oo-color-fg)";
      if (b?.bottom) style.borderBottom = "1px solid var(--oo-color-fg)";
      if (b?.left) style.borderLeft = "1px solid var(--oo-color-fg)";
      const dv = findValidation(sheet, r, c);
      const dvList = dv && dv.rule.kind === "list";
      cells.push(
        <div
          key={key}
          className={"oo-cell" + (selected ? " is-selected" : "") + (merge ? " is-merged" : "")}
          style={style}
        >
          {text}
          {dvList && <span className="oo-dv-arrow" aria-hidden>▾</span>}
          {cell?.cm && (
            <span
              aria-label={`Comment: ${cell.cm}`}
              title={cell.cm}
              style={{
                position: "absolute",
                top: 0,
                right: 0,
                width: 0,
                height: 0,
                borderStyle: "solid",
                borderWidth: "0 6px 6px 0",
                borderColor: "transparent #e53e3e transparent transparent",
                pointerEvents: "none",
              }}
            />
          )}
        </div>,
      );
    }
  }
  // Render merges whose anchor is outside the viewport but body intersects it.
  for (const m of sheet.merges) {
    if (m.r2 < r1 || m.r1 > r2 || m.c2 < c1 || m.c1 > c2) continue;
    if (m.r1 >= r1 && m.r1 <= r2 && m.c1 >= c1 && m.c1 <= c2) continue; // already drawn
    const left = HEADER_W + axes.cols.offsetOf(m.c1);
    const top = HEADER_H + axes.rows.offsetOf(m.r1);
    const width = axes.cols.offsetOf(m.c2) + axes.cols.sizeOf(m.c2) - axes.cols.offsetOf(m.c1);
    const height = axes.rows.offsetOf(m.r2) + axes.rows.sizeOf(m.r2) - axes.rows.offsetOf(m.r1);
    const key = a1(m.r1, m.c1);
    const cell = sheet.cells.get(key);
    const v = ctrl.getValue(m.r1, m.c1);
    const text = formatCell(v, cell?.s);
    const align = cell?.s?.align ?? defaultAlign(v);
    cells.push(
      <div
        key={"m" + key}
        className="oo-cell is-merged"
        style={{
          left, top, width, height, textAlign: align,
          fontWeight: cell?.s?.bold ? 600 : undefined,
          fontStyle: cell?.s?.italic ? "italic" : undefined,
          background: cell?.s?.bg,
          color: cell?.s?.color,
          zIndex: 1,
        }}
      >
        {text}
      </div>,
    );
  }

  // headers (with resize handles)
  const liveColW = (c: number) =>
    drag?.kind === "col" && drag.index === c ? drag.w : axes.cols.sizeOf(c);
  const liveRowH = (r: number) =>
    drag?.kind === "row" && drag.index === r ? drag.h : axes.rows.sizeOf(r);

  const colHeaders: JSX.Element[] = [];
  for (let c = c1; c <= c2; c++) {
    const left = HEADER_W + axes.cols.offsetOf(c);
    const w = axes.cols.sizeOf(c);
    const active = c >= selN.c1 && c <= selN.c2;
    colHeaders.push(
      <div
        key={"ch" + c}
        className={"oo-headcell" + (active ? " is-active" : "")}
        style={{ left, top: scroll.top, width: w, height: HEADER_H }}
        onMouseDown={(e) => {
          e.stopPropagation();
          if (state.editing) ctrl.commitEdit();
          ctrl.setSelection(
            { r1: 0, c1: c, r2: sheet.numRows - 1, c2: c },
            { row: 0, col: c },
          );
        }}
      >
        {colToLetters(c)}
        <div
          className={"oo-col-resize" + (drag?.kind === "col" && drag.index === c ? " is-active" : "")}
          style={{ left: w - 3 }}
          onMouseDown={(e) => {
            e.stopPropagation();
            e.preventDefault();
            setDrag({ kind: "col", index: c, startX: e.clientX, startW: w, w });
          }}
          onDoubleClick={(e) => {
            e.stopPropagation();
            ctrl.exec({ kind: "setColWidth", col: c, w: DEFAULT_COL_W });
          }}
        />
      </div>,
    );
  }
  const rowHeaders: JSX.Element[] = [];
  for (let r = r1; r <= r2; r++) {
    const top = HEADER_H + axes.rows.offsetOf(r);
    const h = axes.rows.sizeOf(r);
    const active = r >= selN.r1 && r <= selN.r2;
    rowHeaders.push(
      <div
        key={"rh" + r}
        className={"oo-headcell" + (active ? " is-active" : "")}
        style={{ top, left: scroll.left, width: HEADER_W, height: h }}
        onMouseDown={(e) => {
          e.stopPropagation();
          if (state.editing) ctrl.commitEdit();
          ctrl.setSelection(
            { r1: r, c1: 0, r2: r, c2: sheet.numCols - 1 },
            { row: r, col: 0 },
          );
        }}
      >
        {r + 1}
        <div
          className={"oo-row-resize" + (drag?.kind === "row" && drag.index === r ? " is-active" : "")}
          style={{ top: h - 3 }}
          onMouseDown={(e) => {
            e.stopPropagation();
            e.preventDefault();
            setDrag({ kind: "row", index: r, startY: e.clientY, startH: h, h });
          }}
          onDoubleClick={(e) => {
            e.stopPropagation();
            ctrl.exec({ kind: "setRowHeight", row: r, h: DEFAULT_ROW_H });
          }}
        />
      </div>,
    );
  }
  // Suppress unused
  void liveColW; void liveRowH;

  // selection overlay box
  const selBox = (() => {
    const left = HEADER_W + axes.cols.offsetOf(selN.c1);
    const top = HEADER_H + axes.rows.offsetOf(selN.r1);
    const right = HEADER_W + axes.cols.offsetOf(selN.c2) + axes.cols.sizeOf(selN.c2);
    const bottom = HEADER_H + axes.rows.offsetOf(selN.r2) + axes.rows.sizeOf(selN.r2);
    return { left, top, width: right - left, height: bottom - top };
  })();

  // editor
  const editor = state.editing ? (() => {
    const { row, col, draft } = state.editing;
    const left = HEADER_W + axes.cols.offsetOf(col);
    const top = HEADER_H + axes.rows.offsetOf(row);
    const width = Math.max(axes.cols.sizeOf(col), 80);
    const height = axes.rows.sizeOf(row);
    return (
      <input
        key={`ed-${row}-${col}`}
        ref={editorRef}
        autoFocus
        className="oo-editor"
        style={{ left, top, width, height }}
        value={draft}
        onChange={(e) => ctrl.updateDraft(e.target.value)}
        onMouseDown={(e) => {
          // Prevent grid mousedown from triggering range-pick on the editor itself
          e.stopPropagation();
        }}
        onKeyDown={(e) => {
          if (e.key === "Enter") {
            e.preventDefault();
            pickRef.current = null;
            ctrl.commitEdit({ dr: e.shiftKey ? -1 : 1, dc: 0 });
          } else if (e.key === "Tab") {
            e.preventDefault();
            pickRef.current = null;
            ctrl.commitEdit({ dr: 0, dc: e.shiftKey ? -1 : 1 });
          } else if (e.key === "Escape") {
            e.preventDefault();
            pickRef.current = null;
            ctrl.cancelEdit();
          }
        }}
        onBlur={() => {
          // Don't commit if user is picking a range in the grid
          if (pickRef.current) return;
          ctrl.commitEdit();
        }}
      />
    );
  })() : null;

  return (
    <ContextMenu>
      <ContextMenuTrigger asChild>
        <div
          ref={scrollRef}
          className="oo-grid"
          tabIndex={0}
          role="grid"
          aria-rowcount={sheet.numRows}
          aria-colcount={sheet.numCols}
          onContextMenu={onContextMenu}
          onMouseDown={onMouseDown}
          onMouseMove={onMouseMove}
          onMouseUp={onMouseUp}
          onDoubleClick={onDoubleClick}
          onKeyDown={onKeyDown}
          onPaste={onPaste}
        >
      <div className="oo-canvas" style={{ width: totalW, height: totalH }}>
        {cells}
        <div className="oo-selection" style={selBox} />
        {/* fill handle */}
        {!state.editing && (
          <div
            className="oo-fill-handle"
            style={{
              left: selBox.left + selBox.width - 4,
              top: selBox.top + selBox.height - 4,
            }}
            onMouseDown={(e) => {
              e.stopPropagation();
              e.preventDefault();
              setDrag({ kind: "fill", preview: null });
            }}
          />
        )}
        {drag?.kind === "fill" && drag.preview && (() => {
          const p = normalizeRange(drag.preview);
          const left = HEADER_W + axes.cols.offsetOf(p.c1);
          const top = HEADER_H + axes.rows.offsetOf(p.r1);
          const right = HEADER_W + axes.cols.offsetOf(p.c2) + axes.cols.sizeOf(p.c2);
          const bottom = HEADER_H + axes.rows.offsetOf(p.r2) + axes.rows.sizeOf(p.r2);
          return (
            <div
              className="oo-fill-preview"
              style={{ left, top, width: right - left, height: bottom - top }}
            />
          );
        })()}
        {colHeaders}
        {rowHeaders}
        {/* Frozen panes overlays */}
        {(sheet.freezeRows > 0 || sheet.freezeCols > 0) && (() => {
          const fR = Math.min(sheet.freezeRows, sheet.numRows);
          const fC = Math.min(sheet.freezeCols, sheet.numCols);
          const out: JSX.Element[] = [];
          // Frozen top rows
          if (fR > 0) {
            for (let r = 0; r < fR; r++) {
              const top = HEADER_H + axes.rows.offsetOf(r) + scroll.top;
              const h = axes.rows.sizeOf(r);
              for (let c = c1; c <= c2; c++) {
                const left = HEADER_W + axes.cols.offsetOf(c);
                const w = axes.cols.sizeOf(c);
                const cell = sheet.cells.get(a1(r, c));
                const v = ctrl.getValue(r, c);
                out.push(
                  <div
                    key={`fz-r-${r}-${c}`}
                    className="oo-cell oo-frozen"
                    style={{ left, top, width: w, height: h, fontWeight: cell?.s?.bold ? 600 : undefined, background: cell?.s?.bg ?? "var(--oo-color-bg)" }}
                  >
                    {formatCell(v, cell?.s)}
                  </div>,
                );
              }
            }
          }
          if (fC > 0) {
            for (let c = 0; c < fC; c++) {
              const left = HEADER_W + axes.cols.offsetOf(c) + scroll.left;
              const w = axes.cols.sizeOf(c);
              for (let r = r1; r <= r2; r++) {
                const top = HEADER_H + axes.rows.offsetOf(r);
                const h = axes.rows.sizeOf(r);
                const cell = sheet.cells.get(a1(r, c));
                const v = ctrl.getValue(r, c);
                out.push(
                  <div
                    key={`fz-c-${r}-${c}`}
                    className="oo-cell oo-frozen"
                    style={{ left, top, width: w, height: h, fontWeight: cell?.s?.bold ? 600 : undefined, background: cell?.s?.bg ?? "var(--oo-color-bg)" }}
                  >
                    {formatCell(v, cell?.s)}
                  </div>,
                );
              }
            }
          }
          // top-left corner of freeze
          if (fR > 0 && fC > 0) {
            for (let r = 0; r < fR; r++) for (let c = 0; c < fC; c++) {
              const left = HEADER_W + axes.cols.offsetOf(c) + scroll.left;
              const top = HEADER_H + axes.rows.offsetOf(r) + scroll.top;
              const w = axes.cols.sizeOf(c); const h = axes.rows.sizeOf(r);
              const cell = sheet.cells.get(a1(r, c));
              const v = ctrl.getValue(r, c);
              out.push(
                <div
                  key={`fz-tl-${r}-${c}`}
                  className="oo-cell oo-frozen oo-frozen-corner"
                  style={{ left, top, width: w, height: h, fontWeight: cell?.s?.bold ? 600 : undefined, background: cell?.s?.bg ?? "var(--oo-color-bg)" }}
                >
                  {formatCell(v, cell?.s)}
                </div>,
              );
            }
          }
          return out;
        })()}
        {/* Charts */}
        {sheet.charts.map((ch) => {
          const live = drag?.kind === "chart" && drag.id === ch.id ? { ...ch, x: drag.x, y: drag.y } : ch;
          const data = extractSeries((r, c) => ctrl.getValue(r, c), live);
          return (
            <ChartView
              key={ch.id}
              chart={live}
              data={data}
              onRemove={() => ctrl.exec({ kind: "removeChart", id: ch.id })}
              onMoveStart={(e) => {
                e.preventDefault();
                e.stopPropagation();
                setDrag({ kind: "chart", id: ch.id, startX: e.clientX, startY: e.clientY, ox: ch.x, oy: ch.y, x: ch.x, y: ch.y });
              }}
            />
          );
        })}
        <div
          className="oo-corner"
          style={{
            position: "absolute",
            top: scroll.top,
            left: scroll.left,
            width: HEADER_W,
            height: HEADER_H,
            zIndex: 5,
          }}
        />
        {editor}
        {pasteSpecialOpen && (
          <div
            style={{
              position: "fixed",
              inset: 0,
              zIndex: 1000,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              background: "rgba(0,0,0,0.3)",
            }}
            onMouseDown={(e) => { if (e.target === e.currentTarget) setPasteSpecialOpen(false); }}
          >
            <div
              style={{
                background: "var(--oo-color-bg, #fff)",
                border: "1px solid var(--oo-color-border, #ddd)",
                borderRadius: 8,
                padding: "20px 24px",
                minWidth: 260,
                boxShadow: "0 8px 24px rgba(0,0,0,0.18)",
              }}
            >
              <div style={{ fontWeight: 600, marginBottom: 12, fontSize: 14 }}>Paste Special</div>
              {!internalClipRef.current && (
                <div style={{ fontSize: 13, color: "var(--oo-color-muted, #888)", marginBottom: 12 }}>
                  Copy cells first (Ctrl+C), then use Paste Special.
                </div>
              )}
              <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                <button
                  className="oo-btn"
                  disabled={!internalClipRef.current}
                  style={{ justifyContent: "flex-start", padding: "6px 12px" }}
                  onClick={() => applyPasteSpecial("values")}
                >
                  Paste Values Only
                </button>
                <button
                  className="oo-btn"
                  disabled={!internalClipRef.current}
                  style={{ justifyContent: "flex-start", padding: "6px 12px" }}
                  onClick={() => applyPasteSpecial("formulas")}
                >
                  Paste Formulas
                </button>
                <button
                  className="oo-btn"
                  disabled={!internalClipRef.current}
                  style={{ justifyContent: "flex-start", padding: "6px 12px" }}
                  onClick={() => applyPasteSpecial("transpose")}
                >
                  Transpose
                </button>
                <button
                  className="oo-btn"
                  style={{ justifyContent: "flex-start", padding: "6px 12px", marginTop: 4 }}
                  onClick={() => setPasteSpecialOpen(false)}
                >
                  Cancel
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
        </div>
      </ContextMenuTrigger>
      <ContextMenuContent className="min-w-[180px]">
        <ContextMenuItem onSelect={() => copySelection()}>Copy</ContextMenuItem>
        <ContextMenuItem onSelect={() => pasteFromClipboard()}>Paste</ContextMenuItem>
        <ContextMenuItem onSelect={() => setPasteSpecialOpen(true)}>Paste Special…</ContextMenuItem>
        <ContextMenuItem
          onSelect={() => ctrl.exec({ kind: "clearRange", range: state.selection })}
        >
          Clear Contents
        </ContextMenuItem>
        <ContextMenuSeparator />
        <ContextMenuItem
          onSelect={() => {
            const t = ctxTargetRef.current;
            if (!t) return;
            ctrl.exec({ kind: "insertRow", at: t.row });
            ctrl.setSelection({ r1: t.row, c1: 0, r2: t.row, c2: sheet.numCols - 1 }, { row: t.row, col: 0 });
          }}
        >
          Insert Row Above
        </ContextMenuItem>
        <ContextMenuItem
          onSelect={() => {
            const t = ctxTargetRef.current;
            if (!t) return;
            ctrl.exec({ kind: "insertRow", at: t.row + 1 });
          }}
        >
          Insert Row Below
        </ContextMenuItem>
        <ContextMenuItem
          onSelect={() => {
            const t = ctxTargetRef.current;
            if (!t) return;
            ctrl.exec({ kind: "deleteRow", at: t.row });
          }}
        >
          Delete Row
        </ContextMenuItem>
        <ContextMenuSeparator />
        <ContextMenuItem
          onSelect={() => {
            const t = ctxTargetRef.current;
            if (!t) return;
            ctrl.exec({ kind: "insertCol", at: t.col });
            ctrl.setSelection({ r1: 0, c1: t.col, r2: sheet.numRows - 1, c2: t.col }, { row: 0, col: t.col });
          }}
        >
          Insert Column Left
        </ContextMenuItem>
        <ContextMenuItem
          onSelect={() => {
            const t = ctxTargetRef.current;
            if (!t) return;
            ctrl.exec({ kind: "insertCol", at: t.col + 1 });
          }}
        >
          Insert Column Right
        </ContextMenuItem>
        <ContextMenuItem
          onSelect={() => {
            const t = ctxTargetRef.current;
            if (!t) return;
            ctrl.exec({ kind: "deleteCol", at: t.col });
          }}
        >
          Delete Column
        </ContextMenuItem>
        <ContextMenuSeparator />
        <ContextMenuItem
          onSelect={() => {
            const t = ctxTargetRef.current;
            if (!t) return;
            const existing = sheet.cells.get(a1(t.row, t.col))?.cm ?? "";
            // eslint-disable-next-line no-alert
            const text = window.prompt("Comment:", existing);
            if (text !== null) ctrl.exec({ kind: "setComment", row: t.row, col: t.col, text });
          }}
        >
          {ctxTargetRef.current && sheet.cells.get(a1(ctxTargetRef.current.row, ctxTargetRef.current.col))?.cm
            ? "Edit Comment"
            : "Add Comment"}
        </ContextMenuItem>
      </ContextMenuContent>
    </ContextMenu>
  );
}
