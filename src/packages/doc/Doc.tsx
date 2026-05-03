// @orbitoffice/doc — main editor UI built on the controller.
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  IconAlignCenter,
  IconAlignLeft,
  IconAlignRight,
  IconBold,
  IconDownload,
  IconItalic,
  IconRedo,
  IconUnderline,
  IconUpload,
} from "../icons";
import { useStore } from "../core/store";
import { createDocController } from "./controller";
import { htmlToMd, mdToHtml } from "./markdown";
import {
  buildChipHtml,
  extractPlaceholders,
  serializeHtmlForGenerate,
  wrapLiteralPlaceholders,
} from "./placeholders";
import { PlaceholderPalette } from "./PlaceholderPalette";
import type { MappingOption, SmartDocPlaceholder } from "../core/smartDocs";
import { useT } from "../core/i18n";

const STORAGE_KEY = "orbitoffice:doc";
const DEFAULT_HTML = `<h1>Untitled document</h1>
<p>Comece a escrever aqui. Use a barra de ferramentas para formatar — <strong>negrito</strong>, <em>itálico</em>, <u>sublinhado</u>, listas, citações, código e muito mais.</p>
<p>Atalhos: <code>Ctrl+B</code>, <code>Ctrl+I</code>, <code>Ctrl+U</code>, <code>Ctrl+Z</code>, <code>Ctrl+Shift+Z</code>. Digite <code>/</code> para slash commands.</p>`;

export interface DocProps {
  /** Standalone storage key. Ignored when `value` is provided. */
  persistKey?: string;
  /** Controlled HTML value. When set, no localStorage I/O happens. */
  value?: string;
  /** Emits the current HTML (with chips collapsed back to `{{key}}`). */
  onChange?: (html: string) => void;
  /** Smart Docs placeholder vocabulary — when provided, shows the palette. */
  placeholderOptions?: MappingOption[];
  /** Detected placeholders (rendered in the palette footer). */
  detectedPlaceholders?: SmartDocPlaceholder[];
  /** Emits placeholders extracted from the editor on each change. */
  onPlaceholdersChange?: (list: SmartDocPlaceholder[]) => void;
  readOnly?: boolean;
  hideExport?: boolean;
  hideImport?: boolean;
  className?: string;
  style?: React.CSSProperties;
}

interface SlashItem { label: string; run: () => void }

export function Doc({
  persistKey = STORAGE_KEY,
  value,
  onChange,
  placeholderOptions,
  detectedPlaceholders,
  onPlaceholdersChange,
  readOnly,
  hideExport,
  hideImport,
  className,
  style,
}: DocProps) {
  const editorRef = useRef<HTMLDivElement>(null);
  const ctrl = useMemo(() => createDocController(), []);
  const state = useStore(ctrl.store);
  const [slash, setSlash] = useState<{ x: number; y: number; query: string } | null>(null);
  const [findOpen, setFindOpen] = useState(false);
  const [findQuery, setFindQuery] = useState("");
  const [replaceQuery, setReplaceQuery] = useState("");
  const controlled = value !== undefined;
  const lastEmittedRef = useRef<string>("");

  // initial mount
  useEffect(() => {
    const el = editorRef.current; if (!el) return;
    let html = DEFAULT_HTML;
    if (controlled) {
      html = wrapLiteralPlaceholders(value ?? "");
    } else {
      try {
        const saved = localStorage.getItem(persistKey);
        if (saved) html = saved;
      } catch { /* ignore */ }
    }
    el.innerHTML = html;
    ctrl.attach(el);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ctrl]);

  // sync external value updates
  useEffect(() => {
    if (!controlled) return;
    const el = editorRef.current; if (!el) return;
    const wrapped = wrapLiteralPlaceholders(value ?? "");
    if (wrapped !== el.innerHTML && wrapped !== lastEmittedRef.current) {
      ctrl.setHtml(wrapped);
    }
  }, [controlled, value, ctrl]);

  // autosave / onChange emit
  const saveT = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(() => {
    if (saveT.current) clearTimeout(saveT.current);
    saveT.current = setTimeout(() => {
      const html = ctrl.getHtml();
      if (controlled) {
        const out = serializeHtmlForGenerate(html);
        if (out !== lastEmittedRef.current) {
          lastEmittedRef.current = out;
          onChange?.(out);
        }
      } else {
        try { localStorage.setItem(persistKey, html); } catch { /* ignore */ }
      }
      if (onPlaceholdersChange && editorRef.current) {
        onPlaceholdersChange(extractPlaceholders(editorRef.current));
      }
    }, 400);
    return () => { if (saveT.current) clearTimeout(saveT.current); };
  }, [state.rev, ctrl, persistKey, controlled, onChange, onPlaceholdersChange]);

  // ----- slash commands -----
  const slashItems = useCallback((): SlashItem[] => [
    { label: "Heading 1", run: () => ctrl.exec({ kind: "setBlock", tag: "h1" }) },
    { label: "Heading 2", run: () => ctrl.exec({ kind: "setBlock", tag: "h2" }) },
    { label: "Heading 3", run: () => ctrl.exec({ kind: "setBlock", tag: "h3" }) },
    { label: "Body", run: () => ctrl.exec({ kind: "setBlock", tag: "p" }) },
    { label: "Quote", run: () => ctrl.exec({ kind: "setBlock", tag: "blockquote" }) },
    { label: "Code block", run: () => ctrl.exec({ kind: "setBlock", tag: "pre" }) },
    { label: "Bullet list", run: () => ctrl.exec({ kind: "list", ordered: false }) },
    { label: "Numbered list", run: () => ctrl.exec({ kind: "list", ordered: true }) },
    { label: "Checklist", run: () => ctrl.exec({ kind: "checklist" }) },
    { label: "Divider", run: () => ctrl.exec({ kind: "hr" }) },
    { label: "Table 3×3", run: () => ctrl.exec({ kind: "table", rows: 3, cols: 3 }) },
    {
      label: "Image (URL)",
      run: () => {
        const src = prompt("Image URL"); if (src) ctrl.exec({ kind: "image", src });
      },
    },
  ], [ctrl]);

  const filteredSlash = useMemo(() => {
    const q = (slash?.query ?? "").toLowerCase();
    return slashItems().filter((i) => i.label.toLowerCase().includes(q));
  }, [slash, slashItems]);

  // ----- input handling -----
  const onInput = (e: React.FormEvent<HTMLDivElement>) => {
    // markdown shortcuts at start of line on space
    const ev = e.nativeEvent as InputEvent;
    if (ev.inputType === "insertText" && ev.data === " ") tryMdShortcut();
    ctrl.recomputeStats();
    ctrl.store.set((s) => ({ ...s, rev: s.rev + 1 }));
    refreshSlash();
  };

  function refreshSlash() {
    const sel = window.getSelection();
    if (!sel || sel.rangeCount === 0) { setSlash(null); return; }
    const r = sel.getRangeAt(0);
    const txt = r.startContainer.textContent ?? "";
    const before = txt.slice(0, r.startOffset);
    const m = before.match(/(?:^|\s)\/([\w-]*)$/);
    if (!m) { setSlash(null); return; }
    const rect = r.getBoundingClientRect();
    setSlash({ x: rect.left, y: rect.bottom + 4, query: m[1] });
  }

  function tryMdShortcut() {
    const sel = window.getSelection();
    if (!sel || sel.rangeCount === 0) return;
    const r = sel.getRangeAt(0);
    const node = r.startContainer;
    if (node.nodeType !== Node.TEXT_NODE) return;
    const text = node.textContent ?? "";
    const offset = r.startOffset;
    const before = text.slice(0, offset);
    const rules: { re: RegExp; run: () => void }[] = [
      { re: /^# $/, run: () => convert(node as Text, "h1", offset) },
      { re: /^## $/, run: () => convert(node as Text, "h2", offset) },
      { re: /^### $/, run: () => convert(node as Text, "h3", offset) },
      { re: /^> $/, run: () => convert(node as Text, "blockquote", offset) },
      { re: /^- $|^\* $/, run: () => listShortcut(node as Text, offset, false) },
      { re: /^1\. $/, run: () => listShortcut(node as Text, offset, true) },
      { re: /^\[ \] $/, run: () => { (node as Text).deleteData(0, offset); ctrl.exec({ kind: "checklist" }); } },
      { re: /^``` $/, run: () => convert(node as Text, "pre", offset) },
    ];
    for (const rule of rules) {
      if (rule.re.test(before)) { rule.run(); return; }
    }
  }

  function convert(textNode: Text, tag: string, offset: number) {
    textNode.deleteData(0, offset);
    ctrl.exec({ kind: "setBlock", tag: tag as any });
  }
  function listShortcut(textNode: Text, offset: number, ordered: boolean) {
    textNode.deleteData(0, offset);
    ctrl.exec({ kind: "list", ordered });
  }

  // ----- keyboard -----
  const onKeyDown = (e: React.KeyboardEvent) => {
    const meta = e.metaKey || e.ctrlKey;
    if (slash) {
      if (e.key === "Escape") { setSlash(null); e.preventDefault(); return; }
      if (e.key === "Enter" && filteredSlash[0]) {
        e.preventDefault();
        // remove '/query'
        const sel = window.getSelection();
        if (sel && sel.rangeCount > 0) {
          const r = sel.getRangeAt(0);
          const node = r.startContainer;
          const txt = node.textContent ?? "";
          const before = txt.slice(0, r.startOffset);
          const m = before.match(/\/([\w-]*)$/);
          if (m && node.nodeType === Node.TEXT_NODE) {
            (node as Text).deleteData(r.startOffset - m[0].length, m[0].length);
          }
        }
        filteredSlash[0].run();
        setSlash(null);
        return;
      }
    }
    if (meta && !e.shiftKey) {
      const k = e.key.toLowerCase();
      if (k === "b") { e.preventDefault(); ctrl.exec({ kind: "toggleMark", tag: "b" }); return; }
      if (k === "i") { e.preventDefault(); ctrl.exec({ kind: "toggleMark", tag: "i" }); return; }
      if (k === "u") { e.preventDefault(); ctrl.exec({ kind: "toggleMark", tag: "u" }); return; }
      if (k === "z") { e.preventDefault(); ctrl.undo(); return; }
      if (k === "y") { e.preventDefault(); ctrl.redo(); return; }
      if (k === "k") {
        e.preventDefault();
        const href = prompt("Link URL (empty to remove)") ?? "";
        ctrl.exec({ kind: "link", href: href.trim() === "" ? null : href });
        return;
      }
      if (k === "f") { e.preventDefault(); setFindOpen(true); return; }
    }
    if (meta && e.shiftKey && e.key.toLowerCase() === "z") {
      e.preventDefault(); ctrl.redo();
    }
    if (e.key === "Tab") {
      e.preventDefault();
      ctrl.exec({ kind: "indent", dir: e.shiftKey ? -1 : 1 });
    }
  };

  const onPaste = (e: React.ClipboardEvent) => {
    const html = e.clipboardData.getData("text/html");
    const text = e.clipboardData.getData("text/plain");
    if (html) {
      e.preventDefault();
      ctrl.exec({ kind: "insertText", text: "" }); // snapshot
      const sel = window.getSelection();
      if (sel && sel.rangeCount > 0) {
        const r = sel.getRangeAt(0);
        r.deleteContents();
        const tpl = document.createElement("div");
        tpl.innerHTML = sanitizeHtml(html);
        const frag = document.createDocumentFragment();
        while (tpl.firstChild) frag.appendChild(tpl.firstChild);
        r.insertNode(frag);
        r.collapse(false);
      }
    } else if (text) {
      e.preventDefault();
      ctrl.exec({ kind: "insertText", text });
    }
  };

  const exportHtml = () => {
    const blob = new Blob(
      [`<!doctype html><meta charset="utf-8"><body>${ctrl.getHtml()}</body>`],
      { type: "text/html" },
    );
    triggerDownload(blob, "document.html");
  };
  const exportMd = () => {
    const md = htmlToMd(ctrl.getHtml());
    triggerDownload(new Blob([md], { type: "text/markdown" }), "document.md");
  };
  const importMd = () => {
    const inp = document.createElement("input");
    inp.type = "file"; inp.accept = ".md,text/markdown,text/plain";
    inp.onchange = async () => {
      const f = inp.files?.[0]; if (!f) return;
      const text = await f.text();
      ctrl.setHtml(mdToHtml(text));
    };
    inp.click();
  };

  // ----- find/replace -----
  function doFind(direction: 1 | -1 = 1) {
    if (!editorRef.current || !findQuery) return;
    const win = window;
    const sel = win.getSelection();
    sel?.removeAllRanges();
    // Simple: use window.find when available; otherwise text node walk.
    const w: any = win;
    if (typeof w.find === "function") {
      w.find(findQuery, false, direction === -1, true, false, true, false);
      return;
    }
  }
  function doReplace(all = false) {
    if (!editorRef.current || !findQuery) return;
    const html = ctrl.getHtml();
    const re = new RegExp(escapeRe(findQuery), all ? "g" : "");
    const next = html.replace(re, replaceQuery);
    ctrl.setHtml(next);
  }
  const t = useT();

  return (

    <div
      className={`oo-root oo-doc ${className ?? ""}`}
      style={{ display: "flex", flexDirection: "column", height: "100%", ...style }}
    >
      <div
        className="oo-toolbar"
        style={{
          display: "flex",
          flexWrap: "wrap",
          gap: 4,
          padding: 8,
          borderBottom: "1px solid var(--oo-color-border)",
          background: "var(--oo-color-bg-alt, var(--oo-color-bg))",
        }}
      >
        <button className="oo-btn" disabled={!state.canUndo} title={t("common.undo")} onClick={() => ctrl.undo()}><IconRedo style={{ transform: "scaleX(-1)" }} /></button>
        <button className="oo-btn" disabled={!state.canRedo} title={t("common.redo")} onClick={() => ctrl.redo()}><IconRedo /></button>
        <span className="oo-sep" />
        <select
          className="oo-btn"
          onChange={(e) => ctrl.exec({ kind: "setBlock", tag: e.target.value as any })}
          defaultValue="p"
          title={t("doc.blockStyle")}
        >
          <option value="p">Body</option>
          <option value="h1">Heading 1</option>
          <option value="h2">Heading 2</option>
          <option value="h3">Heading 3</option>
          <option value="h4">Heading 4</option>
          <option value="h5">Heading 5</option>
          <option value="h6">Heading 6</option>
          <option value="blockquote">Quote</option>
          <option value="pre">Code</option>
        </select>
        <select
          className="oo-btn"
          defaultValue=""
          title={t("doc.fontSize")}
          onChange={(e) => {
            const v = parseInt(e.target.value, 10);
            if (v) ctrl.exec({ kind: "fontSize", px: v });
            e.currentTarget.value = "";
          }}
        >
          <option value="">Size</option>
          {[10, 12, 14, 16, 18, 20, 24, 30, 36, 48, 60].map((s) => (
            <option key={s} value={s}>{s}</option>
          ))}
        </select>
        <span className="oo-sep" />
        <button className="oo-btn" title={t("doc.bold")} onClick={() => ctrl.exec({ kind: "toggleMark", tag: "b" })}><IconBold /></button>
        <button className="oo-btn" title={t("doc.italic")} onClick={() => ctrl.exec({ kind: "toggleMark", tag: "i" })}><IconItalic /></button>
        <button className="oo-btn" title={t("doc.underline")} onClick={() => ctrl.exec({ kind: "toggleMark", tag: "u" })}><IconUnderline /></button>
        <button className="oo-btn" title={t("doc.strike")} onClick={() => ctrl.exec({ kind: "toggleMark", tag: "s" })}>S̶</button>
        <button className="oo-btn" title={t("doc.code")} onClick={() => ctrl.exec({ kind: "toggleMark", tag: "code" })}>{`<>`}</button>
        <span className="oo-sep" />
        <button className="oo-btn" title={t("doc.alignLeft")} onClick={() => ctrl.exec({ kind: "align", value: "left" })}><IconAlignLeft /></button>
        <button className="oo-btn" title={t("doc.alignCenter")} onClick={() => ctrl.exec({ kind: "align", value: "center" })}><IconAlignCenter /></button>
        <button className="oo-btn" title={t("doc.alignRight")} onClick={() => ctrl.exec({ kind: "align", value: "right" })}><IconAlignRight /></button>
        <button className="oo-btn" title={t("doc.alignJustify")} onClick={() => ctrl.exec({ kind: "align", value: "justify" })}>≋</button>
        <span className="oo-sep" />
        <button className="oo-btn" title={t("doc.bulletList")} onClick={() => ctrl.exec({ kind: "list", ordered: false })}>• List</button>
        <button className="oo-btn" title={t("doc.numberedList")} onClick={() => ctrl.exec({ kind: "list", ordered: true })}>1. List</button>
        <button className="oo-btn" title={t("doc.checklist")} onClick={() => ctrl.exec({ kind: "checklist" })}>☑ List</button>
        <button className="oo-btn" title={t("doc.divider")} onClick={() => ctrl.exec({ kind: "hr" })}>―</button>
        <span className="oo-sep" />
        <button
          className="oo-btn"
          title={t("doc.link")}
          onClick={() => {
            const href = prompt("Link URL (empty to remove)") ?? "";
            ctrl.exec({ kind: "link", href: href.trim() === "" ? null : href });
          }}
        >🔗</button>
        <button
          className="oo-btn"
          title={t("doc.table")}
          onClick={() => ctrl.exec({ kind: "table", rows: 3, cols: 3 })}
        >▦</button>
        <button
          className="oo-btn"
          title={t("doc.image")}
          onClick={() => {
            const src = prompt("Image URL"); if (src) ctrl.exec({ kind: "image", src });
          }}
        >🖼</button>
        <input
          type="color"
          className="oo-btn"
          title={t("doc.textColor")}
          onChange={(e) => ctrl.exec({ kind: "color", value: e.target.value })}
          style={{ width: 32, padding: 2 }}
        />
        <input
          type="color"
          className="oo-btn"
          title={t("doc.highlight")}
          onChange={(e) => ctrl.exec({ kind: "highlight", value: e.target.value })}
          style={{ width: 32, padding: 2 }}
        />
        <span style={{ marginLeft: "auto" }} />
        <button className="oo-btn" title={t("common.findShortcut")} onClick={() => setFindOpen((v) => !v)}>🔍</button>
        {!hideImport && (
          <button className="oo-btn" title={t("doc.importMd")} onClick={importMd}><IconUpload /></button>
        )}
        {!hideExport && (
          <>
            <button className="oo-btn" title={t("doc.exportMd")} onClick={exportMd}>MD</button>
            <button className="oo-btn" title={t("doc.exportHtml")} onClick={exportHtml}><IconDownload /></button>
          </>
        )}
      </div>

      <div style={{ flex: 1, display: "flex", minHeight: 0 }}>
        <div
          ref={editorRef}
          className="oo-doc-page"
          contentEditable={!readOnly}
          suppressContentEditableWarning
          spellCheck
          onInput={onInput}
          onKeyDown={onKeyDown}
          onPaste={onPaste}
          style={{
            flex: 1,
            overflow: "auto",
            padding: "48px max(48px, 8%)",
            background: "var(--oo-color-bg)",
            color: "var(--oo-color-fg)",
            outline: "none",
            lineHeight: 1.6,
            fontSize: 15,
          }}
        />
        {placeholderOptions && placeholderOptions.length > 0 && (
          <PlaceholderPalette
            options={placeholderOptions}
            detected={detectedPlaceholders}
            onInsert={(ph) => ctrl.exec({ kind: "insertHtml", html: buildChipHtml(ph) })}
          />
        )}
      </div>

      {findOpen && (
        <div
          style={{
            position: "absolute",
            top: 56,
            right: 16,
            background: "var(--oo-color-bg)",
            border: "1px solid var(--oo-color-border)",
            borderRadius: 6,
            padding: 8,
            display: "flex",
            gap: 4,
            zIndex: 20,
            boxShadow: "0 4px 12px rgba(0,0,0,0.1)",
          }}
        >
          <input
            value={findQuery}
            onChange={(e) => setFindQuery(e.target.value)}
            placeholder={t("common.find")}
            className="oo-btn"
            style={{ width: 140 }}
          />
          <input
            value={replaceQuery}
            onChange={(e) => setReplaceQuery(e.target.value)}
            placeholder={t("common.replace")}
            className="oo-btn"
            style={{ width: 140 }}
          />
          <button className="oo-btn" onClick={() => doFind(1)}>↓</button>
          <button className="oo-btn" onClick={() => doReplace(false)}>{t("common.replace")}</button>
          <button className="oo-btn" onClick={() => doReplace(true)}>{t("common.replaceAll")}</button>
          <button className="oo-btn" onClick={() => setFindOpen(false)}>×</button>
        </div>
      )}

      {slash && filteredSlash.length > 0 && (
        <div
          style={{
            position: "fixed",
            left: slash.x,
            top: slash.y,
            background: "var(--oo-color-bg)",
            border: "1px solid var(--oo-color-border)",
            borderRadius: 6,
            padding: 4,
            zIndex: 30,
            boxShadow: "0 4px 12px rgba(0,0,0,0.15)",
            minWidth: 180,
            maxHeight: 240,
            overflow: "auto",
          }}
        >
          {filteredSlash.map((it) => (
            <div
              key={it.label}
              className="oo-menu-item"
              style={{ padding: "6px 10px", cursor: "pointer", borderRadius: 4 }}
              onMouseEnter={(e) => (e.currentTarget.style.background = "var(--oo-color-selection, rgba(37,99,235,0.1))")}
              onMouseLeave={(e) => (e.currentTarget.style.background = "")}
              onMouseDown={(e) => {
                e.preventDefault();
                // Remove '/query' before running
                const sel = window.getSelection();
                if (sel && sel.rangeCount > 0) {
                  const r = sel.getRangeAt(0);
                  const node = r.startContainer;
                  const txt = node.textContent ?? "";
                  const before = txt.slice(0, r.startOffset);
                  const m = before.match(/\/([\w-]*)$/);
                  if (m && node.nodeType === Node.TEXT_NODE) {
                    (node as Text).deleteData(r.startOffset - m[0].length, m[0].length);
                  }
                }
                it.run();
                setSlash(null);
              }}
            >
              {it.label}
            </div>
          ))}
        </div>
      )}

      <div
        style={{
          padding: "4px 12px",
          fontSize: 12,
          color: "var(--oo-color-muted, #888)",
          borderTop: "1px solid var(--oo-color-border)",
          display: "flex",
          gap: 16,
          background: "var(--oo-color-bg-alt, var(--oo-color-bg))",
        }}
      >
        <span>{state.words} palavras</span>
        <span>{state.chars} caracteres</span>
        <span>~{Math.max(1, Math.ceil(state.words / 200))} min de leitura</span>
      </div>
    </div>
  );
}

function triggerDownload(blob: Blob, filename: string) {
  const a = document.createElement("a");
  a.href = URL.createObjectURL(blob);
  a.download = filename;
  a.click();
  URL.revokeObjectURL(a.href);
}

function escapeRe(s: string) { return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"); }

function sanitizeHtml(html: string): string {
  // Basic sanitizer: drop <script>, on* attributes, javascript: URLs.
  const tpl = document.createElement("template");
  tpl.innerHTML = html;
  const walk = (root: Node) => {
    const els = (root as Element).querySelectorAll?.("*") ?? [];
    els.forEach((el) => {
      if (/^(script|iframe|object|embed|style|meta|link)$/i.test(el.tagName)) {
        el.remove();
        return;
      }
      [...el.attributes].forEach((a) => {
        const n = a.name.toLowerCase();
        if (n.startsWith("on")) el.removeAttribute(a.name);
        if ((n === "href" || n === "src") && /^\s*javascript:/i.test(a.value)) {
          el.removeAttribute(a.name);
        }
      });
    });
  };
  walk(tpl.content);
  return tpl.innerHTML;
}

export default Doc;
