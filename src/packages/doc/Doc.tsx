// @orbitoffice/doc — main editor UI built on the controller.
import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  IconAlignCenter,
  IconAlignJustify,
  IconAlignLeft,
  IconAlignRight,
  IconBarChart,
  IconBookmark,
  IconBold,
  IconCheckSquare,
  IconClearFormatting,
  IconCode,
  IconDeleteCol,
  IconDeleteRow,
  IconDownload,
  IconFileText,
  IconFileWord,
  IconImage,
  IconInsertColLeft,
  IconInsertColRight,
  IconInsertRowAbove,
  IconInsertRowBelow,
  IconItalic,
  IconLineHeight,
  IconLink,
  IconList,
  IconListOrdered,
  IconMessageSquare,
  IconMinus,
  IconPageBreak,
  IconPanelLeft,
  IconPrinter,
  IconRedo,
  IconRefreshCw,
  IconSearch,
  IconSettings,
  IconSheet,
  IconSigma,
  IconStrikethrough,
  IconSubscript,
  IconSuperscript,
  IconToc,
  IconType,
  IconUnderline,
  IconUndo,
  IconUpload,
} from "../icons";
import { useStore } from "../core/store";
import { createDocController } from "./controller";
import {
  buildChipHtml,
  extractPlaceholders,
  serializeHtmlForGenerate,
  wrapLiteralPlaceholders,
} from "./placeholders";
import { PlaceholderPalette } from "./PlaceholderPalette";
import type { MappingOption, SmartDocPlaceholder } from "../core/smartDocs";
import { useT } from "../core/i18n";

// Heavy sub-features are lazy-loaded on first use to keep the Doc chunk lean.
// Each import() call produces its own rollup chunk that the consumer's bundler
// splits further — users who never export to Word, use math, etc. pay zero cost.
const lazyMarkdown = () => import("./markdown");
const lazyToc      = () => import("./toc");
const lazyMath     = () => import("./mathRender");
const lazyDocx     = () => import("./docxIO");

const PRESET_TEXT_COLORS = [
  "#000000","#374151","#dc2626","#ea580c","#d97706","#16a34a","#2563eb","#7c3aed",
  "#db2777","#0891b2","#65a30d","#9f1239",
];
const PRESET_BG_COLORS = [
  "#fef08a","#bbf7d0","#bfdbfe","#fecaca","#fde68a","#d1fae5","#e0e7ff","#fce7f3",
  "#f0f9ff","#f0fdf4","#fff7ed","#fdf4ff",
];

function ColorPick({ title, icon, apply }: { title: string; icon: string; apply: (c: string) => void }) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const colors = icon === "A" ? PRESET_TEXT_COLORS : PRESET_BG_COLORS;
  useEffect(() => {
    if (!open) return;
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [open]);
  return (
    <div ref={ref} style={{ position: "relative" }}>
      <button className="oo-btn" title={title} onClick={() => setOpen((v) => !v)}
        style={{ display: "flex", flexDirection: "column", alignItems: "center", fontSize: 12, gap: 1, padding: "2px 6px" }}>
        <span style={{ fontWeight: 700 }}>{icon}</span>
        <span style={{ width: 14, height: 3, background: icon === "A" ? "#dc2626" : "#fef08a", borderRadius: 1 }} />
      </button>
      {open && (
        <div style={{
          position: "absolute", top: "calc(100% + 4px)", left: 0, zIndex: 50,
          background: "var(--oo-color-bg)", border: "1px solid var(--oo-color-border)",
          borderRadius: 6, padding: 8, boxShadow: "0 4px 16px rgba(0,0,0,0.15)",
          display: "grid", gridTemplateColumns: "repeat(6, 20px)", gap: 3, width: 162,
        }}>
          {colors.map((c) => (
            <button key={c} title={c}
              style={{ width: 20, height: 20, background: c, border: "2px solid rgba(0,0,0,0.12)", borderRadius: 3, cursor: "pointer", padding: 0 }}
              onMouseDown={(e) => { e.preventDefault(); apply(c); setOpen(false); }}
            />
          ))}
          <input type="color" title="Custom color"
            style={{ gridColumn: "1 / -1", width: "100%", height: 24, marginTop: 4, cursor: "pointer", border: "none", borderRadius: 3 }}
            onChange={(e) => apply(e.target.value)}
          />
        </div>
      )}
    </div>
  );
}

/* ─────────────────────────── Heading Navigator ─────────────────────────── */

function NavigatorPanel({ editorRef, onClose }: { editorRef: React.RefObject<HTMLDivElement>; onClose: () => void }) {
  const [headings, setHeadings] = useState<{ tag: string; text: string; el: HTMLElement }[]>([]);
  useEffect(() => {
    const update = () => {
      if (!editorRef.current) return;
      setHeadings(
        Array.from(editorRef.current.querySelectorAll("h1,h2,h3,h4,h5,h6")).map((h) => ({
          tag: h.tagName.toLowerCase(), text: (h as HTMLElement).innerText ?? h.textContent ?? "", el: h as HTMLElement,
        })),
      );
    };
    const obs = new MutationObserver(update);
    if (editorRef.current) obs.observe(editorRef.current, { childList: true, subtree: true, characterData: true });
    update();
    return () => obs.disconnect();
  }, [editorRef]);

  const indent: Record<string, number> = { h1: 0, h2: 12, h3: 22, h4: 32, h5: 40, h6: 48 };
  return (
    <aside className="oo-doc-navigator" style={{
      width: 216, borderRight: "1px solid var(--oo-color-border)", flexShrink: 0,
      background: "var(--oo-color-bg-alt, var(--oo-color-bg))", display: "flex", flexDirection: "column", overflow: "hidden",
    }}>
      <div style={{ padding: "7px 10px", display: "flex", justifyContent: "space-between", alignItems: "center", borderBottom: "1px solid var(--oo-color-border)" }}>
        <span style={{ fontWeight: 600, fontSize: 12, opacity: 0.8 }}>Navigation</span>
        <button className="oo-btn" style={{ padding: "1px 5px", fontSize: 13 }} onClick={onClose}>×</button>
      </div>
      <div style={{ flex: 1, overflow: "auto", padding: "4px 0" }}>
        {headings.length === 0
          ? <div style={{ padding: "12px", fontSize: 12, opacity: 0.45 }}>No headings yet</div>
          : headings.map((h, i) => (
            <button key={i} onClick={() => h.el.scrollIntoView({ behavior: "smooth", block: "center" })}
              style={{
                display: "block", width: "100%", textAlign: "left",
                padding: `4px 10px 4px ${10 + indent[h.tag]}px`,
                fontSize: h.tag === "h1" ? 13 : 12,
                fontWeight: h.tag === "h1" || h.tag === "h2" ? 600 : 400,
                opacity: h.tag === "h4" || h.tag === "h5" || h.tag === "h6" ? 0.65 : 1,
                color: "var(--oo-color-fg)", background: "none", border: "none", cursor: "pointer",
                overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap",
              }}
              title={h.text}
            >
              {h.text || "(empty)"}
            </button>
          ))
        }
      </div>
    </aside>
  );
}

/* ─────────────────────────── Comments Panel ─────────────────────────── */

function CommentsPanel({
  editorRef, comments, onResolve, onDelete, onClose,
}: {
  editorRef: React.RefObject<HTMLDivElement>;
  comments: Record<string, { text: string; resolved: boolean }>;
  onResolve: (cid: string) => void;
  onDelete: (cid: string) => void;
  onClose: () => void;
}) {
  const entries = Object.entries(comments);
  const active = entries.filter(([, c]) => !c.resolved).length;
  return (
    <aside className="oo-doc-comments" style={{
      width: 256, borderLeft: "1px solid var(--oo-color-border)", flexShrink: 0,
      background: "var(--oo-color-bg-alt, var(--oo-color-bg))", display: "flex", flexDirection: "column", overflow: "hidden",
    }}>
      <div style={{ padding: "7px 10px", display: "flex", justifyContent: "space-between", alignItems: "center", borderBottom: "1px solid var(--oo-color-border)" }}>
        <span style={{ fontWeight: 600, fontSize: 12, opacity: 0.8 }}>Comments {active > 0 ? `(${active})` : ""}</span>
        <button className="oo-btn" style={{ padding: "1px 5px", fontSize: 13 }} onClick={onClose}>×</button>
      </div>
      <div style={{ flex: 1, overflow: "auto" }}>
        {entries.length === 0
          ? <div style={{ padding: "12px", fontSize: 12, opacity: 0.45 }}>No comments yet. Select text and click the comment button.</div>
          : entries.map(([cid, comment]) => (
            <div key={cid} style={{ padding: "10px 12px", borderBottom: "1px solid var(--oo-color-border)", opacity: comment.resolved ? 0.45 : 1 }}>
              <div style={{ fontSize: 12, lineHeight: 1.45, marginBottom: 6 }}>{comment.text}</div>
              {comment.resolved && <div style={{ fontSize: 10, color: "#16a34a", marginBottom: 4 }}>Resolved</div>}
              <div style={{ display: "flex", gap: 4 }}>
                {!comment.resolved && (
                  <button className="oo-btn" style={{ fontSize: 10, padding: "1px 7px" }}
                    onClick={() => { const m = editorRef.current?.querySelector(`mark.oo-comment[data-cid="${cid}"]`); m?.scrollIntoView({ behavior: "smooth", block: "center" }); }}>
                    Find
                  </button>
                )}
                {!comment.resolved && (
                  <button className="oo-btn" style={{ fontSize: 10, padding: "1px 7px", color: "#16a34a" }}
                    onClick={() => onResolve(cid)}>Resolve</button>
                )}
                <button className="oo-btn" style={{ fontSize: 10, padding: "1px 7px", color: "#ef4444" }}
                  onClick={() => onDelete(cid)}>Delete</button>
              </div>
            </div>
          ))
        }
      </div>
    </aside>
  );
}

/* ─────────────────────────── Print Preview ─────────────────────────── */

function PrintPreviewModal({ html, onClose }: { html: string; onClose: () => void }) {
  return (
    <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.75)", zIndex: 100, display: "flex", flexDirection: "column" }}>
      <div style={{ padding: "10px 16px", display: "flex", gap: 8, background: "#1f2937", alignItems: "center" }}>
        <span style={{ color: "white", fontWeight: 600, fontSize: 14, flex: 1 }}>Print Preview — A4</span>
        <button onClick={() => window.print()} style={{ padding: "5px 14px", background: "#2563eb", color: "white", border: "none", borderRadius: 4, cursor: "pointer", fontWeight: 600, fontSize: 13 }}>Print / PDF</button>
        <button onClick={onClose} style={{ padding: "5px 12px", background: "#4b5563", color: "white", border: "none", borderRadius: 4, cursor: "pointer", fontSize: 13 }}>Close</button>
      </div>
      <div style={{ flex: 1, overflow: "auto", padding: "32px 20px", background: "#374151" }}>
        <div
          style={{ width: 794, minHeight: 1123, background: "white", margin: "0 auto", padding: "80px 72px", boxShadow: "0 4px 24px rgba(0,0,0,0.35)", color: "#000", fontSize: 14, lineHeight: 1.6 }}
          dangerouslySetInnerHTML={{ __html: html }}
        />
      </div>
    </div>
  );
}

/* ─────────────────────────── Word Statistics ─────────────────────────── */

function WordStatsModal({ editorRef, onClose }: { editorRef: React.RefObject<HTMLDivElement>; onClose: () => void }) {
  const text = editorRef.current?.innerText ?? "";
  const words = (text.trim().match(/\S+/g) ?? []).length;
  const chars = text.length;
  const charsNoSpaces = text.replace(/\s/g, "").length;
  const paragraphs = editorRef.current?.querySelectorAll("p").length ?? 0;
  const headings = editorRef.current?.querySelectorAll("h1,h2,h3,h4,h5,h6").length ?? 0;
  const sentences = (text.match(/[.!?]+(\s|$)/g) ?? []).length;
  const readingTime = Math.max(1, Math.round(words / 200));
  const rows: [string, string | number][] = [
    ["Words", words], ["Characters (with spaces)", chars], ["Characters (no spaces)", charsNoSpaces],
    ["Sentences", sentences], ["Paragraphs", paragraphs], ["Headings", headings],
    ["Estimated reading time", `~${readingTime} min`],
  ];
  return (
    <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.35)", zIndex: 50, display: "flex", alignItems: "center", justifyContent: "center" }}
      onClick={onClose}>
      <div style={{ background: "var(--oo-color-bg)", borderRadius: 10, padding: "24px", width: 360, boxShadow: "0 8px 32px rgba(0,0,0,0.2)" }}
        onClick={(e) => e.stopPropagation()}>
        <div style={{ fontWeight: 700, fontSize: 16, marginBottom: 16 }}>Document Statistics</div>
        {rows.map(([label, val]) => (
          <div key={label} style={{ display: "flex", justifyContent: "space-between", padding: "7px 0", borderBottom: "1px solid var(--oo-color-border)", fontSize: 13 }}>
            <span style={{ opacity: 0.65 }}>{label}</span>
            <span style={{ fontWeight: 600 }}>{val}</span>
          </div>
        ))}
        <button onClick={onClose} style={{ marginTop: 16, width: "100%", padding: "8px", background: "var(--oo-color-primary, #2563eb)", color: "white", border: "none", borderRadius: 6, cursor: "pointer", fontWeight: 600 }}>Close</button>
      </div>
    </div>
  );
}

/* ─────────────────────────── Ribbon group ─────────────────────────── */

function ToolGrp({ label, children, end }: { label: string; children: React.ReactNode; end?: boolean }) {
  return (
    <div style={{
      display: "flex", flexDirection: "column", flexShrink: 0,
      borderRight: end ? "none" : "1px solid var(--oo-color-border)",
    }}>
      <div style={{
        display: "flex", flex: 1, flexWrap: "wrap", gap: 2,
        padding: "5px 7px 3px", alignItems: "center",
      }}>
        {children}
      </div>
      <div style={{
        fontSize: 10, color: "var(--oo-color-fg-muted, #888)",
        textAlign: "center", padding: "1px 6px 3px",
        borderTop: "1px solid var(--oo-color-border)",
        userSelect: "none", whiteSpace: "nowrap",
      }}>
        {label}
      </div>
    </div>
  );
}

/* ─────────────────────────── Text Effects Popover ─────────────────────────── */

const TEXT_SHADOW_PRESETS = [
  { label: "None", value: null },
  { label: "Light", value: "1px 1px 3px rgba(0,0,0,0.25)" },
  { label: "Medium", value: "2px 2px 6px rgba(0,0,0,0.4)" },
  { label: "Heavy", value: "3px 3px 8px rgba(0,0,0,0.6)" },
  { label: "Glow Blue", value: "0 0 8px rgba(37,99,235,0.8)" },
  { label: "Glow Red", value: "0 0 8px rgba(220,38,38,0.8)" },
  { label: "Glow Green", value: "0 0 8px rgba(22,163,74,0.8)" },
];

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
  const [findCount, setFindCount] = useState({ total: 0, current: 0 });
  const findIndexRef = useRef(-1);
  const [inTable, setInTable] = useState(false);
  const [mathOpen, setMathOpen] = useState(false);
  const [mathTex, setMathTex] = useState("");
  const [lineSpacing, setLineSpacing] = useState("1.6");
  const [letterSpacing, setLetterSpacingState] = useState(0);
  const [navigatorOpen, setNavigatorOpen] = useState(false);
  const [commentsOpen, setCommentsOpen] = useState(false);
  const [printPreviewOpen, setPrintPreviewOpen] = useState(false);
  const [statsOpen, setStatsOpen] = useState(false);
  const [pageSettingsOpen, setPageSettingsOpen] = useState(false);
  const [textEffectsOpen, setTextEffectsOpen] = useState(false);
  const [comments, setComments] = useState<Record<string, { text: string; resolved: boolean }>>({});
  const [pageMargins, setPageMargins] = useState(48);
  const [pageColumns, setPageColumns] = useState(1);
  const [pageOrientation, setPageOrientation] = useState<"portrait" | "landscape">("portrait");
  const [ribbonTab, setRibbonTab] = useState("home");
  const [pageBgType, setPageBgType] = useState<"none" | "color" | "image">("none");
  const [pageBgValue, setPageBgValue] = useState("");
  const [showHeader, setShowHeader] = useState(false);
  const [showFooter, setShowFooter] = useState(false);
  const [headerHtml, setHeaderHtml] = useState("");
  const [footerHtml, setFooterHtml] = useState("");
  const [bgDialogOpen, setBgDialogOpen] = useState(false);
  // Populated on first open of the math dialog; null while the chunk is loading.
  const [renderMathFn, setRenderMathFn] = useState<((tex: string) => string) | null>(null);
  const headerRef = useRef<HTMLDivElement>(null);
  const footerRef = useRef<HTMLDivElement>(null);
  const commentCidRef = useRef(0);
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

  // Load math renderer chunk only when the dialog is first opened.
  useEffect(() => {
    if (!mathOpen || renderMathFn) return;
    lazyMath().then((m) => setRenderMathFn(() => m.renderMath));
  }, [mathOpen, renderMathFn]);

  // detect when cursor is inside a table
  useEffect(() => {
    const onSel = () => {
      const sel = window.getSelection();
      if (!sel || !editorRef.current) { setInTable(false); return; }
      let n: Node | null = sel.anchorNode;
      while (n && n !== editorRef.current) {
        if (n.nodeType === 1 && /^(TD|TH)$/.test((n as HTMLElement).tagName)) {
          setInTable(true); return;
        }
        n = n.parentNode;
      }
      setInTable(false);
    };
    document.addEventListener("selectionchange", onSel);
    return () => document.removeEventListener("selectionchange", onSel);
  }, []);

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
    { label: "Page break", run: () => ctrl.exec({ kind: "pageBreak" }) },
    { label: "Table of Contents", run: () => insertToc() },
    { label: "Math equation", run: () => setMathOpen(true) },
    {
      label: "Image (URL)",
      run: () => {
        const src = prompt("Image URL"); if (src) ctrl.exec({ kind: "image", src });
      },
    },
    { label: "Date field", run: () => ctrl.exec({ kind: "insertField", field: "date" }) },
    { label: "Time field", run: () => ctrl.exec({ kind: "insertField", field: "time" }) },
    {
      label: "Footnote",
      run: () => {
        const text = prompt("Footnote text:"); if (text) ctrl.exec({ kind: "insertFootnote", text });
      },
    },
    { label: "Comment", run: doAddComment },
  ], [ctrl]);

  const filteredSlash = useMemo(() => {
    const q = (slash?.query ?? "").toLowerCase();
    return slashItems().filter((i) => i.label.toLowerCase().includes(q));
  }, [slash, slashItems]);

  async function insertToc() {
    if (!editorRef.current) return;
    const { buildTocFromHtml } = await lazyToc();
    const entries = buildTocFromHtml(editorRef.current);
    if (entries.length === 0) return;
    const items = entries
      .map((e) => `<li style="margin-left:${(e.level - 1) * 16}px"><a href="#${e.id}">${e.text}</a></li>`)
      .join("");
    ctrl.exec({ kind: "insertHtml", html: `<nav class="oo-toc"><p><strong>Table of Contents</strong></p><ol>${items}</ol></nav>` });
  }

  function confirmMath() {
    if (!mathTex.trim() || !renderMathFn) return;
    ctrl.exec({ kind: "insertHtml", html: renderMathFn(mathTex) });
    setMathTex("");
    setMathOpen(false);
  }

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
      if (k === ",") { e.preventDefault(); ctrl.exec({ kind: "toggleMark", tag: "sub" }); return; }
      if (k === ".") { e.preventDefault(); ctrl.exec({ kind: "toggleMark", tag: "sup" }); return; }
      if (e.key === " ") { e.preventDefault(); ctrl.exec({ kind: "clearFormatting" }); return; }
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
  const exportMd = async () => {
    const { htmlToMd } = await lazyMarkdown();
    const md = htmlToMd(ctrl.getHtml());
    triggerDownload(new Blob([md], { type: "text/markdown" }), "document.md");
  };
  const importMd = () => {
    const inp = document.createElement("input");
    inp.type = "file"; inp.accept = ".md,text/markdown,text/plain";
    inp.onchange = async () => {
      const f = inp.files?.[0]; if (!f) return;
      const text = await f.text();
      const { mdToHtml } = await lazyMarkdown();
      ctrl.setHtml(mdToHtml(text));
    };
    inp.click();
  };

  // ----- comments -----
  function doAddComment() {
    const sel = window.getSelection();
    if (!sel || sel.isCollapsed) { alert("Select text first to add a comment."); return; }
    const text = prompt("Comment text:");
    if (!text) return;
    const cid = String(++commentCidRef.current);
    ctrl.exec({ kind: "addComment", cid });
    setComments((c) => ({ ...c, [cid]: { text, resolved: false } }));
    if (!commentsOpen) setCommentsOpen(true);
  }

  function resolveComment(cid: string) {
    ctrl.exec({ kind: "removeComment", cid });
    setComments((c) => ({ ...c, [cid]: { ...c[cid], resolved: true } }));
  }

  function deleteComment(cid: string) {
    ctrl.exec({ kind: "removeComment", cid });
    setComments((c) => {
      const next = { ...c };
      delete next[cid];
      return next;
    });
  }

  // ----- exports -----
  const exportTxt = () => {
    const text = editorRef.current?.innerText ?? "";
    triggerDownload(new Blob([text], { type: "text/plain" }), "document.txt");
  };

  // ----- find/replace -----
  function buildFindRanges(query: string): Range[] {
    if (!editorRef.current || !query) return [];
    const ranges: Range[] = [];
    const walker = document.createTreeWalker(editorRef.current, NodeFilter.SHOW_TEXT);
    const lower = query.toLowerCase();
    const len = query.length;
    let node: Text | null;
    while ((node = walker.nextNode() as Text | null)) {
      const text = (node.textContent ?? "").toLowerCase();
      let idx = 0;
      while ((idx = text.indexOf(lower, idx)) !== -1) {
        const r = document.createRange();
        r.setStart(node, idx);
        r.setEnd(node, idx + len);
        ranges.push(r);
        idx += len;
      }
    }
    return ranges;
  }

  function doFind(direction: 1 | -1 = 1) {
    if (!editorRef.current || !findQuery) { setFindCount({ total: 0, current: 0 }); return; }
    const matches = buildFindRanges(findQuery);
    if (matches.length === 0) { setFindCount({ total: 0, current: 0 }); return; }
    const total = matches.length;
    let idx = findIndexRef.current;
    idx = direction === 1 ? (idx + 1) % total : (idx - 1 + total) % total;
    findIndexRef.current = idx;
    setFindCount({ total, current: idx + 1 });
    const sel = window.getSelection();
    sel?.removeAllRanges();
    sel?.addRange(matches[idx]);
    (matches[idx].startContainer as Element).parentElement?.scrollIntoView({ behavior: "smooth", block: "center" });
  }

  function doReplace(all = false) {
    if (!editorRef.current || !findQuery) return;
    const html = ctrl.getHtml();
    const re = new RegExp(escapeRe(findQuery), all ? "gi" : "i");
    const next = html.replace(re, replaceQuery);
    if (next !== html) {
      ctrl.setHtml(next);
      findIndexRef.current = -1;
      if (!all) doFind(1);
    }
  }
  // reset find index when query changes
  useEffect(() => { findIndexRef.current = -1; setFindCount({ total: 0, current: 0 }); }, [findQuery]);

  const t = useT();

  return (

    <div
      className={`oo-root oo-doc ${className ?? ""}`}
      style={{ display: "flex", flexDirection: "column", height: "100%", ...style }}
    >
      <div className="oo-ribbon-tabs">
        {[
          { id: "home",   label: t("tab.home") },
          { id: "insert", label: t("tab.insert") },
          { id: "view",   label: t("tab.view") },
          { id: "export", label: t("tab.export") },
        ].map(({ id, label }) => (
          <button key={id}
            className={"oo-ribbon-tab" + (ribbonTab === id ? " oo-active" : "")}
            onClick={() => setRibbonTab(id)}>
            {label}
          </button>
        ))}
      </div>
      <div className="oo-ribbon-pane">
        {ribbonTab === "home" && <>
          {/* ── Histórico ── */}
          <ToolGrp label={t("grp.history")}>
            <button className="oo-btn" disabled={!state.canUndo} title={t("common.undo")} onClick={() => ctrl.undo()}><IconUndo />{t("lbl.undo")}</button>
            <button className="oo-btn" disabled={!state.canRedo} title={t("common.redo")} onClick={() => ctrl.redo()}><IconRedo />{t("lbl.redo")}</button>
          </ToolGrp>

          {/* ── Estilo ── */}
          <ToolGrp label={t("grp.style")}>
            <select
              className="oo-btn"
              onChange={(e) => ctrl.exec({ kind: "setBlock", tag: e.target.value as any })}
              defaultValue="p"
              title={t("doc.blockStyle")}
              style={{ minWidth: 110 }}
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
          </ToolGrp>

          {/* ── Fonte ── */}
          <ToolGrp label={t("grp.font")}>
            <select
              className="oo-btn"
              defaultValue=""
              title="Font family"
              style={{ minWidth: 90 }}
              onChange={(e) => {
                if (e.target.value) ctrl.exec({ kind: "fontFamily", value: e.target.value });
                e.currentTarget.value = "";
              }}
            >
              <option value="">Font</option>
              <option value="Arial">Arial</option>
              <option value="Arial Black">Arial Black</option>
              <option value="Calibri">Calibri</option>
              <option value="Courier New">Courier New</option>
              <option value="Georgia">Georgia</option>
              <option value="Impact">Impact</option>
              <option value="Times New Roman">Times New Roman</option>
              <option value="Trebuchet MS">Trebuchet MS</option>
              <option value="Verdana">Verdana</option>
            </select>
            <select
              className="oo-btn"
              defaultValue=""
              title={t("doc.fontSize")}
              style={{ width: 58 }}
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
            <button className="oo-btn" title={t("doc.strike")} onClick={() => ctrl.exec({ kind: "toggleMark", tag: "s" })}><IconStrikethrough />{t("lbl.strike")}</button>
            <button className="oo-btn" title={t("doc.code")} onClick={() => ctrl.exec({ kind: "toggleMark", tag: "code" })}><IconCode />{t("lbl.code")}</button>
            <button className="oo-btn" title="Subscript (Ctrl+,)" onClick={() => ctrl.exec({ kind: "toggleMark", tag: "sub" })}><IconSubscript />{t("lbl.sub")}</button>
            <button className="oo-btn" title="Superscript (Ctrl+.)" onClick={() => ctrl.exec({ kind: "toggleMark", tag: "sup" })}><IconSuperscript />{t("lbl.sup")}</button>
            <span className="oo-sep" />
            <ColorPick title={t("doc.textColor")} icon="A" apply={(c) => ctrl.exec({ kind: "color", value: c })} />
            <ColorPick title={t("doc.highlight")} icon="H" apply={(c) => ctrl.exec({ kind: "highlight", value: c })} />
            <button className="oo-btn" title="Clear formatting (Ctrl+Space)" onClick={() => ctrl.exec({ kind: "clearFormatting" })}><IconClearFormatting />{t("lbl.clearFormat")}</button>
          </ToolGrp>

          {/* ── Parágrafo ── */}
          <ToolGrp label={t("grp.paragraph")}>
            <button className="oo-btn" title={t("doc.alignLeft")} onClick={() => ctrl.exec({ kind: "align", value: "left" })}><IconAlignLeft /></button>
            <button className="oo-btn" title={t("doc.alignCenter")} onClick={() => ctrl.exec({ kind: "align", value: "center" })}><IconAlignCenter /></button>
            <button className="oo-btn" title={t("doc.alignRight")} onClick={() => ctrl.exec({ kind: "align", value: "right" })}><IconAlignRight /></button>
            <button className="oo-btn" title={t("doc.alignJustify")} onClick={() => ctrl.exec({ kind: "align", value: "justify" })}><IconAlignJustify /></button>
            <span className="oo-sep" />
            <button className="oo-btn" title={t("doc.bulletList")} onClick={() => ctrl.exec({ kind: "list", ordered: false })}><IconList />{t("lbl.list")}</button>
            <button className="oo-btn" title={t("doc.numberedList")} onClick={() => ctrl.exec({ kind: "list", ordered: true })}><IconListOrdered />{t("lbl.orderedList")}</button>
            <button className="oo-btn" title={t("doc.checklist")} onClick={() => ctrl.exec({ kind: "checklist" })}><IconCheckSquare />{t("lbl.checklist")}</button>
            <button className="oo-btn" title={t("doc.divider")} onClick={() => ctrl.exec({ kind: "hr" })}><IconMinus />{t("lbl.divider")}</button>
            <span className="oo-sep" />
            <span style={{ display: "flex", alignItems: "center", gap: 2 }}>
              <IconLineHeight style={{ opacity: 0.5, flexShrink: 0 }} />
              <select className="oo-btn" title="Line spacing" value={lineSpacing}
                onChange={(e) => setLineSpacing(e.target.value)} style={{ minWidth: 56 }}>
                <option value="1">1.0×</option>
                <option value="1.15">1.15×</option>
                <option value="1.5">1.5×</option>
                <option value="1.6">1.6×</option>
                <option value="2">2.0×</option>
                <option value="2.5">2.5×</option>
              </select>
            </span>
            <span style={{ display: "flex", alignItems: "center", gap: 2 }} title="Letter spacing (px)">
              <IconType style={{ opacity: 0.5, flexShrink: 0 }} />
              <input type="number" min={-3} max={20} step={0.5} value={letterSpacing}
                className="oo-btn" style={{ width: 46, padding: "0 4px", fontSize: 11, textAlign: "center" }}
                onChange={(e) => {
                  const v = parseFloat(e.target.value) || 0;
                  setLetterSpacingState(v);
                  ctrl.exec({ kind: "letterSpacing", value: v });
                }} />
            </span>
            <div style={{ position: "relative" }}>
              <button className="oo-btn" title="Text effects (shadow)" onClick={() => setTextEffectsOpen((v) => !v)}
                style={{ fontWeight: 700, fontSize: 12, textShadow: "1px 1px 3px rgba(0,0,0,0.4)" }}>Fx</button>
              {textEffectsOpen && (
                <div style={{ position: "absolute", top: "calc(100% + 4px)", left: 0, zIndex: 30, background: "var(--oo-color-bg)", border: "1px solid var(--oo-color-border)", borderRadius: 6, padding: 6, boxShadow: "0 4px 16px rgba(0,0,0,0.15)", minWidth: 140 }}>
                  {TEXT_SHADOW_PRESETS.map((p) => (
                    <button key={p.label} className="oo-btn"
                      style={{ display: "block", width: "100%", textAlign: "left", marginBottom: 2, fontSize: 12, textShadow: p.value ?? "none" }}
                      onMouseDown={(e) => { e.preventDefault(); ctrl.exec({ kind: "textShadow", value: p.value }); setTextEffectsOpen(false); }}>
                      {p.label}
                    </button>
                  ))}
                </div>
              )}
            </div>
          </ToolGrp>
        </>}

        {ribbonTab === "insert" && <>
          {/* ── Inserir ── */}
          <ToolGrp label={t("grp.insert")}>
            <button
              className="oo-btn"
              title={t("doc.link")}
              onClick={() => {
                const href = prompt("Link URL (empty to remove)") ?? "";
                ctrl.exec({ kind: "link", href: href.trim() === "" ? null : href });
              }}
            ><IconLink />{t("lbl.link")}</button>
            <button
              className="oo-btn"
              title={t("doc.table")}
              onClick={() => ctrl.exec({ kind: "table", rows: 3, cols: 3 })}
            ><IconSheet />{t("lbl.table")}</button>
            <button
              className="oo-btn"
              title={t("doc.image")}
              onClick={() => {
                const src = prompt("Image URL"); if (src) ctrl.exec({ kind: "image", src });
              }}
            ><IconImage />{t("lbl.image")}</button>
            <button className="oo-btn" title="Insert math equation" onClick={() => setMathOpen(true)}><IconSigma />{t("lbl.math")}</button>
            <button className="oo-btn" title="Table of Contents" onClick={insertToc}><IconToc />{t("lbl.toc")}</button>
            <button className="oo-btn" title="Page break" onClick={() => ctrl.exec({ kind: "pageBreak" })}><IconPageBreak />{t("lbl.pageBreak")}</button>
          </ToolGrp>

          {/* ── Conteúdo ── */}
          <ToolGrp label={t("grp.content")}>
            <button className="oo-btn" title="Insert date field (/date)" onClick={() => ctrl.exec({ kind: "insertField", field: "date" })}><IconRefreshCw />{t("lbl.dateField")}</button>
            <button className="oo-btn" title="Insert footnote (/footnote)"
              onClick={() => { const t2 = prompt("Footnote text:"); if (t2) ctrl.exec({ kind: "insertFootnote", text: t2 }); }}><IconBookmark />{t("lbl.footnote")}</button>
            <button className="oo-btn" title="Add comment" onClick={doAddComment}
              style={{ background: Object.values(comments).some((c) => !c.resolved) ? "rgba(255,220,0,0.2)" : undefined }}>
              <IconMessageSquare />{t("lbl.commentVerb")}
            </button>
          </ToolGrp>

          {/* ── Página ── */}
          <ToolGrp label={t("grp.page")}>
            <button className="oo-btn" title="Page settings" onClick={() => setPageSettingsOpen((v) => !v)}
              style={{ background: pageSettingsOpen ? "var(--oo-color-selection, rgba(37,99,235,0.1))" : undefined }}>
              <IconSettings />{t("lbl.pageSettings")}
            </button>
            <button className="oo-btn" title="Toggle header" onClick={() => setShowHeader((v) => !v)}
              style={{ background: showHeader ? "var(--oo-color-selection, rgba(37,99,235,0.1))" : undefined }}>
              ▤ {t("lbl.header")}
            </button>
            <button className="oo-btn" title="Toggle footer" onClick={() => setShowFooter((v) => !v)}
              style={{ background: showFooter ? "var(--oo-color-selection, rgba(37,99,235,0.1))" : undefined }}>
              ▤ {t("lbl.footer")}
            </button>
            <button className="oo-btn" title="Page background" onClick={() => setBgDialogOpen(true)}>
              <IconImage />{t("lbl.pageBg")}
            </button>
          </ToolGrp>
        </>}

        {ribbonTab === "view" && <>
          {/* ── Exibir ── */}
          <ToolGrp label={t("grp.view")}>
            <button className="oo-btn" title={t("common.findShortcut")} onClick={() => setFindOpen((v) => !v)}><IconSearch />{t("lbl.find")}</button>
            <button className="oo-btn" title="Document statistics" onClick={() => setStatsOpen(true)}><IconBarChart />{t("lbl.stats")}</button>
            <button className="oo-btn" title="Heading navigator" onClick={() => setNavigatorOpen((v) => !v)}
              style={{ background: navigatorOpen ? "var(--oo-color-selection, rgba(37,99,235,0.1))" : undefined }}>
              <IconPanelLeft />{t("lbl.navigator")}
            </button>
            <button className="oo-btn" title="Comments panel" onClick={() => setCommentsOpen((v) => !v)}
              style={{ background: commentsOpen ? "var(--oo-color-selection, rgba(37,99,235,0.1))" : undefined }}>
              <IconMessageSquare />{t("lbl.comments")}
            </button>
          </ToolGrp>
        </>}

        {ribbonTab === "export" && <>
          {/* ── Exportar ── */}
          <ToolGrp label={t("grp.export")}>
            {!hideImport && (
              <button className="oo-btn" title={t("doc.importMd")} onClick={importMd}><IconUpload />{t("lbl.importFile")}</button>
            )}
            {!hideExport && (
              <>
                <button className="oo-btn" title="Export TXT" onClick={exportTxt}><IconFileText />{t("lbl.exportTxt")}</button>
                <button className="oo-btn" title={t("doc.exportMd")} onClick={exportMd}>{t("lbl.exportMd")}</button>
                <button className="oo-btn" title={t("doc.exportHtml")} onClick={exportHtml}><IconDownload />{t("lbl.exportHtml")}</button>
                <button className="oo-btn" title="Export .docx (Word)" onClick={async () => { const { exportDocx } = await lazyDocx(); exportDocx(ctrl.getHtml()); }}><IconFileWord />{t("lbl.exportWord")}</button>
              </>
            )}
            <button className="oo-btn" title="Print preview" onClick={() => setPrintPreviewOpen(true)}><IconPrinter />{t("lbl.print")}</button>
          </ToolGrp>
        </>}
      </div>

      {inTable && (
        <div style={{
          display: "flex", gap: 4, padding: "4px 8px",
          borderBottom: "1px solid var(--oo-color-border)",
          background: "var(--oo-color-bg-alt, var(--oo-color-bg))",
          fontSize: 12,
        }}>
          <span style={{ opacity: 0.6, alignSelf: "center", fontWeight: 600 }}>Tabela:</span>
          <button className="oo-btn" title="Insert row above" onClick={() => ctrl.exec({ kind: "tableInsertRow", where: "above" })}><IconInsertRowAbove />{t("lbl.tableRowAbove")}</button>
          <button className="oo-btn" title="Insert row below" onClick={() => ctrl.exec({ kind: "tableInsertRow", where: "below" })}><IconInsertRowBelow />{t("lbl.tableRowBelow")}</button>
          <button className="oo-btn" title="Delete row" onClick={() => ctrl.exec({ kind: "tableDeleteRow" })}><IconDeleteRow />{t("lbl.tableDeleteRow")}</button>
          <button className="oo-btn" title="Insert column left" onClick={() => ctrl.exec({ kind: "tableInsertCol", where: "left" })}><IconInsertColLeft />{t("lbl.tableColLeft")}</button>
          <button className="oo-btn" title="Insert column right" onClick={() => ctrl.exec({ kind: "tableInsertCol", where: "right" })}><IconInsertColRight />{t("lbl.tableColRight")}</button>
          <button className="oo-btn" title="Delete column" onClick={() => ctrl.exec({ kind: "tableDeleteCol" })}><IconDeleteCol />{t("lbl.tableDeleteCol")}</button>
        </div>
      )}

      {pageSettingsOpen && (
        <div style={{
          display: "flex", gap: 12, alignItems: "center", padding: "6px 12px",
          borderBottom: "1px solid var(--oo-color-border)",
          background: "var(--oo-color-bg-alt, var(--oo-color-bg))",
          fontSize: 12, flexWrap: "wrap",
        }}>
          <span style={{ fontWeight: 600, opacity: 0.7 }}>Page Settings</span>
          <label style={{ display: "flex", alignItems: "center", gap: 4 }}>
            Margins
            <input type="number" min={0} max={200} step={4} value={pageMargins}
              className="oo-btn" style={{ width: 56, padding: "0 4px" }}
              onChange={(e) => setPageMargins(Number(e.target.value) || 0)} />
            <span style={{ opacity: 0.55 }}>px</span>
          </label>
          <label style={{ display: "flex", alignItems: "center", gap: 4 }}>
            Columns
            <select className="oo-btn" value={pageColumns}
              onChange={(e) => setPageColumns(Number(e.target.value))}>
              <option value={1}>1</option>
              <option value={2}>2</option>
              <option value={3}>3</option>
            </select>
          </label>
          <label style={{ display: "flex", alignItems: "center", gap: 4 }}>
            Orientation
            <select className="oo-btn" value={pageOrientation}
              onChange={(e) => setPageOrientation(e.target.value as "portrait" | "landscape")}>
              <option value="portrait">Portrait</option>
              <option value="landscape">Landscape</option>
            </select>
          </label>
        </div>
      )}

      <div style={{ flex: 1, display: "flex", minHeight: 0 }}>
        {navigatorOpen && (
          <NavigatorPanel editorRef={editorRef} onClose={() => setNavigatorOpen(false)} />
        )}
        <div className="oo-doc-outer" style={{ flex: 1 }}>
          <div
            className={"oo-doc-paper" + (pageOrientation === "landscape" ? " landscape" : "")}
            style={{
              background:
                pageBgType === "image"
                  ? `url("${pageBgValue}") center/cover no-repeat`
                  : pageBgType === "color"
                  ? pageBgValue
                  : undefined,
            }}
          >
            {showHeader && (
              <div
                ref={headerRef}
                className="oo-page-header"
                contentEditable={!readOnly}
                suppressContentEditableWarning
                onBlur={(e) => setHeaderHtml(e.currentTarget.innerHTML)}
              />
            )}
            <div
              ref={editorRef}
              className={`oo-doc-page${pageColumns === 2 ? " oo-doc-cols-2" : pageColumns === 3 ? " oo-doc-cols-3" : ""}`}
              contentEditable={!readOnly}
              suppressContentEditableWarning
              spellCheck
              onInput={onInput}
              onKeyDown={onKeyDown}
              onPaste={onPaste}
              style={{
                flex: 1,
                padding: `${pageMargins}px`,
                background: "transparent",
                color: "var(--oo-color-fg)",
                outline: "none",
                lineHeight: lineSpacing,
                fontSize: 15,
              }}
            />
            {showFooter && (
              <div
                ref={footerRef}
                className="oo-page-footer"
                contentEditable={!readOnly}
                suppressContentEditableWarning
                onBlur={(e) => setFooterHtml(e.currentTarget.innerHTML)}
              />
            )}
          </div>
          {placeholderOptions && placeholderOptions.length > 0 && (
            <PlaceholderPalette
              options={placeholderOptions}
              detected={detectedPlaceholders}
              onInsert={(ph) => ctrl.exec({ kind: "insertHtml", html: buildChipHtml(ph) })}
            />
          )}
        </div>
        {commentsOpen && (
          <CommentsPanel
            editorRef={editorRef}
            comments={comments}
            onResolve={resolveComment}
            onDelete={deleteComment}
            onClose={() => setCommentsOpen(false)}
          />
        )}
      </div>

      {statsOpen && (
        <WordStatsModal editorRef={editorRef} onClose={() => setStatsOpen(false)} />
      )}

      {printPreviewOpen && (
        <PrintPreviewModal html={ctrl.getHtml()} onClose={() => setPrintPreviewOpen(false)} />
      )}

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
          <button className="oo-btn" title="Previous (Shift+Enter)" onClick={() => doFind(-1)}>▲</button>
          <button className="oo-btn" title="Next (Enter)" onClick={() => doFind(1)}>▼</button>
          {findCount.total > 0 && (
            <span style={{ fontSize: 11, alignSelf: "center", minWidth: 48, textAlign: "center", opacity: 0.7 }}>
              {findCount.current}/{findCount.total}
            </span>
          )}
          <button className="oo-btn" onClick={() => doReplace(false)}>{t("common.replace")}</button>
          <button className="oo-btn" onClick={() => doReplace(true)}>{t("common.replaceAll")}</button>
          <button className="oo-btn" onClick={() => { setFindOpen(false); findIndexRef.current = -1; setFindCount({ total: 0, current: 0 }); }}>×</button>
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

      {bgDialogOpen && (
        <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.45)", zIndex: 50, display: "flex", alignItems: "center", justifyContent: "center" }}>
          <div style={{ background: "var(--oo-color-bg)", border: "1px solid var(--oo-color-border)", borderRadius: 10, padding: 24, width: 440, boxShadow: "0 8px 32px rgba(0,0,0,0.22)" }}>
            <div style={{ fontWeight: 700, fontSize: 15, marginBottom: 16 }}>{t("lbl.pageBg")}</div>

            {/* Type selector */}
            <div style={{ display: "flex", gap: 8, marginBottom: 16 }}>
              {(["none","color","image"] as const).map((type) => (
                <button key={type} className="oo-btn"
                  style={{ background: pageBgType === type ? "var(--oo-color-selection,rgba(37,99,235,0.12))" : undefined, fontWeight: pageBgType === type ? 600 : undefined }}
                  onClick={() => setPageBgType(type)}>
                  {type === "none" ? "None" : type === "color" ? "Color" : "Image"}
                </button>
              ))}
            </div>

            {pageBgType === "color" && (
              <div style={{ display: "flex", gap: 10, alignItems: "center", marginBottom: 16 }}>
                <input type="color" value={pageBgValue || "#ffffff"}
                  style={{ width: 40, height: 32, border: "1px solid var(--oo-color-border)", borderRadius: 4, cursor: "pointer" }}
                  onChange={(e) => setPageBgValue(e.target.value)} />
                <input type="text" className="oo-btn" value={pageBgValue}
                  placeholder="#ffffff or rgba(…)"
                  style={{ flex: 1 }}
                  onChange={(e) => setPageBgValue(e.target.value)} />
              </div>
            )}

            {pageBgType === "image" && (
              <div style={{ display: "flex", flexDirection: "column", gap: 10, marginBottom: 16 }}>
                <label style={{ fontSize: 12, opacity: 0.65, fontWeight: 500 }}>Image URL</label>
                <input type="text" className="oo-btn" value={pageBgValue}
                  placeholder="https://example.com/image.jpg"
                  style={{ width: "100%" }}
                  onChange={(e) => setPageBgValue(e.target.value)} />
                <label style={{ fontSize: 12, opacity: 0.65, fontWeight: 500 }}>Or upload from computer</label>
                <input type="file" accept="image/*"
                  onChange={(e) => {
                    const file = e.target.files?.[0];
                    if (!file) return;
                    const reader = new FileReader();
                    reader.onload = (ev) => setPageBgValue(ev.target?.result as string ?? "");
                    reader.readAsDataURL(file);
                  }} />
                {pageBgValue && (
                  <img src={pageBgValue} alt="preview"
                    style={{ maxHeight: 110, objectFit: "cover", borderRadius: 6, border: "1px solid var(--oo-color-border)" }} />
                )}
              </div>
            )}

            <div style={{ display: "flex", justifyContent: "flex-end", gap: 8, marginTop: 8 }}>
              {pageBgType !== "none" && (
                <button className="oo-btn" onClick={() => { setPageBgType("none"); setPageBgValue(""); }}>Clear</button>
              )}
              <button className="oo-btn" style={{ fontWeight: 600 }} onClick={() => setBgDialogOpen(false)}>Done</button>
            </div>
          </div>
        </div>
      )}

      {mathOpen && (
        <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.4)", zIndex: 50, display: "flex", alignItems: "center", justifyContent: "center" }}>
          <div style={{
            background: "var(--oo-color-bg)", border: "1px solid var(--oo-color-border)",
            borderRadius: 8, padding: 20, width: 420, boxShadow: "0 8px 24px rgba(0,0,0,0.2)",
          }}>
            <div style={{ fontWeight: 600, marginBottom: 10 }}>Insert Math (TeX)</div>
            <input
              autoFocus
              value={mathTex}
              onChange={(e) => setMathTex(e.target.value)}
              placeholder="e.g. x^2 + \frac{a}{b}"
              style={{
                width: "100%", boxSizing: "border-box",
                padding: "6px 8px", border: "1px solid var(--oo-color-border)",
                borderRadius: 4, font: "inherit", background: "var(--oo-color-bg)", color: "var(--oo-color-fg)",
              }}
              onKeyDown={(e) => {
                if (e.key === "Enter") confirmMath();
                if (e.key === "Escape") setMathOpen(false);
              }}
            />
            {mathTex.trim() && (
              <div style={{
                marginTop: 8, padding: 10,
                background: "var(--oo-color-bg-alt, #f5f5f5)",
                borderRadius: 4, minHeight: 40, display: "flex", alignItems: "center", justifyContent: "center",
              }}>
                {renderMathFn
                  ? <span dangerouslySetInnerHTML={{ __html: renderMathFn(mathTex) }} />
                  : <span style={{ opacity: 0.45, fontSize: 12 }}>Loading…</span>}
              </div>
            )}
            <div style={{ marginTop: 14, display: "flex", gap: 8, justifyContent: "flex-end" }}>
              <button className="oo-btn" onClick={() => setMathOpen(false)}>Cancel</button>
              <button className="oo-btn" onClick={confirmMath} disabled={!mathTex.trim() || !renderMathFn}>Insert</button>
            </div>
          </div>
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
