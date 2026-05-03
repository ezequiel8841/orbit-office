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
} from "./model";
import type { MappingOption, SmartDocPlaceholder } from "../core/smartDocs";
import { useT } from "../core/i18n";
import { extractDeckPlaceholders } from "./placeholders";

export interface SlidesProps {
  persistKey?: string;
  className?: string;
  style?: React.CSSProperties;
  /** Controlled deck. When set, persistKey/localStorage is ignored. */
  value?: Deck;
  /** Emits the deck on every change. */
  onChange?: (deck: Deck) => void;
  readOnly?: boolean;
  hideExport?: boolean;
  hideImport?: boolean;
  /** Smart Docs vocabulary; enables the placeholder insert menu. */
  placeholderOptions?: MappingOption[];
  /** Emits placeholders extracted from the deck on every change. */
  onPlaceholdersChange?: (list: SmartDocPlaceholder[]) => void;
}

const DEFAULT_KEY = "orbitoffice:slides";

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

  // Sync external value -> internal store
  useEffect(() => {
    if (!controlled || !value) return;
    if (value === lastEmitted.current) return;
    if (value !== ctrl.store.get().deck) ctrl.loadDeck(value);
  }, [controlled, value, ctrl]);

  // Emit changes upward (controlled mode)
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

  const deck: Deck = state.deck;
  const slide = deck.slides.find((s) => s.id === state.activeSlideId)!;
  const theme = getTheme(deck.themeId);
  const sel = slide.elements.filter((e) => state.selectedIds.includes(e.id));

  // global shortcuts
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const tgt = e.target as HTMLElement;
      if (tgt && (tgt.tagName === "INPUT" || tgt.tagName === "TEXTAREA" || tgt.isContentEditable)) return;
      if (e.key === "F5") { e.preventDefault(); enterPresent(); }
      if (e.key.toLowerCase() === "g" && !e.metaKey && !e.ctrlKey) setGridView((v) => !v);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  });

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
    a.href = URL.createObjectURL(blob);
    a.download = "deck.json"; a.click();
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
  function onPickImage() {
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

  if (presenting) {
    const idx = deck.slides.findIndex((s) => s.id === state.activeSlideId);
    return <Presenter deck={deck} startIndex={Math.max(0, idx)} onExit={exitPresent} />;
  }

  if (gridView) {
    return (
      <div className={`oo-root ${className ?? ""}`} style={{ display: "flex", flexDirection: "column", height: "100%", ...style }}>
        <Toolbar
          ctrl={ctrl} deck={deck} onPresent={enterPresent}
          onImport={importJson} onExport={exportJson} onPickImage={onPickImage}
          onAddShape={(s) => ctrl.addShape(s)} gridView onToggleGrid={() => setGridView(false)}
          onToggleNotes={() => setShowNotes((v) => !v)}
          placeholderOptions={placeholderOptions}
          hideExport={hideExport} hideImport={hideImport} readOnly={readOnly}
        />
        <div style={{
          flex: 1, overflow: "auto", padding: 16,
          display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(260px, 1fr))",
          gap: 12, background: "var(--oo-color-bg)",
        }}>
          {deck.slides.map((s, i) => (
            <button
              key={s.id}
              onClick={() => { ctrl.setActive(s.id); setGridView(false); }}
              style={{
                position: "relative",
                aspectRatio: "16 / 9",
                background: "var(--oo-color-bg-alt)",
                border: state.activeSlideId === s.id
                  ? "2px solid var(--oo-color-primary, #2563eb)"
                  : "1px solid var(--oo-color-border)",
                borderRadius: 6, overflow: "hidden", padding: 0, cursor: "pointer",
              }}
            >
              <ScaledSlide slide={s} theme={theme} autoFit />
              <div style={{
                position: "absolute", bottom: 4, left: 4,
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
      <Toolbar
        ctrl={ctrl} deck={deck} onPresent={enterPresent}
        onImport={importJson} onExport={exportJson} onPickImage={onPickImage}
        onAddShape={(s) => ctrl.addShape(s)}
        onToggleGrid={() => setGridView(true)}
        onToggleNotes={() => setShowNotes((v) => !v)}
        placeholderOptions={placeholderOptions}
        hideExport={hideExport} hideImport={hideImport} readOnly={readOnly}
      />
      <div style={{ flex: 1, display: "flex", minHeight: 0 }}>
        {/* Sidebar thumbnails */}
        <Sidebar ctrl={ctrl} deck={deck} activeId={state.activeSlideId} />
        {/* Center: canvas + notes */}
        <div style={{ flex: 1, display: "flex", flexDirection: "column", minWidth: 0 }}>
          <Canvas ctrl={ctrl} />
          {showNotes && (
            <div style={{
              borderTop: "1px solid var(--oo-color-border)",
              background: "var(--oo-color-bg-alt, var(--oo-color-bg))",
              padding: 8, maxHeight: 140, display: "flex", flexDirection: "column",
            }}>
              <div style={{ fontSize: 11, color: "var(--oo-color-fg-muted, #888)", marginBottom: 4 }}>{t("slides.notesHeader")}</div>
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
        {/* Right: properties */}
        <PropertiesPanel ctrl={ctrl} deck={deck} slideId={slide.id} elements={sel} />
      </div>
    </div>
  );
}

/* ---------------- Toolbar ---------------- */

interface ToolbarProps {
  ctrl: ReturnType<typeof createSlidesController>;
  deck: Deck;
  onPresent: () => void;
  onImport: () => void;
  onExport: () => void;
  onPickImage: () => void;
  onAddShape: (s: ShapeKind) => void;
  onToggleGrid: () => void;
  onToggleNotes: () => void;
  gridView?: boolean;
  placeholderOptions?: MappingOption[];
  hideExport?: boolean;
  hideImport?: boolean;
  readOnly?: boolean;
}

function Toolbar({
  ctrl, deck, onPresent, onImport, onExport, onPickImage, onAddShape,
  onToggleGrid, onToggleNotes, gridView,
  placeholderOptions, hideExport, hideImport, readOnly,
}: ToolbarProps) {
  const t = useT();
  return (
    <div className="oo-toolbar" style={{
      display: "flex", flexWrap: "wrap", gap: 4, padding: 8,
      borderBottom: "1px solid var(--oo-color-border)",
      background: "var(--oo-color-bg-alt, var(--oo-color-bg))",
    }}>
      <button className="oo-btn" disabled={!ctrl.canUndo() || readOnly} onClick={() => ctrl.undo()} title={t("common.undo")}>
        <IconRedo style={{ transform: "scaleX(-1)" }} />
      </button>
      <button className="oo-btn" disabled={!ctrl.canRedo() || readOnly} onClick={() => ctrl.redo()} title={t("common.redo")}>
        <IconRedo />
      </button>
      <span className="oo-sep" />
      <select
        className="oo-btn"
        value={deck.themeId}
        onChange={(e) => ctrl.setTheme(e.target.value)}
        disabled={readOnly}
        title={t("slides.theme")}
      >
        {THEMES.map((th) => <option key={th.id} value={th.id}>{th.name}</option>)}
      </select>
      <select
        className="oo-btn"
        defaultValue=""
        title={t("slides.newSlideLayout")}
        disabled={readOnly}
        onChange={(e) => {
          if (e.target.value) ctrl.addSlide(e.target.value as LayoutId);
          e.currentTarget.value = "";
        }}
      >
        <option value="">{t("slides.newSlide")}</option>
        <option value="title">{t("slides.layoutTitle")}</option>
        <option value="titleContent">{t("slides.layoutTitleContent")}</option>
        <option value="twoContent">{t("slides.layoutTwoContent")}</option>
        <option value="section">{t("slides.layoutSection")}</option>
        <option value="blank">{t("slides.layoutBlank")}</option>
      </select>
      <span className="oo-sep" />
      <button className="oo-btn" disabled={readOnly} onClick={() => ctrl.addText()} title={t("slides.addText")}>T</button>
      <button className="oo-btn" disabled={readOnly} onClick={() => onAddShape("rect")} title={t("slides.shapeRect")}>▭</button>
      <button className="oo-btn" disabled={readOnly} onClick={() => onAddShape("ellipse")} title={t("slides.shapeEllipse")}>◯</button>
      <button className="oo-btn" disabled={readOnly} onClick={() => onAddShape("triangle")} title={t("slides.shapeTriangle")}>△</button>
      <button className="oo-btn" disabled={readOnly} onClick={() => onAddShape("line")} title={t("slides.shapeLine")}>─</button>
      <button className="oo-btn" disabled={readOnly} onClick={() => onAddShape("arrow")} title={t("slides.shapeArrow")}>→</button>
      <button className="oo-btn" disabled={readOnly} onClick={() => onAddShape("star")} title={t("slides.shapeStar")}>★</button>
      <button className="oo-btn" disabled={readOnly} onClick={onPickImage} title={t("slides.shapeImage")}>🖼</button>
      {placeholderOptions && placeholderOptions.length > 0 && (
        <select
          className="oo-btn"
          defaultValue=""
          disabled={readOnly}
          title={t("common.placeholderInsert")}
          onChange={(e) => {
            if (e.target.value) ctrl.insertPlaceholder(e.target.value);
            e.currentTarget.value = "";
          }}
        >
          <option value="">{`{{ }}`} {t("common.placeholder")}</option>
          {placeholderOptions.map((o) => (
            <option key={`${o.mapping_type}.${o.mapping_key}`} value={o.mapping_key.includes(".") ? o.mapping_key.split(".").pop()! : o.mapping_key}>
              {o.label}
            </option>
          ))}
        </select>
      )}
      <span className="oo-sep" />
      <button className="oo-btn" disabled={readOnly} onClick={() => ctrl.bringForward()} title={t("slides.bringForward")}>↑Z</button>
      <button className="oo-btn" disabled={readOnly} onClick={() => ctrl.sendBackward()} title={t("slides.sendBackward")}>↓Z</button>
      <span style={{ marginLeft: "auto" }} />
      <button className="oo-btn" onClick={onToggleGrid} title={t("slides.gridView")}>{gridView ? t("slides.editorView") : "Grid"}</button>
      <button className="oo-btn" onClick={onToggleNotes} title={t("slides.toggleNotes")}>{t("slides.toggleNotes").split(" ").pop()}</button>
      <button className="oo-btn" onClick={onPresent} title={t("slides.presentTitle")}>{t("slides.present")}</button>
      {!hideImport && <button className="oo-btn" disabled={readOnly} onClick={onImport} title={t("slides.importDeck")}><IconUpload /></button>}
      {!hideExport && <button className="oo-btn" onClick={onExport} title={t("slides.exportDeck")}><IconDownload /></button>}
    </div>
  );
}

/* ---------------- Sidebar ---------------- */

function Sidebar({
  ctrl, deck, activeId,
}: { ctrl: ReturnType<typeof createSlidesController>; deck: Deck; activeId: string }) {
  const theme = getTheme(deck.themeId);
  return (
    <aside style={{
      width: 200, borderRight: "1px solid var(--oo-color-border)",
      background: "var(--oo-color-bg-alt, var(--oo-color-bg))",
      display: "flex", flexDirection: "column", minWidth: 0,
    }}>
      <div style={{ padding: 8, display: "flex", gap: 4 }}>
        <button className="oo-btn" style={{ flex: 1 }} onClick={() => ctrl.addSlide()}>+ Slide</button>
      </div>
      <div style={{ flex: 1, overflow: "auto", padding: 8, display: "flex", flexDirection: "column", gap: 8 }}>
        {deck.slides.map((s, i) => (
          <div
            key={s.id}
            onClick={() => ctrl.setActive(s.id)}
            style={{
              border: `2px solid ${s.id === activeId ? "var(--oo-color-primary, #2563eb)" : "var(--oo-color-border)"}`,
              borderRadius: 4, cursor: "pointer", position: "relative",
              background: "var(--oo-color-bg)",
            }}
          >
            <div style={{ aspectRatio: "16/9", overflow: "hidden", borderRadius: 2 }}>
              <ScaledSlide slide={s} theme={theme} autoFit />
            </div>
            <div style={{
              position: "absolute", top: 2, left: 4, fontSize: 10,
              background: "rgba(0,0,0,0.5)", color: "white", padding: "1px 4px", borderRadius: 2,
            }}>{i + 1}</div>
            <div style={{ position: "absolute", top: 2, right: 2, display: "flex", gap: 2 }}>
              <button className="oo-btn" style={{ padding: "0 4px", fontSize: 10 }}
                onClick={(e) => { e.stopPropagation(); ctrl.duplicateSlide(s.id); }}>⎘</button>
              <button className="oo-btn" style={{ padding: "0 4px", fontSize: 10 }}
                onClick={(e) => { e.stopPropagation(); ctrl.deleteSlide(s.id); }}>×</button>
            </div>
          </div>
        ))}
      </div>
    </aside>
  );
}

/* ---------------- Properties panel ---------------- */

function PropertiesPanel({
  ctrl, deck, slideId, elements,
}: {
  ctrl: ReturnType<typeof createSlidesController>;
  deck: Deck; slideId: string; elements: SlideElement[];
}) {
  const slide = deck.slides.find((s) => s.id === slideId)!;
  const single = elements.length === 1 ? elements[0] : null;
  const t = useT();

  return (
    <aside style={{
      width: 240, borderLeft: "1px solid var(--oo-color-border)",
      background: "var(--oo-color-bg-alt, var(--oo-color-bg))",
      padding: 12, display: "flex", flexDirection: "column", gap: 12,
      overflow: "auto", fontSize: 13,
    }}>
      <div>
        <div style={{ fontSize: 11, opacity: 0.7, marginBottom: 4 }}>SLIDE</div>
        <label style={{ display: "flex", alignItems: "center", gap: 6 }}>
          BG
          <input
            type="color"
            value={slide.background ?? getTheme(deck.themeId).bg}
            onChange={(e) => ctrl.setSlideBackground(slide.id, e.target.value)}
            style={{ width: 32, height: 24, padding: 0, border: "1px solid var(--oo-color-border)", borderRadius: 4 }}
          />
          <button className="oo-btn" style={{ marginLeft: "auto" }}
            onClick={() => ctrl.setSlideBackground(slide.id, undefined)}>Reset</button>
        </label>
        <select
          className="oo-btn"
          value={slide.layout}
          onChange={(e) => {
            if (confirm(t("slides.confirmReplaceLayout"))) {
              ctrl.setLayout(slide.id, e.target.value as LayoutId);
            }
          }}
          style={{ width: "100%", marginTop: 6 }}
        >
          <option value="title">{t("slides.layoutTitle")}</option>
          <option value="titleContent">{t("slides.layoutTitleContent")}</option>
          <option value="twoContent">{t("slides.layoutTwoContent")}</option>
          <option value="section">{t("slides.layoutSection")}</option>
          <option value="blank">{t("slides.layoutBlank")}</option>
        </select>
      </div>

      {!single && elements.length === 0 && (
        <div style={{ opacity: 0.5, fontSize: 12 }}>Select an element to edit its properties.</div>
      )}
      {!single && elements.length > 1 && (
        <div style={{ opacity: 0.7, fontSize: 12 }}>{elements.length} elements selected</div>
      )}
      {single && (
        <ElementProps ctrl={ctrl} slideId={slideId} el={single} />
      )}
    </aside>
  );
}

function ElementProps({
  ctrl, slideId, el,
}: { ctrl: ReturnType<typeof createSlidesController>; slideId: string; el: SlideElement }) {
  const update = (patch: Partial<SlideElement>) => ctrl.updateElement(slideId, el.id, patch as any);
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
      <div style={{ fontSize: 11, opacity: 0.7 }}>{el.type.toUpperCase()}</div>
      <Row label="X"><Num value={el.x} onChange={(x) => update({ x })} /></Row>
      <Row label="Y"><Num value={el.y} onChange={(y) => update({ y })} /></Row>
      <Row label="W"><Num value={el.w} onChange={(w) => update({ w })} /></Row>
      <Row label="H"><Num value={el.h} onChange={(h) => update({ h })} /></Row>
      <Row label="Rot"><Num value={el.rotation ?? 0} onChange={(rotation) => update({ rotation })} /></Row>
      {el.type === "text" && (
        <>
          <Row label="Size"><Num value={(el as TextElement).fontSize ?? 48} onChange={(fontSize) => update({ fontSize } as Partial<TextElement>)} /></Row>
          <Row label="Color">
            <input type="color" value={(el as TextElement).color ?? "#000000"}
              onChange={(e) => update({ color: e.target.value } as Partial<TextElement>)}
              style={{ width: 32 }} />
          </Row>
          <Row label="Align">
            <select className="oo-btn" value={(el as TextElement).align ?? "left"}
              onChange={(e) => update({ align: e.target.value as any } as Partial<TextElement>)}>
              <option value="left">Left</option>
              <option value="center">Center</option>
              <option value="right">Right</option>
            </select>
          </Row>
          <div style={{ display: "flex", gap: 4 }}>
            <button className="oo-btn" style={{ flex: 1, fontWeight: (el as TextElement).bold ? 700 : 400 }}
              onClick={() => update({ bold: !(el as TextElement).bold } as Partial<TextElement>)}>B</button>
            <button className="oo-btn" style={{ flex: 1, fontStyle: (el as TextElement).italic ? "italic" : undefined }}
              onClick={() => update({ italic: !(el as TextElement).italic } as Partial<TextElement>)}>I</button>
            <button className="oo-btn" style={{ flex: 1, textDecoration: (el as TextElement).underline ? "underline" : undefined }}
              onClick={() => update({ underline: !(el as TextElement).underline } as Partial<TextElement>)}>U</button>
          </div>
        </>
      )}
      {el.type === "shape" && (
        <>
          <Row label="Fill">
            <input type="color" value={(el as any).fill ?? "#2563eb"}
              onChange={(e) => update({ fill: e.target.value } as any)}
              style={{ width: 32 }} />
          </Row>
          <Row label="Stroke">
            <input type="color" value={(el as any).stroke ?? "#000000"}
              onChange={(e) => update({ stroke: e.target.value } as any)}
              style={{ width: 32 }} />
          </Row>
          <Row label="SW"><Num value={(el as any).strokeWidth ?? 0} onChange={(strokeWidth) => update({ strokeWidth } as any)} /></Row>
        </>
      )}
      <button className="oo-btn" onClick={() => ctrl.deleteSelected()}>Delete</button>
    </div>
  );
}

function Row({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label style={{ display: "flex", alignItems: "center", gap: 8 }}>
      <span style={{ width: 50, fontSize: 11, opacity: 0.7 }}>{label}</span>
      <div style={{ flex: 1 }}>{children}</div>
    </label>
  );
}
function Num({ value, onChange }: { value: number; onChange: (n: number) => void }) {
  return (
    <input
      type="number"
      value={Math.round(value)}
      onChange={(e) => onChange(parseFloat(e.target.value) || 0)}
      style={{
        width: "100%", boxSizing: "border-box",
        background: "var(--oo-color-bg)", color: "var(--oo-color-fg)",
        border: "1px solid var(--oo-color-border)", borderRadius: 4,
        padding: "2px 6px", font: "inherit", fontSize: 12,
      }}
    />
  );
}

export default Slides;
