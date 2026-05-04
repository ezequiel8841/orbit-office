// @orbitoffice/slides — main UI.
import { useEffect, useMemo, useRef, useState } from "react";
import { useStore } from "../core/store";
import { IconDownload, IconUpload, IconRedo } from "../icons";
import { Canvas } from "./Canvas";
import { Presenter } from "./Presenter";
import { ScaledSlide } from "./ScaledSlide";
import { createSlidesController } from "./controller";
import {
  THEMES,
  getTheme,
  type Deck,
  type LayoutId,
  type ShapeKind,
  type SlideElement,
  type TextElement,
  type ShapeElement,
} from "./model";
import type { MappingOption, SmartDocPlaceholder } from "../core/smartDocs";
import { useT } from "../core/i18n";
import { extractDeckPlaceholders } from "./placeholders";

export interface SlidesProps {
  persistKey?: string;
  className?: string;
  style?: React.CSSProperties;
  value?: Deck;
  onChange?: (deck: Deck) => void;
  readOnly?: boolean;
  hideExport?: boolean;
  hideImport?: boolean;
  placeholderOptions?: MappingOption[];
  onPlaceholdersChange?: (list: SmartDocPlaceholder[]) => void;
}

const DEFAULT_KEY = "orbitoffice:slides";
const ZOOM_STEPS = [0.25, 0.5, 0.75, 1.0, 1.25, 1.5, 2.0];
const FONT_FAMILIES = ["Default","Arial","Arial Black","Calibri","Courier New","Georgia","Impact","Times New Roman","Trebuchet MS","Verdana"];
const FONT_SIZES = [12,16,20,24,28,32,36,40,48,56,64,72,80,96,112,128];
const PRESET_COLORS = [
  "#000000","#ffffff","#ef4444","#f97316","#eab308","#22c55e",
  "#3b82f6","#8b5cf6","#ec4899","#6b7280","#1e40af","#065f46",
];

export function Slides({
  persistKey = DEFAULT_KEY,
  className,
  style,
  value,
  onChange,
  readOnly,
  hideExport,
  hideImport,
  placeholderOptions,
  onPlaceholdersChange,
}: SlidesProps) {
  const controlled = value !== undefined;
  const ctrl = useMemo(
    () => createSlidesController(controlled ? value : undefined, controlled ? undefined : persistKey),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [controlled ? "controlled" : persistKey],
  );
  const state = useStore(ctrl.store);
  const lastEmitted = useRef<Deck | null>(null);

  useEffect(() => {
    if (!controlled || !value) return;
    if (value === lastEmitted.current) return;
    if (value !== ctrl.store.get().deck) ctrl.loadDeck(value);
  }, [controlled, value, ctrl]);

  useEffect(() => {
    if (!controlled) return;
    const deck = state.deck;
    lastEmitted.current = deck;
    onChange?.(deck);
    if (onPlaceholdersChange) onPlaceholdersChange(extractDeckPlaceholders(deck));
  }, [controlled, state.deck, onChange, onPlaceholdersChange]);

  const t = useT();
  const [presenting, setPresenting] = useState(false);
  const [showNotes, setShowNotes] = useState(true);
  const [gridView, setGridView] = useState(false);
  const [zoom, setZoom] = useState(1.0);

  const deck: Deck = state.deck;
  const slide = deck.slides.find((s) => s.id === state.activeSlideId)!;
  const theme = getTheme(deck.themeId);
  const sel = slide.elements.filter((e) => state.selectedIds.includes(e.id));
  const single = sel.length === 1 ? sel[0] : null;

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const tgt = e.target as HTMLElement;
      if (tgt && (tgt.tagName === "INPUT" || tgt.tagName === "TEXTAREA" || tgt.isContentEditable)) return;
      if (e.key === "F5") { e.preventDefault(); enterPresent(); }
      if (e.key.toLowerCase() === "g" && !e.metaKey && !e.ctrlKey) setGridView((v) => !v);
      if ((e.metaKey || e.ctrlKey) && e.key === "=") { e.preventDefault(); zoomIn(); }
      if ((e.metaKey || e.ctrlKey) && e.key === "-") { e.preventDefault(); zoomOut(); }
      if ((e.metaKey || e.ctrlKey) && e.key === "0") { e.preventDefault(); setZoom(1.0); }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  });

  function zoomIn() { setZoom((z) => { const n = ZOOM_STEPS.find((s) => s > z); return n ?? z; }); }
  function zoomOut() { setZoom((z) => { const p = [...ZOOM_STEPS].reverse().find((s) => s < z); return p ?? z; }); }

  function enterPresent() {
    setPresenting(true);
    try { document.documentElement.requestFullscreen?.(); } catch { /* ignore */ }
  }
  function exitPresent() {
    setPresenting(false);
    try { document.exitFullscreen?.(); } catch { /* ignore */ }
  }

  useEffect(() => {
    const onFs = () => { if (!document.fullscreenElement) setPresenting(false); };
    document.addEventListener("fullscreenchange", onFs);
    return () => document.removeEventListener("fullscreenchange", onFs);
  }, []);

  function exportJson() {
    const blob = new Blob([ctrl.toJSON()], { type: "application/json" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob); a.download = "deck.json"; a.click();
    URL.revokeObjectURL(a.href);
  }
  function importJson() {
    const inp = document.createElement("input");
    inp.type = "file"; inp.accept = "application/json,.json";
    inp.onchange = async () => {
      const f = inp.files?.[0]; if (!f) return;
      try { ctrl.loadDeck(JSON.parse(await f.text())); } catch { alert("Invalid deck JSON"); }
    };
    inp.click();
  }
  function onPickImageFile() {
    const inp = document.createElement("input");
    inp.type = "file"; inp.accept = "image/*";
    inp.onchange = async () => {
      const f = inp.files?.[0]; if (!f) return;
      const reader = new FileReader();
      reader.onload = () => ctrl.addImage(reader.result as string);
      reader.readAsDataURL(f);
    };
    inp.click();
  }
  function onPickImageUrl() {
    const url = prompt("Image URL"); if (url?.trim()) ctrl.addImage(url.trim());
  }

  if (presenting) {
    const idx = deck.slides.findIndex((s) => s.id === state.activeSlideId);
    return <Presenter deck={deck} startIndex={Math.max(0, idx)} onExit={exitPresent} />;
  }

  if (gridView) {
    return (
      <div className={`oo-root ${className ?? ""}`} style={{ display: "flex", flexDirection: "column", height: "100%", ...style }}>
        <MainToolbar
          ctrl={ctrl} deck={deck} selCount={sel.length} onPresent={enterPresent}
          onImport={importJson} onExport={exportJson} onPickImageFile={onPickImageFile} onPickImageUrl={onPickImageUrl}
          onAddShape={(s) => ctrl.addShape(s)} gridView onToggleGrid={() => setGridView(false)}
          onToggleNotes={() => setShowNotes((v) => !v)}
          zoom={zoom} onZoomIn={zoomIn} onZoomOut={zoomOut} onZoomReset={() => setZoom(1.0)}
          placeholderOptions={placeholderOptions}
          hideExport={hideExport} hideImport={hideImport} readOnly={readOnly}
        />
        <div style={{
          flex: 1, overflow: "auto", padding: 24,
          display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(260px, 1fr))",
          gap: 16, background: "var(--oo-color-bg-alt, #e8e8e8)",
        }}>
          {deck.slides.map((s, i) => (
            <button
              key={s.id}
              onClick={() => { ctrl.setActive(s.id); setGridView(false); }}
              style={{
                position: "relative", aspectRatio: "16 / 9",
                background: "var(--oo-color-bg-alt)",
                border: state.activeSlideId === s.id
                  ? "2px solid var(--oo-color-primary, #2563eb)"
                  : "1px solid var(--oo-color-border)",
                borderRadius: 8, overflow: "hidden", padding: 0, cursor: "pointer",
                boxShadow: "0 2px 8px rgba(0,0,0,0.1)",
              }}
            >
              <ScaledSlide slide={s} theme={theme} autoFit />
              <div style={{
                position: "absolute", bottom: 4, left: 6,
                padding: "2px 6px", background: "rgba(0,0,0,0.6)",
                color: "white", borderRadius: 3, fontSize: 11,
              }}>{i + 1}</div>
            </button>
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className={`oo-root oo-slides ${className ?? ""}`}
      style={{ display: "flex", flexDirection: "column", height: "100%", ...style }}>
      <MainToolbar
        ctrl={ctrl} deck={deck} selCount={sel.length} onPresent={enterPresent}
        onImport={importJson} onExport={exportJson} onPickImageFile={onPickImageFile} onPickImageUrl={onPickImageUrl}
        onAddShape={(s) => ctrl.addShape(s)}
        onToggleGrid={() => setGridView(true)}
        onToggleNotes={() => setShowNotes((v) => !v)}
        zoom={zoom} onZoomIn={zoomIn} onZoomOut={zoomOut} onZoomReset={() => setZoom(1.0)}
        placeholderOptions={placeholderOptions}
        hideExport={hideExport} hideImport={hideImport} readOnly={readOnly}
      />
      {/* Context toolbar for selected element */}
      {single && !readOnly && (
        <ContextToolbar ctrl={ctrl} slideId={slide.id} el={single} />
      )}
      <div style={{ flex: 1, display: "flex", minHeight: 0 }}>
        <Sidebar ctrl={ctrl} deck={deck} activeId={state.activeSlideId} />
        <div style={{ flex: 1, display: "flex", flexDirection: "column", minWidth: 0 }}>
          <Canvas ctrl={ctrl} zoomFactor={zoom} />
          {showNotes && (
            <div style={{
              borderTop: "1px solid var(--oo-color-border)",
              background: "var(--oo-color-bg-alt, var(--oo-color-bg))",
              padding: 8, maxHeight: 110, display: "flex", flexDirection: "column",
            }}>
              <div style={{ fontSize: 11, color: "var(--oo-color-fg-muted, #888)", marginBottom: 4 }}>
                {t("slides.notesHeader")}
              </div>
              <textarea
                value={slide.notes ?? ""}
                onChange={(e) => ctrl.setNotes(slide.id, e.target.value)}
                placeholder={t("slides.notesPlaceholder")}
                style={{
                  flex: 1, resize: "none", outline: "none",
                  background: "transparent", color: "var(--oo-color-fg)",
                  border: "1px solid var(--oo-color-border)", borderRadius: 4,
                  padding: 6, font: "inherit", fontSize: 13,
                }}
              />
            </div>
          )}
        </div>
        <PropertiesPanel ctrl={ctrl} deck={deck} slideId={slide.id} elements={sel} />
      </div>
      {/* Status bar */}
      <div style={{
        padding: "3px 12px", fontSize: 11, display: "flex", gap: 16,
        borderTop: "1px solid var(--oo-color-border)",
        background: "var(--oo-color-bg-alt, var(--oo-color-bg))",
        color: "var(--oo-color-fg-muted, #888)",
      }}>
        <span>Slide {deck.slides.findIndex(s => s.id === slide.id) + 1} / {deck.slides.length}</span>
        <span>{slide.elements.length} elements</span>
        {sel.length > 0 && <span style={{ color: "var(--oo-color-primary, #2563eb)" }}>{sel.length} selected</span>}
        <span style={{ marginLeft: "auto" }}>Theme: {getTheme(deck.themeId).name}</span>
      </div>
    </div>
  );
}

/* ─────────────────────────── Main Toolbar ─────────────────────────── */

interface MainToolbarProps {
  ctrl: ReturnType<typeof createSlidesController>;
  deck: Deck; selCount: number;
  onPresent: () => void; onImport: () => void; onExport: () => void;
  onPickImageFile: () => void; onPickImageUrl: () => void;
  onAddShape: (s: ShapeKind) => void;
  onToggleGrid: () => void; onToggleNotes: () => void;
  zoom: number; onZoomIn: () => void; onZoomOut: () => void; onZoomReset: () => void;
  gridView?: boolean;
  placeholderOptions?: MappingOption[];
  hideExport?: boolean; hideImport?: boolean; readOnly?: boolean;
}

const SHAPE_BTNS: { kind: ShapeKind; label: string; title: string }[] = [
  { kind: "rect",     label: "□",  title: "Rectangle" },
  { kind: "ellipse",  label: "○",  title: "Ellipse" },
  { kind: "triangle", label: "△",  title: "Triangle" },
  { kind: "diamond",  label: "◇",  title: "Diamond" },
  { kind: "pentagon", label: "⬠",  title: "Pentagon" },
  { kind: "hexagon",  label: "⬡",  title: "Hexagon" },
  { kind: "line",     label: "─",  title: "Line" },
  { kind: "arrow",    label: "→",  title: "Arrow" },
  { kind: "star",     label: "★",  title: "Star" },
];

function MainToolbar({
  ctrl, deck, selCount, onPresent, onImport, onExport,
  onPickImageFile, onPickImageUrl, onAddShape,
  onToggleGrid, onToggleNotes, gridView,
  zoom, onZoomIn, onZoomOut, onZoomReset,
  placeholderOptions, hideExport, hideImport, readOnly,
}: MainToolbarProps) {
  const t = useT();
  return (
    <div className="oo-toolbar" style={{
      display: "flex", flexWrap: "wrap", gap: 3, padding: "5px 8px",
      borderBottom: "1px solid var(--oo-color-border)",
      background: "var(--oo-color-bg-alt, var(--oo-color-bg))",
      alignItems: "center",
    }}>
      <button className="oo-btn" disabled={!ctrl.canUndo() || readOnly} onClick={() => ctrl.undo()} title={t("common.undo")}>
        <IconRedo style={{ transform: "scaleX(-1)" }} />
      </button>
      <button className="oo-btn" disabled={!ctrl.canRedo() || readOnly} onClick={() => ctrl.redo()} title={t("common.redo")}>
        <IconRedo />
      </button>
      <span className="oo-sep" />
      <select className="oo-btn" value={deck.themeId} onChange={(e) => ctrl.setTheme(e.target.value)}
        disabled={readOnly} title={t("slides.theme")} style={{ maxWidth: 88 }}>
        {THEMES.map((th) => <option key={th.id} value={th.id}>{th.name}</option>)}
      </select>
      <select className="oo-btn" defaultValue="" title={t("slides.newSlideLayout")} disabled={readOnly}
        onChange={(e) => { if (e.target.value) ctrl.addSlide(e.target.value as LayoutId); e.currentTarget.value = ""; }}>
        <option value="">{t("slides.newSlide")}</option>
        <option value="title">{t("slides.layoutTitle")}</option>
        <option value="titleContent">{t("slides.layoutTitleContent")}</option>
        <option value="twoContent">{t("slides.layoutTwoContent")}</option>
        <option value="section">{t("slides.layoutSection")}</option>
        <option value="blank">{t("slides.layoutBlank")}</option>
      </select>
      <span className="oo-sep" />
      <button className="oo-btn" disabled={readOnly} onClick={() => ctrl.addText()} title={t("slides.addText")}
        style={{ fontWeight: 700, fontSize: 14, minWidth: 28 }}>T</button>
      {SHAPE_BTNS.map(({ kind, label, title }) => (
        <button key={kind} className="oo-btn" disabled={readOnly} onClick={() => onAddShape(kind)} title={title}
          style={{ fontSize: 13 }}>{label}</button>
      ))}
      <button className="oo-btn" disabled={readOnly} onClick={onPickImageFile} title="Image (file)">🖼</button>
      <button className="oo-btn" disabled={readOnly} onClick={onPickImageUrl} title="Image (URL)">🔗🖼</button>
      {placeholderOptions && placeholderOptions.length > 0 && (
        <>
          <span className="oo-sep" />
          <select className="oo-btn" defaultValue="" disabled={readOnly} title={t("common.placeholderInsert")}
            onChange={(e) => { if (e.target.value) ctrl.insertPlaceholder(e.target.value); e.currentTarget.value = ""; }}>
            <option value="">{`{{ }}`}</option>
            {placeholderOptions.map((o) => (
              <option key={`${o.mapping_type}.${o.mapping_key}`}
                value={o.mapping_key.includes(".") ? o.mapping_key.split(".").pop()! : o.mapping_key}>
                {o.label}
              </option>
            ))}
          </select>
        </>
      )}
      <span className="oo-sep" />
      <button className="oo-btn" disabled={readOnly} onClick={() => ctrl.bringToFront()} title="Bring to front" style={{ fontSize: 11 }}>⇈Z</button>
      <button className="oo-btn" disabled={readOnly} onClick={() => ctrl.bringForward()} title={t("slides.bringForward")} style={{ fontSize: 11 }}>↑Z</button>
      <button className="oo-btn" disabled={readOnly} onClick={() => ctrl.sendBackward()} title={t("slides.sendBackward")} style={{ fontSize: 11 }}>↓Z</button>
      <button className="oo-btn" disabled={readOnly} onClick={() => ctrl.sendToBack()} title="Send to back" style={{ fontSize: 11 }}>⇊Z</button>
      {selCount >= 2 && (
        <>
          <span className="oo-sep" />
          <button className="oo-btn" disabled={readOnly} onClick={() => ctrl.alignSelected("left")} title="Align left">⊢</button>
          <button className="oo-btn" disabled={readOnly} onClick={() => ctrl.alignSelected("centerH")} title="Center H">⊣⊢</button>
          <button className="oo-btn" disabled={readOnly} onClick={() => ctrl.alignSelected("right")} title="Align right">⊣</button>
          <button className="oo-btn" disabled={readOnly} onClick={() => ctrl.alignSelected("top")} title="Align top">⊤</button>
          <button className="oo-btn" disabled={readOnly} onClick={() => ctrl.alignSelected("middle")} title="Center V">⊥⊤</button>
          <button className="oo-btn" disabled={readOnly} onClick={() => ctrl.alignSelected("bottom")} title="Align bottom">⊥</button>
          {selCount >= 3 && (
            <>
              <button className="oo-btn" disabled={readOnly} onClick={() => ctrl.distributeSelected("h")} title="Distribute H">⇔</button>
              <button className="oo-btn" disabled={readOnly} onClick={() => ctrl.distributeSelected("v")} title="Distribute V">⇕</button>
            </>
          )}
        </>
      )}
      <span style={{ marginLeft: "auto" }} />
      <button className="oo-btn" onClick={onZoomOut} title="Zoom out (Ctrl+-)">−</button>
      <button className="oo-btn" onClick={onZoomReset} title="Reset zoom (Ctrl+0)"
        style={{ minWidth: 46, fontVariantNumeric: "tabular-nums", fontSize: 12 }}>
        {Math.round(zoom * 100)}%
      </button>
      <button className="oo-btn" onClick={onZoomIn} title="Zoom in (Ctrl+=)">+</button>
      <span className="oo-sep" />
      <button className="oo-btn" onClick={onToggleGrid} title={t("slides.gridView")}>{gridView ? "Editor" : "Grid"}</button>
      <button className="oo-btn" onClick={onToggleNotes} title={t("slides.toggleNotes")}>Notes</button>
      <button className="oo-btn" onClick={onPresent} title={t("slides.presentTitle")}
        style={{ fontWeight: 600 }}>{t("slides.present")}</button>
      {!hideImport && <button className="oo-btn" disabled={readOnly} onClick={onImport} title={t("slides.importDeck")}><IconUpload /></button>}
      {!hideExport && <button className="oo-btn" onClick={onExport} title={t("slides.exportDeck")}><IconDownload /></button>}
    </div>
  );
}

/* ─────────────────────────── Context Toolbar ─────────────────────────── */

function ContextToolbar({ ctrl, slideId, el }: {
  ctrl: ReturnType<typeof createSlidesController>;
  slideId: string; el: SlideElement;
}) {
  const update = (patch: Partial<SlideElement>) => ctrl.updateElement(slideId, el.id, patch as any);

  return (
    <div style={{
      display: "flex", flexWrap: "wrap", gap: 3, padding: "4px 8px",
      borderBottom: "1px solid var(--oo-color-border)",
      background: "var(--oo-color-bg-alt, #f8f8f8)",
      alignItems: "center", fontSize: 12,
    }}>
      {/* Common: position quick-edit */}
      <span style={{ fontSize: 11, opacity: 0.6, marginRight: 2 }}>
        {el.type === "text" ? "Text" : el.type === "shape" ? (el as ShapeElement).shape : "Image"}
      </span>
      <span className="oo-sep" />

      {el.type === "text" && (
        <TextContextBar el={el as TextElement} update={update as any} />
      )}
      {el.type === "shape" && (
        <ShapeContextBar el={el as ShapeElement} update={update as any} />
      )}

      <span className="oo-sep" />
      {/* Duplicate */}
      <button className="oo-btn" title="Duplicate element (Ctrl+D)"
        onClick={() => { ctrl.copySelected(); ctrl.pasteElements(); }}>⎘ Duplicate</button>
      {/* Lock */}
      <button className="oo-btn" title={el.locked ? "Unlock element" : "Lock element"}
        onClick={() => update({ locked: !el.locked })}
        style={{ background: el.locked ? "var(--oo-color-warning, #f59e0b)" : undefined, color: el.locked ? "white" : undefined }}>
        {el.locked ? "🔒 Locked" : "🔓 Lock"}
      </button>
      {/* Delete */}
      <button className="oo-btn" title="Delete (Del)" onClick={() => ctrl.deleteSelected()}
        style={{ color: "#ef4444" }}>✕ Delete</button>
    </div>
  );
}

function TextContextBar({ el, update }: { el: TextElement; update: (p: Partial<TextElement>) => void }) {
  return (
    <>
      <select className="oo-btn" value={el.fontFamily ?? "Default"}
        onChange={(e) => update({ fontFamily: e.target.value === "Default" ? undefined : e.target.value })}
        style={{ maxWidth: 110, fontSize: 11 }}>
        {FONT_FAMILIES.map((f) => <option key={f} value={f} style={{ fontFamily: f }}>{f}</option>)}
      </select>
      <select className="oo-btn" value={el.fontSize ?? 48}
        onChange={(e) => update({ fontSize: parseInt(e.target.value) })}
        style={{ width: 60, fontSize: 11 }}>
        {FONT_SIZES.map((s) => <option key={s} value={s}>{s}</option>)}
      </select>
      <span className="oo-sep" />
      <TBtn active={!!el.bold} onClick={() => update({ bold: !el.bold })} style={{ fontWeight: 700 }}>B</TBtn>
      <TBtn active={!!el.italic} onClick={() => update({ italic: !el.italic })} style={{ fontStyle: "italic" }}>I</TBtn>
      <TBtn active={!!el.underline} onClick={() => update({ underline: !el.underline })} style={{ textDecoration: "underline" }}>U</TBtn>
      <span className="oo-sep" />
      <TBtn active={el.align === "left"} onClick={() => update({ align: "left" })}>⬤≡</TBtn>
      <TBtn active={el.align === "center" || !el.align} onClick={() => update({ align: "center" })}>≡</TBtn>
      <TBtn active={el.align === "right"} onClick={() => update({ align: "right" })}>≡⬤</TBtn>
      <span className="oo-sep" />
      <label style={{ display: "flex", alignItems: "center", gap: 4, fontSize: 11 }}>
        Color
        <input type="color" value={el.color ?? "#000000"} onChange={(e) => update({ color: e.target.value })}
          style={{ width: 28, height: 22, padding: 0, border: "1px solid var(--oo-color-border)", borderRadius: 3 }} />
      </label>
      <span className="oo-sep" />
      {/* Preset colors */}
      {PRESET_COLORS.slice(0, 8).map((c) => (
        <button key={c} onClick={() => update({ color: c })}
          style={{
            width: 18, height: 18, background: c, border: "1px solid rgba(0,0,0,0.2)",
            borderRadius: 3, padding: 0, cursor: "pointer", flexShrink: 0,
          }} title={c} />
      ))}
    </>
  );
}

function ShapeContextBar({ el, update }: { el: ShapeElement; update: (p: Partial<ShapeElement>) => void }) {
  return (
    <>
      <label style={{ display: "flex", alignItems: "center", gap: 4, fontSize: 11 }}>
        Fill
        <input type="color" value={el.fill ?? "#2563eb"} onChange={(e) => update({ fill: e.target.value })}
          style={{ width: 28, height: 22, padding: 0, border: "1px solid var(--oo-color-border)", borderRadius: 3 }} />
      </label>
      <label style={{ display: "flex", alignItems: "center", gap: 4, fontSize: 11 }}>
        Stroke
        <input type="color" value={el.stroke ?? "#000000"} onChange={(e) => update({ stroke: e.target.value })}
          style={{ width: 28, height: 22, padding: 0, border: "1px solid var(--oo-color-border)", borderRadius: 3 }} />
        <input type="number" value={el.strokeWidth ?? 0} min={0} max={20}
          onChange={(e) => update({ strokeWidth: parseInt(e.target.value) || 0 })}
          style={{ width: 40, padding: "2px 4px", font: "inherit", fontSize: 11, border: "1px solid var(--oo-color-border)", borderRadius: 3, background: "var(--oo-color-bg)" }} />
      </label>
      <span className="oo-sep" />
      {/* Fill presets */}
      {PRESET_COLORS.slice(0, 8).map((c) => (
        <button key={c} onClick={() => update({ fill: c })}
          style={{
            width: 18, height: 18, background: c, border: "1px solid rgba(0,0,0,0.2)",
            borderRadius: 3, padding: 0, cursor: "pointer", flexShrink: 0,
          }} title={c} />
      ))}
      <span className="oo-sep" />
      <label style={{ display: "flex", alignItems: "center", gap: 4, fontSize: 11 }}>
        Text
        <input type="text" value={el.shapeText ?? ""} placeholder="Add text…"
          onChange={(e) => update({ shapeText: e.target.value || undefined })}
          style={{ width: 90, padding: "2px 5px", font: "inherit", fontSize: 11, border: "1px solid var(--oo-color-border)", borderRadius: 3, background: "var(--oo-color-bg)", color: "var(--oo-color-fg)" }} />
      </label>
    </>
  );
}

function TBtn({ active, onClick, children, style }: { active: boolean; onClick: () => void; children: React.ReactNode; style?: React.CSSProperties }) {
  return (
    <button className="oo-btn" onClick={onClick}
      style={{ ...style, background: active ? "var(--oo-color-primary, #2563eb)" : undefined, color: active ? "white" : undefined }}>
      {children}
    </button>
  );
}

/* ─────────────────────────── Sidebar ─────────────────────────── */

function Sidebar({ ctrl, deck, activeId }: {
  ctrl: ReturnType<typeof createSlidesController>; deck: Deck; activeId: string;
}) {
  const theme = getTheme(deck.themeId);
  const [dragId, setDragId] = useState<string | null>(null);
  const [dropIdx, setDropIdx] = useState<number | null>(null);

  return (
    <aside style={{
      width: 184, borderRight: "1px solid var(--oo-color-border)",
      background: "var(--oo-color-bg-alt, var(--oo-color-bg))",
      display: "flex", flexDirection: "column", minWidth: 0,
    }}>
      <div style={{ padding: "6px 8px" }}>
        <button className="oo-btn" style={{ width: "100%", fontWeight: 600 }} onClick={() => ctrl.addSlide()}>+ Slide</button>
      </div>
      <div style={{ flex: 1, overflow: "auto", padding: "4px 8px 8px", display: "flex", flexDirection: "column", gap: 6 }}>
        {deck.slides.map((s, i) => (
          <div
            key={s.id}
            draggable
            onClick={() => ctrl.setActive(s.id)}
            onDragStart={(e) => { setDragId(s.id); e.dataTransfer.effectAllowed = "move"; }}
            onDragEnd={() => { setDragId(null); setDropIdx(null); }}
            onDragOver={(e) => { e.preventDefault(); setDropIdx(i); }}
            onDrop={(e) => {
              e.preventDefault();
              if (dragId && dragId !== s.id) ctrl.reorderSlide(dragId, i);
              setDragId(null); setDropIdx(null);
            }}
            style={{
              border: `2px solid ${
                s.id === activeId ? "var(--oo-color-primary, #2563eb)"
                : dropIdx === i && dragId !== s.id ? "var(--oo-color-primary, #2563eb)"
                : "var(--oo-color-border)"
              }`,
              borderRadius: 6, cursor: "pointer", position: "relative",
              background: "var(--oo-color-bg)", opacity: dragId === s.id ? 0.4 : 1,
            }}
          >
            <div style={{ aspectRatio: "16/9", overflow: "hidden", borderRadius: 4 }}>
              <ScaledSlide slide={s} theme={theme} autoFit />
            </div>
            <div style={{
              position: "absolute", top: 3, left: 4, fontSize: 10,
              background: "rgba(0,0,0,0.55)", color: "white", padding: "1px 5px", borderRadius: 3,
            }}>{i + 1}</div>
            <div style={{ position: "absolute", top: 2, right: 2, display: "flex", gap: 2 }}>
              <button className="oo-btn" style={{ padding: "1px 5px", fontSize: 10 }}
                title="Duplicate slide"
                onClick={(e) => { e.stopPropagation(); ctrl.duplicateSlide(s.id); }}>⎘</button>
              <button className="oo-btn" style={{ padding: "1px 5px", fontSize: 10, color: "#ef4444" }}
                title="Delete slide"
                onClick={(e) => { e.stopPropagation(); ctrl.deleteSlide(s.id); }}>×</button>
            </div>
          </div>
        ))}
      </div>
    </aside>
  );
}

/* ─────────────────────────── Properties Panel ─────────────────────────── */

function PropertiesPanel({ ctrl, deck, slideId, elements }: {
  ctrl: ReturnType<typeof createSlidesController>;
  deck: Deck; slideId: string; elements: SlideElement[];
}) {
  const slide = deck.slides.find((s) => s.id === slideId)!;
  const single = elements.length === 1 ? elements[0] : null;
  const t = useT();

  return (
    <aside style={{
      width: 252, borderLeft: "1px solid var(--oo-color-border)",
      background: "var(--oo-color-bg-alt, var(--oo-color-bg))",
      display: "flex", flexDirection: "column", overflow: "auto", fontSize: 12,
    }}>
      <PSection label="SLIDE">
        <SlideProps ctrl={ctrl} deck={deck} slide={slide} t={t} />
      </PSection>

      {elements.length === 0 && (
        <div style={{ padding: "10px 12px", opacity: 0.5, fontSize: 12 }}>
          Click an element to edit its properties.
        </div>
      )}
      {!single && elements.length > 1 && (
        <PSection label={`${elements.length} ELEMENTS`}>
          <div style={{ display: "flex", gap: 4 }}>
            <button className="oo-btn" style={{ flex: 1, fontSize: 11 }} onClick={() => ctrl.alignSelected("centerH")}>Center H</button>
            <button className="oo-btn" style={{ flex: 1, fontSize: 11 }} onClick={() => ctrl.alignSelected("middle")}>Center V</button>
          </div>
          <div style={{ display: "flex", gap: 4 }}>
            <button className="oo-btn" style={{ flex: 1, fontSize: 11 }} onClick={() => ctrl.distributeSelected("h")}>Dist. H</button>
            <button className="oo-btn" style={{ flex: 1, fontSize: 11 }} onClick={() => ctrl.distributeSelected("v")}>Dist. V</button>
          </div>
          <button className="oo-btn" onClick={() => ctrl.deleteSelected()} style={{ color: "#ef4444" }}>Delete all</button>
        </PSection>
      )}
      {single && (
        <PSection label={single.type === "shape" ? (single as ShapeElement).shape.toUpperCase() : single.type.toUpperCase()}>
          <ElementProps ctrl={ctrl} slideId={slideId} el={single} />
        </PSection>
      )}
    </aside>
  );
}

function PSection({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div style={{ borderBottom: "1px solid var(--oo-color-border)" }}>
      <div style={{ fontSize: 10, fontWeight: 600, letterSpacing: 0.8, color: "var(--oo-color-fg-muted, #888)", padding: "8px 12px 4px" }}>{label}</div>
      <div style={{ padding: "0 12px 10px", display: "flex", flexDirection: "column", gap: 6 }}>{children}</div>
    </div>
  );
}

/* ---- Slide properties ---- */

function SlideProps({ ctrl, deck, slide, t }: {
  ctrl: ReturnType<typeof createSlidesController>;
  deck: Deck; slide: NonNullable<ReturnType<Deck["slides"]["find"]>>;
  t: ReturnType<typeof useT>;
}) {
  const [bgType, setBgType] = useState<"color" | "gradient" | "image">(
    slide.bgGradient ? "gradient" : slide.bgImage ? "image" : "color"
  );
  const [gradC1, setGradC1] = useState(slide.bgGradient?.c1 ?? "#2563eb");
  const [gradC2, setGradC2] = useState(slide.bgGradient?.c2 ?? "#7c3aed");
  const [gradAngle, setGradAngle] = useState(slide.bgGradient?.angle ?? 135);
  const [imgUrl, setImgUrl] = useState(slide.bgImage ?? "");

  return (
    <>
      <PRow label="BG Type">
        <div style={{ display: "flex", gap: 3 }}>
          {(["color", "gradient", "image"] as const).map((tp) => (
            <button key={tp} className="oo-btn"
              onClick={() => setBgType(tp)}
              style={{
                flex: 1, fontSize: 10, padding: "2px 3px",
                background: bgType === tp ? "var(--oo-color-primary, #2563eb)" : undefined,
                color: bgType === tp ? "white" : undefined,
              }}>{tp[0].toUpperCase() + tp.slice(1)}</button>
          ))}
        </div>
      </PRow>

      {bgType === "color" && (
        <PRow label="Color">
          <div style={{ display: "flex", gap: 6, alignItems: "center", flexWrap: "wrap" }}>
            <input type="color" value={slide.background ?? getTheme(deck.themeId).bg}
              onChange={(e) => ctrl.setSlideBackground(slide.id, e.target.value)}
              style={{ width: 28, height: 22, padding: 0, border: "1px solid var(--oo-color-border)", borderRadius: 3 }} />
            <button className="oo-btn" style={{ fontSize: 10 }}
              onClick={() => ctrl.setSlideBackground(slide.id, undefined)}>Reset</button>
          </div>
          <div style={{ display: "flex", flexWrap: "wrap", gap: 3, marginTop: 2 }}>
            {PRESET_COLORS.map((c) => (
              <button key={c} onClick={() => ctrl.setSlideBackground(slide.id, c)}
                style={{ width: 18, height: 18, background: c, border: "1px solid rgba(0,0,0,0.2)", borderRadius: 3, padding: 0, cursor: "pointer" }} />
            ))}
          </div>
        </PRow>
      )}

      {bgType === "gradient" && (
        <>
          <PRow label="Color 1">
            <input type="color" value={gradC1} onChange={(e) => { setGradC1(e.target.value); ctrl.setSlideBgGradient(slide.id, { c1: e.target.value, c2: gradC2, angle: gradAngle }); }}
              style={{ width: 28, height: 22, padding: 0, border: "1px solid var(--oo-color-border)", borderRadius: 3 }} />
          </PRow>
          <PRow label="Color 2">
            <input type="color" value={gradC2} onChange={(e) => { setGradC2(e.target.value); ctrl.setSlideBgGradient(slide.id, { c1: gradC1, c2: e.target.value, angle: gradAngle }); }}
              style={{ width: 28, height: 22, padding: 0, border: "1px solid var(--oo-color-border)", borderRadius: 3 }} />
          </PRow>
          <PRow label="Angle">
            <input type="range" min={0} max={360} value={gradAngle}
              onChange={(e) => { const a = parseInt(e.target.value); setGradAngle(a); ctrl.setSlideBgGradient(slide.id, { c1: gradC1, c2: gradC2, angle: a }); }}
              style={{ flex: 1 }} />
            <span style={{ minWidth: 30, textAlign: "right" }}>{gradAngle}°</span>
          </PRow>
        </>
      )}

      {bgType === "image" && (
        <PRow label="URL">
          <input type="text" value={imgUrl} placeholder="https://…"
            onChange={(e) => setImgUrl(e.target.value)}
            onBlur={() => ctrl.setSlideBgImage(slide.id, imgUrl.trim() || undefined)}
            onKeyDown={(e) => e.key === "Enter" && ctrl.setSlideBgImage(slide.id, imgUrl.trim() || undefined)}
            style={{ flex: 1, padding: "2px 5px", border: "1px solid var(--oo-color-border)", borderRadius: 3, background: "var(--oo-color-bg)", color: "var(--oo-color-fg)", font: "inherit", fontSize: 11 }} />
        </PRow>
      )}

      <PRow label="Layout">
        <select className="oo-btn" value={slide.layout}
          onChange={(e) => { if (confirm(t("slides.confirmReplaceLayout"))) ctrl.setLayout(slide.id, e.target.value as LayoutId); }}
          style={{ flex: 1 }}>
          <option value="title">{t("slides.layoutTitle")}</option>
          <option value="titleContent">{t("slides.layoutTitleContent")}</option>
          <option value="twoContent">{t("slides.layoutTwoContent")}</option>
          <option value="section">{t("slides.layoutSection")}</option>
          <option value="blank">{t("slides.layoutBlank")}</option>
        </select>
      </PRow>
      <PRow label="Transition">
        <select className="oo-btn" value={slide.transition ?? "none"}
          onChange={(e) => ctrl.setSlideTransition(slide.id, e.target.value as any)} style={{ flex: 1 }}>
          <option value="none">None</option>
          <option value="fade">Fade</option>
          <option value="slide">Slide</option>
          <option value="zoom">Zoom</option>
        </select>
      </PRow>
    </>
  );
}

/* ---- Element properties ---- */

function ElementProps({ ctrl, slideId, el }: {
  ctrl: ReturnType<typeof createSlidesController>; slideId: string; el: SlideElement;
}) {
  const update = (patch: Partial<SlideElement>) => ctrl.updateElement(slideId, el.id, patch as any);

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
      <PSub label="Position & Size" />
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 4 }}>
        <PRow label="X"><PNum value={el.x} onChange={(x) => update({ x })} /></PRow>
        <PRow label="Y"><PNum value={el.y} onChange={(y) => update({ y })} /></PRow>
        <PRow label="W"><PNum value={el.w} onChange={(w) => update({ w })} /></PRow>
        <PRow label="H"><PNum value={el.h} onChange={(h) => update({ h })} /></PRow>
        <PRow label="Rot°"><PNum value={el.rotation ?? 0} onChange={(v) => update({ rotation: v })} /></PRow>
        <PRow label="Opacity">
          <PNum value={Math.round((el.opacity ?? 1) * 100)} onChange={(v) => update({ opacity: Math.max(0, Math.min(100, v)) / 100 })} />
        </PRow>
      </div>

      {el.type === "text" && <FullTextProps el={el as TextElement} update={update as any} />}
      {el.type === "shape" && <FullShapeProps el={el as ShapeElement} update={update as any} />}

      <div style={{ display: "flex", gap: 4, marginTop: 2 }}>
        <button className="oo-btn"
          style={{ flex: 1, fontSize: 11, background: el.locked ? "#f59e0b" : undefined, color: el.locked ? "white" : undefined }}
          title={el.locked ? "Unlock" : "Lock position"}
          onClick={() => update({ locked: !el.locked })}>
          {el.locked ? "🔒 Unlock" : "🔓 Lock"}
        </button>
        <button className="oo-btn" onClick={() => ctrl.deleteSelected()}
          style={{ flex: 1, fontSize: 11, color: "#ef4444" }}>✕ Delete</button>
      </div>
    </div>
  );
}

function FullTextProps({ el, update }: { el: TextElement; update: (p: Partial<TextElement>) => void }) {
  const [hasShadow, setHasShadow] = useState(!!el.textShadow);
  return (
    <>
      <PSub label="Font" />
      <PRow label="Family">
        <select className="oo-btn" value={el.fontFamily ?? "Default"}
          onChange={(e) => update({ fontFamily: e.target.value === "Default" ? undefined : e.target.value })}
          style={{ flex: 1, fontSize: 11 }}>
          {FONT_FAMILIES.map((f) => <option key={f} value={f}>{f}</option>)}
        </select>
      </PRow>
      <PRow label="Size"><PNum value={el.fontSize ?? 48} onChange={(v) => update({ fontSize: v })} /></PRow>
      <PRow label="Color">
        <input type="color" value={el.color ?? "#000000"} onChange={(e) => update({ color: e.target.value })}
          style={{ width: 28, height: 22, padding: 0, border: "1px solid var(--oo-color-border)", borderRadius: 3 }} />
        <div style={{ display: "flex", flexWrap: "wrap", gap: 2, flex: 1 }}>
          {PRESET_COLORS.slice(0, 6).map((c) => (
            <button key={c} onClick={() => update({ color: c })}
              style={{ width: 16, height: 16, background: c, border: "1px solid rgba(0,0,0,0.2)", borderRadius: 2, padding: 0, cursor: "pointer" }} />
          ))}
        </div>
      </PRow>
      <PRow label="Align">
        <div style={{ display: "flex", gap: 3, flex: 1 }}>
          {(["left", "center", "right"] as const).map((a) => (
            <button key={a} className="oo-btn"
              onClick={() => update({ align: a })}
              style={{
                flex: 1, fontSize: 11,
                background: el.align === a ? "var(--oo-color-primary, #2563eb)" : undefined,
                color: el.align === a ? "white" : undefined,
              }}>{a[0].toUpperCase()}</button>
          ))}
        </div>
      </PRow>
      <div style={{ display: "flex", gap: 4 }}>
        <TBtn active={!!el.bold} onClick={() => update({ bold: !el.bold })} style={{ fontWeight: 700, flex: 1 }}>B</TBtn>
        <TBtn active={!!el.italic} onClick={() => update({ italic: !el.italic })} style={{ fontStyle: "italic", flex: 1 }}>I</TBtn>
        <TBtn active={!!el.underline} onClick={() => update({ underline: !el.underline })} style={{ textDecoration: "underline", flex: 1 }}>U</TBtn>
      </div>

      <PSub label="Spacing" />
      <PRow label="Line H">
        <input type="range" min={0.8} max={3} step={0.05} value={el.lineHeight ?? 1.25}
          onChange={(e) => update({ lineHeight: parseFloat(e.target.value) })} style={{ flex: 1 }} />
        <span style={{ minWidth: 30, textAlign: "right" }}>{(el.lineHeight ?? 1.25).toFixed(2)}</span>
      </PRow>
      <PRow label="Spacing"><PNum value={el.letterSpacing ?? 0} onChange={(v) => update({ letterSpacing: v })} /></PRow>

      <PSub label="Effects" />
      <PRow label="BG Fill">
        <input type="color" value={el.bgFill ?? "#ffffff"} onChange={(e) => update({ bgFill: e.target.value })}
          style={{ width: 28, height: 22, padding: 0, border: "1px solid var(--oo-color-border)", borderRadius: 3 }} />
        {el.bgFill && <button className="oo-btn" style={{ fontSize: 10 }} onClick={() => update({ bgFill: undefined })}>×</button>}
      </PRow>
      <PRow label="Shadow">
        <input type="checkbox" checked={hasShadow} onChange={(e) => {
          setHasShadow(e.target.checked);
          update({ textShadow: e.target.checked ? "2px 2px 6px rgba(0,0,0,0.4)" : undefined });
        }} />
        {hasShadow && (
          <input type="text" value={el.textShadow ?? ""} onChange={(e) => update({ textShadow: e.target.value })}
            style={{ flex: 1, padding: "2px 4px", border: "1px solid var(--oo-color-border)", borderRadius: 3, background: "var(--oo-color-bg)", color: "var(--oo-color-fg)", font: "inherit", fontSize: 11 }} />
        )}
      </PRow>
    </>
  );
}

function FullShapeProps({ el, update }: { el: ShapeElement; update: (p: Partial<ShapeElement>) => void }) {
  const [hasShadow, setHasShadow] = useState(!!el.shadow);
  return (
    <>
      <PSub label="Fill & Stroke" />
      <PRow label="Fill">
        <input type="color" value={el.fill ?? "#2563eb"} onChange={(e) => update({ fill: e.target.value })}
          style={{ width: 28, height: 22, padding: 0, border: "1px solid var(--oo-color-border)", borderRadius: 3 }} />
        <div style={{ display: "flex", flexWrap: "wrap", gap: 2, flex: 1 }}>
          {PRESET_COLORS.slice(0, 8).map((c) => (
            <button key={c} onClick={() => update({ fill: c })}
              style={{ width: 16, height: 16, background: c, border: "1px solid rgba(0,0,0,0.2)", borderRadius: 2, padding: 0, cursor: "pointer" }} />
          ))}
        </div>
      </PRow>
      <PRow label="Stroke">
        <input type="color" value={el.stroke ?? "#000000"} onChange={(e) => update({ stroke: e.target.value })}
          style={{ width: 28, height: 22, padding: 0, border: "1px solid var(--oo-color-border)", borderRadius: 3 }} />
        <PNum value={el.strokeWidth ?? 0} onChange={(v) => update({ strokeWidth: v })} />
      </PRow>
      {el.shape === "rect" && (
        <PRow label="Radius"><PNum value={el.borderRadius ?? 6} onChange={(v) => update({ borderRadius: v })} /></PRow>
      )}

      <PSub label="Shape Text" />
      <PRow label="Text">
        <input type="text" value={el.shapeText ?? ""} placeholder="Text inside shape…"
          onChange={(e) => update({ shapeText: e.target.value || undefined })}
          style={{ flex: 1, padding: "2px 5px", border: "1px solid var(--oo-color-border)", borderRadius: 3, background: "var(--oo-color-bg)", color: "var(--oo-color-fg)", font: "inherit", fontSize: 11 }} />
      </PRow>
      {el.shapeText && (
        <>
          <PRow label="Color">
            <input type="color" value={el.shapeTextColor ?? "#ffffff"} onChange={(e) => update({ shapeTextColor: e.target.value })}
              style={{ width: 28, height: 22, padding: 0, border: "1px solid var(--oo-color-border)", borderRadius: 3 }} />
          </PRow>
          <PRow label="Size"><PNum value={el.shapeTextSize ?? 32} onChange={(v) => update({ shapeTextSize: v })} /></PRow>
          <PRow label="Bold">
            <input type="checkbox" checked={!!el.shapeTextBold} onChange={(e) => update({ shapeTextBold: e.target.checked })} />
          </PRow>
          <PRow label="Align">
            <div style={{ display: "flex", gap: 3, flex: 1 }}>
              {(["left", "center", "right"] as const).map((a) => (
                <button key={a} className="oo-btn" onClick={() => update({ shapeTextAlign: a })}
                  style={{ flex: 1, fontSize: 10, background: el.shapeTextAlign === a ? "var(--oo-color-primary, #2563eb)" : undefined, color: el.shapeTextAlign === a ? "white" : undefined }}>
                  {a[0].toUpperCase()}
                </button>
              ))}
            </div>
          </PRow>
        </>
      )}

      <PSub label="Effects" />
      <PRow label="Shadow">
        <input type="checkbox" checked={hasShadow} onChange={(e) => {
          setHasShadow(e.target.checked);
          update({ shadow: e.target.checked ? "4px 4px 12px rgba(0,0,0,0.35)" : undefined });
        }} />
        {hasShadow && (
          <input type="text" value={el.shadow ?? ""} onChange={(e) => update({ shadow: e.target.value })}
            style={{ flex: 1, padding: "2px 4px", border: "1px solid var(--oo-color-border)", borderRadius: 3, background: "var(--oo-color-bg)", color: "var(--oo-color-fg)", font: "inherit", fontSize: 11 }} />
        )}
      </PRow>
    </>
  );
}

/* ---- Shared helpers ---- */

function PSub({ label }: { label: string }) {
  return (
    <div style={{ fontSize: 10, fontWeight: 600, letterSpacing: 0.6, color: "var(--oo-color-fg-muted, #888)", marginTop: 2, paddingTop: 2, borderTop: "1px solid var(--oo-color-border)" }}>{label}</div>
  );
}

function PRow({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label style={{ display: "flex", alignItems: "center", gap: 5 }}>
      <span style={{ width: 46, fontSize: 11, opacity: 0.7, flexShrink: 0 }}>{label}</span>
      <div style={{ flex: 1, display: "flex", alignItems: "center", gap: 4 }}>{children}</div>
    </label>
  );
}

function PNum({ value, onChange }: { value: number; onChange: (n: number) => void }) {
  return (
    <input type="number" value={Math.round(value * 100) / 100} onChange={(e) => onChange(parseFloat(e.target.value) || 0)}
      style={{ width: "100%", boxSizing: "border-box", background: "var(--oo-color-bg)", color: "var(--oo-color-fg)", border: "1px solid var(--oo-color-border)", borderRadius: 4, padding: "2px 5px", font: "inherit", fontSize: 11 }} />
  );
}

export default Slides;
