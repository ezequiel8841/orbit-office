// @orbitoffice/doc — controller. Wraps an HTMLDivElement with command surface
// (no document.execCommand). Manages history via core history stack with
// snapshot-based undo/redo for simplicity & correctness across selections.
import { createStore } from "../core/store";

interface Snapshot {
  html: string;
  // Caret saved as character offset in textContent (best-effort restore).
  selStart: number;
  selEnd: number;
}

export interface DocState {
  // Bumped to notify subscribers about transient changes.
  rev: number;
  canUndo: boolean;
  canRedo: boolean;
  words: number;
  chars: number;
}

export interface DocController {
  store: ReturnType<typeof createStore<DocState>>;
  attach(el: HTMLDivElement): void;
  exec(cmd: Command): void;
  undo(): void;
  redo(): void;
  getHtml(): string;
  setHtml(html: string): void;
  recomputeStats(): void;
}

export type Command =
  | { kind: "toggleMark"; tag: "b" | "i" | "u" | "s" | "code" | "sub" | "sup" }
  | { kind: "setBlock"; tag: "p" | "h1" | "h2" | "h3" | "h4" | "h5" | "h6" | "blockquote" | "pre" }
  | { kind: "align"; value: "left" | "center" | "right" | "justify" }
  | { kind: "list"; ordered: boolean }
  | { kind: "checklist" }
  | { kind: "hr" }
  | { kind: "link"; href: string | null }
  | { kind: "color"; value: string }
  | { kind: "highlight"; value: string }
  | { kind: "fontSize"; px: number }
  | { kind: "fontFamily"; value: string }
  | { kind: "image"; src: string; alt?: string }
  | { kind: "table"; rows: number; cols: number }
  | { kind: "tableInsertRow"; where: "above" | "below" }
  | { kind: "tableDeleteRow" }
  | { kind: "tableInsertCol"; where: "left" | "right" }
  | { kind: "tableDeleteCol" }
  | { kind: "indent"; dir: 1 | -1 }
  | { kind: "pageBreak" }
  | { kind: "clearFormatting" }
  | { kind: "insertText"; text: string }
  | { kind: "insertHtml"; html: string };

export function createDocController(): DocController {
  const store = createStore<DocState>({
    rev: 0,
    canUndo: false,
    canRedo: false,
    words: 0,
    chars: 0,
  });

  let el: HTMLDivElement | null = null;
  const past: Snapshot[] = [];
  const future: Snapshot[] = [];
  let lastSnapshotAt = 0;
  const COALESCE_MS = 600;

  function bump() {
    store.set((s) => ({
      ...s,
      rev: s.rev + 1,
      canUndo: past.length > 0,
      canRedo: future.length > 0,
    }));
  }

  function captureCaret(): { start: number; end: number } {
    if (!el) return { start: 0, end: 0 };
    const sel = window.getSelection();
    if (!sel || sel.rangeCount === 0) return { start: 0, end: 0 };
    const r = sel.getRangeAt(0);
    const pre = r.cloneRange();
    pre.selectNodeContents(el);
    pre.setEnd(r.startContainer, r.startOffset);
    const start = pre.toString().length;
    const end = start + r.toString().length;
    return { start, end };
  }

  function restoreCaret(start: number, end: number) {
    if (!el) return;
    const range = document.createRange();
    let charIndex = 0;
    let startNode: Node | null = null, startOff = 0;
    let endNode: Node | null = null, endOff = 0;
    const walker = document.createTreeWalker(el, NodeFilter.SHOW_TEXT);
    let n: Node | null;
    while ((n = walker.nextNode())) {
      const len = (n.textContent ?? "").length;
      const next = charIndex + len;
      if (!startNode && start <= next) { startNode = n; startOff = start - charIndex; }
      if (!endNode && end <= next) { endNode = n; endOff = end - charIndex; break; }
      charIndex = next;
    }
    if (!startNode) { startNode = el; startOff = el.childNodes.length; }
    if (!endNode) { endNode = startNode; endOff = startOff; }
    try {
      range.setStart(startNode, startOff);
      range.setEnd(endNode, endOff);
      const sel = window.getSelection();
      sel?.removeAllRanges();
      sel?.addRange(range);
    } catch { /* ignore */ }
  }

  function snapshot(force = false) {
    if (!el) return;
    const now = Date.now();
    if (!force && now - lastSnapshotAt < COALESCE_MS && past.length > 0) {
      // coalesce typing — replace the top snapshot
      past[past.length - 1] = { html: el.innerHTML, ...captureCaret() as any };
      lastSnapshotAt = now;
      return;
    }
    past.push({ html: el.innerHTML, ...captureCaret() as any });
    if (past.length > 200) past.shift();
    future.length = 0;
    lastSnapshotAt = now;
    bump();
  }

  function applySnapshot(s: Snapshot) {
    if (!el) return;
    el.innerHTML = s.html;
    restoreCaret(s.selStart, s.selEnd);
    recomputeStats();
    bump();
  }

  function undo() {
    if (!el || past.length === 0) return;
    const cur: Snapshot = { html: el.innerHTML, ...captureCaret() as any };
    const prev = past.pop()!;
    future.push(cur);
    applySnapshot(prev);
  }
  function redo() {
    if (!el || future.length === 0) return;
    const cur: Snapshot = { html: el.innerHTML, ...captureCaret() as any };
    past.push(cur);
    const next = future.pop()!;
    applySnapshot(next);
  }

  function recomputeStats() {
    if (!el) return;
    const text = el.innerText ?? "";
    const words = (text.trim().match(/\S+/g) ?? []).length;
    store.set((s) => ({ ...s, chars: text.length, words }));
  }

  function withinEditor(): boolean {
    if (!el) return false;
    const sel = window.getSelection();
    if (!sel || sel.rangeCount === 0) return false;
    return el.contains(sel.anchorNode);
  }

  function ensureFocus() {
    el?.focus();
    if (!withinEditor()) {
      // place caret at end
      const r = document.createRange();
      r.selectNodeContents(el!);
      r.collapse(false);
      const sel = window.getSelection();
      sel?.removeAllRanges();
      sel?.addRange(r);
    }
  }

  function getRange(): Range | null {
    const sel = window.getSelection();
    if (!sel || sel.rangeCount === 0) return null;
    return sel.getRangeAt(0);
  }

  function wrapSelection(tag: string, attrs: Record<string, string> = {}) {
    const r = getRange(); if (!r || !el) return;
    if (r.collapsed) return;
    const wrap = document.createElement(tag);
    for (const [k, v] of Object.entries(attrs)) wrap.setAttribute(k, v);
    try {
      wrap.appendChild(r.extractContents());
      r.insertNode(wrap);
      // restore selection around wrap
      const sel = window.getSelection();
      sel?.removeAllRanges();
      const nr = document.createRange();
      nr.selectNodeContents(wrap);
      sel?.addRange(nr);
    } catch { /* ignore */ }
  }

  function unwrapWithin(tag: string) {
    const r = getRange(); if (!r || !el) return;
    const matches = el.querySelectorAll(tag);
    matches.forEach((m) => {
      if (r.intersectsNode(m)) {
        const parent = m.parentNode!;
        while (m.firstChild) parent.insertBefore(m.firstChild, m);
        parent.removeChild(m);
      }
    });
  }

  function isInTag(tag: string): boolean {
    const r = getRange(); if (!r) return false;
    let node: Node | null = r.commonAncestorContainer;
    while (node && node !== el) {
      if (node.nodeType === 1 && (node as HTMLElement).tagName.toLowerCase() === tag.toLowerCase()) return true;
      node = node.parentNode;
    }
    return false;
  }

  function toggleMark(tag: string) {
    if (isInTag(tag)) unwrapWithin(tag);
    else wrapSelection(tag);
  }

  function blockOf(node: Node | null): HTMLElement | null {
    let n: Node | null = node;
    while (n && n !== el) {
      if (n.nodeType === 1) {
        const t = (n as HTMLElement).tagName;
        if (/^(P|H[1-6]|BLOCKQUOTE|PRE|LI|DIV)$/.test(t)) return n as HTMLElement;
      }
      n = n.parentNode;
    }
    return null;
  }

  function setBlockTag(tag: string) {
    const r = getRange(); if (!r || !el) return;
    const block = blockOf(r.startContainer);
    if (!block) return;
    if (block.tagName.toLowerCase() === tag) return;
    const nb = document.createElement(tag);
    while (block.firstChild) nb.appendChild(block.firstChild);
    // copy alignment
    if (block.style.textAlign) nb.style.textAlign = block.style.textAlign;
    block.replaceWith(nb);
    // restore caret to end of new block
    const nr = document.createRange();
    nr.selectNodeContents(nb);
    nr.collapse(false);
    const sel = window.getSelection();
    sel?.removeAllRanges();
    sel?.addRange(nr);
  }

  function alignBlock(value: string) {
    const r = getRange(); if (!r) return;
    const block = blockOf(r.startContainer);
    if (block) block.style.textAlign = value;
  }

  function makeList(ordered: boolean) {
    const r = getRange(); if (!r || !el) return;
    const block = blockOf(r.startContainer); if (!block) return;
    const list = document.createElement(ordered ? "ol" : "ul");
    const li = document.createElement("li");
    while (block.firstChild) li.appendChild(block.firstChild);
    list.appendChild(li);
    block.replaceWith(list);
    const nr = document.createRange();
    nr.selectNodeContents(li);
    nr.collapse(false);
    const sel = window.getSelection();
    sel?.removeAllRanges();
    sel?.addRange(nr);
  }

  function makeChecklist() {
    const r = getRange(); if (!r || !el) return;
    const block = blockOf(r.startContainer); if (!block) return;
    const ul = document.createElement("ul");
    ul.setAttribute("data-list", "check");
    const li = document.createElement("li");
    li.setAttribute("data-checked", "false");
    const cb = document.createElement("input");
    cb.type = "checkbox"; cb.contentEditable = "false";
    cb.addEventListener("change", () => {
      li.setAttribute("data-checked", String(cb.checked));
      snapshot(true);
    });
    li.appendChild(cb);
    li.appendChild(document.createTextNode(" "));
    while (block.firstChild) li.appendChild(block.firstChild);
    ul.appendChild(li);
    block.replaceWith(ul);
  }

  function insertHr() {
    const r = getRange(); if (!r) return;
    const hr = document.createElement("hr");
    r.insertNode(hr);
    const after = document.createElement("p");
    after.innerHTML = "<br/>";
    hr.parentNode?.insertBefore(after, hr.nextSibling);
    const nr = document.createRange();
    nr.selectNodeContents(after); nr.collapse(true);
    const sel = window.getSelection(); sel?.removeAllRanges(); sel?.addRange(nr);
  }

  function setLink(href: string | null) {
    if (href === null) { unwrapWithin("a"); return; }
    wrapSelection("a", { href, target: "_blank", rel: "noopener" });
  }

  function setColor(value: string) {
    wrapSelection("span", { style: `color:${value}` });
  }
  function setHighlight(value: string) {
    wrapSelection("span", { style: `background:${value}` });
  }
  function setFontSize(px: number) {
    wrapSelection("span", { style: `font-size:${px}px` });
  }

  function insertImage(src: string, alt = "") {
    const r = getRange(); if (!r) return;
    const img = document.createElement("img");
    img.src = src; img.alt = alt;
    img.style.maxWidth = "100%";
    r.insertNode(img);
    r.setStartAfter(img); r.collapse(true);
  }

  function insertTable(rows: number, cols: number) {
    const r = getRange(); if (!r) return;
    const t = document.createElement("table");
    t.className = "oo-doc-table";
    for (let i = 0; i < rows; i++) {
      const tr = document.createElement("tr");
      for (let j = 0; j < cols; j++) {
        const cell = document.createElement(i === 0 ? "th" : "td");
        cell.innerHTML = "<br/>";
        tr.appendChild(cell);
      }
      t.appendChild(tr);
    }
    r.insertNode(t);
    const after = document.createElement("p");
    after.innerHTML = "<br/>";
    t.parentNode?.insertBefore(after, t.nextSibling);
  }

  function indent(dir: 1 | -1) {
    const r = getRange(); if (!r) return;
    const block = blockOf(r.startContainer); if (!block) return;
    const cur = parseFloat(block.style.marginLeft || "0");
    const nx = Math.max(0, cur + dir * 24);
    block.style.marginLeft = nx ? `${nx}px` : "";
  }

  function setFontFamily(value: string) {
    wrapSelection("span", { style: `font-family:${value}` });
  }

  function getTableCell(): { table: HTMLTableElement; row: HTMLTableRowElement; cellIndex: number; rowIndex: number } | null {
    const r = getRange();
    if (!r) return null;
    let n: Node | null = r.startContainer;
    let cell: HTMLTableCellElement | null = null;
    let row: HTMLTableRowElement | null = null;
    let table: HTMLTableElement | null = null;
    while (n && n !== el) {
      if (n.nodeType === 1) {
        const tag = (n as HTMLElement).tagName.toUpperCase();
        if (!cell && (tag === "TD" || tag === "TH")) cell = n as HTMLTableCellElement;
        if (!row && tag === "TR") row = n as HTMLTableRowElement;
        if (!table && tag === "TABLE") { table = n as HTMLTableElement; break; }
      }
      n = n.parentNode;
    }
    if (!cell || !row || !table) return null;
    return { table, row, cellIndex: cell.cellIndex, rowIndex: row.rowIndex };
  }

  function tableInsertRow(where: "above" | "below") {
    const ctx = getTableCell();
    if (!ctx) return;
    const { table, row, rowIndex } = ctx;
    const numCols = row.cells.length;
    const newRow = table.insertRow(where === "below" ? rowIndex + 1 : rowIndex);
    for (let i = 0; i < numCols; i++) {
      const cell = newRow.insertCell(i);
      cell.innerHTML = "<br/>";
    }
  }

  function tableDeleteRow() {
    const ctx = getTableCell();
    if (!ctx) return;
    const { table, rowIndex } = ctx;
    if (table.rows.length <= 1) return;
    table.deleteRow(rowIndex);
  }

  function tableInsertCol(where: "left" | "right") {
    const ctx = getTableCell();
    if (!ctx) return;
    const { table, cellIndex } = ctx;
    const insertAt = where === "right" ? cellIndex + 1 : cellIndex;
    for (let i = 0; i < table.rows.length; i++) {
      const row = table.rows[i];
      const cell = document.createElement(i === 0 ? "th" : "td");
      cell.innerHTML = "<br/>";
      row.insertBefore(cell, row.cells[insertAt] ?? null);
    }
  }

  function tableDeleteCol() {
    const ctx = getTableCell();
    if (!ctx) return;
    const { table, cellIndex } = ctx;
    if ((table.rows[0]?.cells.length ?? 0) <= 1) return;
    for (let i = 0; i < table.rows.length; i++) {
      table.rows[i].deleteCell(cellIndex);
    }
  }

  function clearFormatting() {
    const r = getRange(); if (!r || !el) return;
    if (r.collapsed) return;
    const frag = r.extractContents();
    const textNode = document.createTextNode(frag.textContent ?? "");
    r.insertNode(textNode);
    const nr = document.createRange();
    nr.setStart(textNode, 0);
    nr.setEnd(textNode, textNode.length);
    const sel = window.getSelection();
    sel?.removeAllRanges();
    sel?.addRange(nr);
  }

  function insertPageBreak() {
    const r = getRange(); if (!r) return;
    const div = document.createElement("div");
    div.className = "oo-page-break";
    div.contentEditable = "false";
    div.textContent = "— Page Break —";
    r.insertNode(div);
    const after = document.createElement("p");
    after.innerHTML = "<br/>";
    div.parentNode?.insertBefore(after, div.nextSibling);
    const nr = document.createRange();
    nr.selectNodeContents(after);
    nr.collapse(true);
    const sel = window.getSelection();
    sel?.removeAllRanges();
    sel?.addRange(nr);
  }

  function insertText(text: string) {
    const r = getRange(); if (!r) return;
    r.deleteContents();
    r.insertNode(document.createTextNode(text));
    r.collapse(false);
  }

  function insertHtml(html: string) {
    const r = getRange(); if (!r) return;
    r.deleteContents();
    const tpl = document.createElement("template");
    tpl.innerHTML = html;
    const frag = tpl.content;
    const last = frag.lastChild;
    r.insertNode(frag);
    if (last) {
      r.setStartAfter(last);
      r.collapse(true);
    }
    // ensure caret is placed inside editor
    const sel = window.getSelection();
    sel?.removeAllRanges();
    sel?.addRange(r);
  }

  function exec(cmd: Command) {
    if (!el) return;
    ensureFocus();
    snapshot();
    switch (cmd.kind) {
      case "toggleMark": toggleMark(cmd.tag); break;
      case "setBlock": setBlockTag(cmd.tag); break;
      case "align": alignBlock(cmd.value); break;
      case "list": makeList(cmd.ordered); break;
      case "checklist": makeChecklist(); break;
      case "hr": insertHr(); break;
      case "link": setLink(cmd.href); break;
      case "color": setColor(cmd.value); break;
      case "highlight": setHighlight(cmd.value); break;
      case "fontSize": setFontSize(cmd.px); break;
      case "fontFamily": setFontFamily(cmd.value); break;
      case "image": insertImage(cmd.src, cmd.alt); break;
      case "table": insertTable(cmd.rows, cmd.cols); break;
      case "tableInsertRow": tableInsertRow(cmd.where); break;
      case "tableDeleteRow": tableDeleteRow(); break;
      case "tableInsertCol": tableInsertCol(cmd.where); break;
      case "tableDeleteCol": tableDeleteCol(); break;
      case "indent": indent(cmd.dir); break;
      case "pageBreak": insertPageBreak(); break;
      case "clearFormatting": clearFormatting(); break;
      case "insertText": insertText(cmd.text); break;
      case "insertHtml": insertHtml(cmd.html); break;
    }
    recomputeStats();
    bump();
  }

  function attach(node: HTMLDivElement) {
    el = node;
    // initial baseline snapshot
    past.push({ html: el.innerHTML, selStart: 0, selEnd: 0 });
    recomputeStats();
    bump();
  }

  return {
    store,
    attach,
    exec,
    undo,
    redo,
    getHtml: () => el?.innerHTML ?? "",
    setHtml: (html: string) => {
      if (!el) return;
      snapshot(true);
      el.innerHTML = html;
      recomputeStats();
      bump();
    },
    recomputeStats,
  };
}
