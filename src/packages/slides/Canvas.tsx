// @orbitoffice/slides — interactive canvas overlay (selection, drag, resize, inline text edit).
import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { useStore } from "../core/store";
import { ScaledSlide } from "./ScaledSlide";
import { ElementView } from "./ElementView";
import { SLIDE_H, SLIDE_W, getTheme, type ShapeElement, type SlideElement, type TextElement } from "./model";
import type { SlidesController } from "./controller";
import { snapMove, type Guide } from "./snap";

// Separate components so useLayoutEffect(init, []) fires once on mount, not every re-render.
function TextEditOverlay({
  el, slideId, ctrl, wrapperStyle, onDone,
}: {
  el: TextElement; slideId: string; ctrl: SlidesController;
  wrapperStyle: React.CSSProperties; onDone: () => void;
}) {
  const divRef = useRef<HTMLDivElement>(null);
  // Track whether onBlur already saved, so the unmount cleanup doesn't double-save.
  const savedRef = useRef(false);

  // Sets innerHTML once on mount. Cleanup saves content if blur never fired
  // (e.g. when canvas background is clicked and React unmounts before blur).
  useLayoutEffect(() => {
    const node = divRef.current; if (!node) return;
    node.innerHTML = el.html;
    return () => {
      if (!savedRef.current) {
        ctrl.updateElement(slideId, el.id, { html: node.innerHTML });
      }
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Focus + cursor-at-end in a separate effect so it runs AFTER innerHTML is painted.
  useEffect(() => {
    const node = divRef.current; if (!node) return;
    node.focus();
    // Place cursor at end WITHOUT calling removeAllRanges first (that can silently steal focus).
    try {
      const sel = window.getSelection();
      const range = document.createRange();
      range.selectNodeContents(node);
      range.collapse(false);
      sel?.removeAllRanges();
      sel?.addRange(range);
    } catch { /* ignore */ }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <div style={wrapperStyle} onMouseDown={(e) => e.stopPropagation()}>
      <div
        ref={divRef}
        contentEditable suppressContentEditableWarning
        tabIndex={0}
        onBlur={(e) => {
          savedRef.current = true;
          ctrl.updateElement(slideId, el.id, { html: e.currentTarget.innerHTML });
          onDone();
        }}
        onKeyDown={(e) => {
          if (e.key === "Escape") { e.currentTarget.blur(); }
        }}
        style={{
          width: "100%", height: "100%", boxSizing: "border-box",
          color: el.color, fontSize: el.fontSize, fontFamily: el.fontFamily,
          fontWeight: el.bold ? 700 : 400,
          fontStyle: el.italic ? "italic" : undefined,
          textDecoration: el.underline ? "underline" : undefined,
          textAlign: el.align, lineHeight: el.lineHeight ?? 1.25,
          letterSpacing: el.letterSpacing ? `${el.letterSpacing}px` : undefined,
          background: el.bgFill ?? "rgba(255,255,255,0.04)",
          outline: "2px dashed var(--oo-color-primary, #2563eb)",
          whiteSpace: "pre-wrap", wordBreak: "break-word", overflowWrap: "break-word",
          cursor: "text",
        }}
      />
    </div>
  );
}

function ShapeEditOverlay({
  el, slideId, ctrl, wrapperStyle, onDone,
}: {
  el: ShapeElement; slideId: string; ctrl: SlidesController;
  wrapperStyle: React.CSSProperties; onDone: () => void;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  useEffect(() => { inputRef.current?.focus(); inputRef.current?.select(); }, []);
  return (
    <div style={wrapperStyle} onMouseDown={(e) => e.stopPropagation()}>
      <div style={{ position: "absolute", inset: 0, pointerEvents: "none" }}>
        <ElementView el={{ ...el, x: 0, y: 0, rotation: undefined } as SlideElement} />
      </div>
      <input
        ref={inputRef}
        defaultValue={el.shapeText ?? ""}
        onBlur={(e) => { ctrl.updateElement(slideId, el.id, { shapeText: e.target.value } as any); onDone(); }}
        onKeyDown={(e) => { if (e.key === "Escape" || e.key === "Enter") e.currentTarget.blur(); }}
        style={{
          position: "absolute", inset: 0, width: "100%", height: "100%",
          background: "transparent", border: "none",
          outline: "2px dashed var(--oo-color-primary, #2563eb)",
          color: el.shapeTextColor ?? "#ffffff", fontSize: el.shapeTextSize ?? 32,
          fontWeight: el.shapeTextBold ? 700 : 500,
          textAlign: el.shapeTextAlign ?? "center",
          padding: "8px 12px", boxSizing: "border-box",
        }}
      />
    </div>
  );
}

interface CanvasProps {
  ctrl: SlidesController;
  zoomFactor?: number;
}

const HANDLE_SIZE = 14;

export function Canvas({ ctrl, zoomFactor = 1.0 }: CanvasProps) {
  const state = useStore(ctrl.store);
  const slide = state.deck.slides.find((s) => s.id === state.activeSlideId)!;
  const theme = getTheme(state.deck.themeId);

  const wrapRef = useRef<HTMLDivElement>(null);
  const slideRef = useRef<HTMLDivElement>(null);
  const [fitScale, setFitScale] = useState(0.5);
  const [editingId, setEditingId] = useState<string | null>(null);

  const effectiveScale = fitScale * zoomFactor;

  useEffect(() => {
    const el = wrapRef.current;
    if (!el) return;
    const update = () => {
      const r = el.getBoundingClientRect();
      setFitScale(Math.min(r.width / SLIDE_W, r.height / SLIDE_H));
    };
    update();
    const ro = new ResizeObserver(update);
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  // Mouse → slide coords using the slide container div.
  function toSlide(clientX: number, clientY: number): { x: number; y: number } {
    const r = (slideRef.current ?? wrapRef.current!).getBoundingClientRect();
    return {
      x: (clientX - r.left) / effectiveScale,
      y: (clientY - r.top) / effectiveScale,
    };
  }

  // ----- Drag/resize -----
  type Drag =
    | { kind: "move"; ids: string[]; startX: number; startY: number; orig: Map<string, { x: number; y: number }> }
    | { kind: "resize"; id: string; handle: Handle; startX: number; startY: number; orig: { x: number; y: number; w: number; h: number } }
    | { kind: "rotate"; id: string; cx: number; cy: number; startAngle: number; origRotation: number }
    | { kind: "marquee"; startX: number; startY: number; x: number; y: number };
  type Handle = "nw" | "n" | "ne" | "e" | "se" | "s" | "sw" | "w";

  const [drag, setDrag] = useState<Drag | null>(null);
  const [guides, setGuides] = useState<Guide[]>([]);

  useEffect(() => {
    if (!drag) return;
    const onMove = (e: MouseEvent) => {
      const p = toSlide(e.clientX, e.clientY);
      if (drag.kind === "rotate") {
        const angle = Math.atan2(p.y - drag.cy, p.x - drag.cx) * 180 / Math.PI;
        const delta = angle - drag.startAngle;
        ctrl.updateElement(slide.id, drag.id, { rotation: drag.origRotation + delta });
      } else if (drag.kind === "move") {
        const dx = p.x - drag.startX;
        const dy = p.y - drag.startY;
        const firstId = drag.ids[0];
        const o0 = drag.orig.get(firstId);
        const ref = slide.elements.find((x) => x.id === firstId);
        let sdx = dx, sdy = dy;
        const allGuides: Guide[] = [];
        if (o0 && ref) {
          const others = slide.elements.filter((x) => !drag.ids.includes(x.id));
          const r = snapMove(o0.x + dx, o0.y + dy, ref.w, ref.h, others, { grid: e.altKey });
          sdx = r.x - o0.x;
          sdy = r.y - o0.y;
          allGuides.push(...r.guides);
        }
        setGuides(allGuides);
        for (const id of drag.ids) {
          const o = drag.orig.get(id);
          if (!o) continue;
          ctrl.updateElement(slide.id, id, { x: o.x + sdx, y: o.y + sdy });
        }
      } else if (drag.kind === "resize") {
        const dx = p.x - drag.startX;
        const dy = p.y - drag.startY;
        const o = drag.orig;
        let { x, y, w, h } = o;
        const h2 = drag.handle;
        if (h2.includes("e")) w = Math.max(20, o.w + dx);
        if (h2.includes("s")) h = Math.max(20, o.h + dy);
        if (h2.includes("w")) { w = Math.max(20, o.w - dx); x = o.x + (o.w - w); }
        if (h2.includes("n")) { h = Math.max(20, o.h - dy); y = o.y + (o.h - h); }
        const isCorner = h2 === "nw" || h2 === "ne" || h2 === "se" || h2 === "sw";
        if (e.shiftKey && isCorner && o.w > 0 && o.h > 0) {
          const ratio = o.w / o.h;
          if (Math.abs(w - o.w) >= Math.abs(h - o.h) * ratio) {
            const nH = Math.max(20, w / ratio);
            if (h2.includes("n")) y = o.y + (o.h - nH);
            h = nH;
          } else {
            const nW = Math.max(20, h * ratio);
            if (h2.includes("w")) x = o.x + (o.w - nW);
            w = nW;
          }
        }
        ctrl.updateElement(slide.id, drag.id, { x, y, w, h });
      } else if (drag.kind === "marquee") {
        setDrag({ ...drag, x: p.x, y: p.y });
      }
    };
    const onUp = () => {
      if (drag.kind === "marquee") {
        const x1 = Math.min(drag.startX, drag.x);
        const x2 = Math.max(drag.startX, drag.x);
        const y1 = Math.min(drag.startY, drag.y);
        const y2 = Math.max(drag.startY, drag.y);
        const ids = slide.elements
          .filter((el) => el.x >= x1 && el.y >= y1 && el.x + el.w <= x2 && el.y + el.h <= y2)
          .map((el) => el.id);
        ctrl.setSelection(ids);
      }
      setDrag(null);
      setGuides([]);
    };
    window.addEventListener("mousemove", onMove);
    window.addEventListener("mouseup", onUp);
    return () => {
      window.removeEventListener("mousemove", onMove);
      window.removeEventListener("mouseup", onUp);
    };
  }, [drag, ctrl, slide.id, slide.elements, effectiveScale]);

  function onElementMouseDown(e: React.MouseEvent, el: SlideElement) {
    if (editingId === el.id) return;
    e.stopPropagation();
    if (el.locked) { ctrl.setSelection([el.id]); return; }
    const wasSelected = state.selectedIds.includes(el.id);
    let nextSel = state.selectedIds;
    if (e.shiftKey) {
      nextSel = wasSelected
        ? state.selectedIds.filter((id) => id !== el.id)
        : [...state.selectedIds, el.id];
    } else if (!wasSelected) {
      nextSel = [el.id];
    }
    ctrl.setSelection(nextSel);
    const p = toSlide(e.clientX, e.clientY);
    const orig = new Map<string, { x: number; y: number }>();
    for (const id of nextSel) {
      const target = slide.elements.find((x) => x.id === id);
      if (target) orig.set(id, { x: target.x, y: target.y });
    }
    setDrag({ kind: "move", ids: nextSel, startX: p.x, startY: p.y, orig });
  }

  function onHandleMouseDown(e: React.MouseEvent, el: SlideElement, handle: Handle) {
    e.stopPropagation();
    const p = toSlide(e.clientX, e.clientY);
    setDrag({
      kind: "resize",
      id: el.id,
      handle,
      startX: p.x,
      startY: p.y,
      orig: { x: el.x, y: el.y, w: el.w, h: el.h },
    });
  }

  function onRotateHandleMouseDown(e: React.MouseEvent, el: SlideElement) {
    e.stopPropagation();
    const p = toSlide(e.clientX, e.clientY);
    const cx = el.x + el.w / 2;
    const cy = el.y + el.h / 2;
    const startAngle = Math.atan2(p.y - cy, p.x - cx) * 180 / Math.PI;
    setDrag({ kind: "rotate", id: el.id, cx, cy, startAngle, origRotation: el.rotation ?? 0 });
  }

  function onCanvasMouseDown(e: React.MouseEvent) {
    if (editingId) setEditingId(null);
    ctrl.setSelection([]);
    const p = toSlide(e.clientX, e.clientY);
    setDrag({ kind: "marquee", startX: p.x, startY: p.y, x: p.x, y: p.y });
  }

  // Keyboard nav
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (editingId) return;
      const tgt = e.target as HTMLElement;
      if (tgt && (tgt.tagName === "INPUT" || tgt.tagName === "TEXTAREA" || tgt.isContentEditable)) return;
      if ((e.key === "Delete" || e.key === "Backspace") && state.selectedIds.length) {
        e.preventDefault();
        ctrl.deleteSelected();
      } else if (e.key === "Escape") {
        ctrl.setSelection([]);
      } else if (e.key.startsWith("Arrow") && state.selectedIds.length) {
        e.preventDefault();
        const step = e.shiftKey ? 40 : 10;
        const dx = e.key === "ArrowLeft" ? -step : e.key === "ArrowRight" ? step : 0;
        const dy = e.key === "ArrowUp" ? -step : e.key === "ArrowDown" ? step : 0;
        for (const id of state.selectedIds) {
          const el = slide.elements.find((x) => x.id === id);
          if (el) ctrl.updateElement(slide.id, id, { x: el.x + dx, y: el.y + dy });
        }
      } else if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "z") {
        e.preventDefault();
        e.shiftKey ? ctrl.redo() : ctrl.undo();
      } else if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "y") {
        e.preventDefault(); ctrl.redo();
      } else if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "c") {
        e.preventDefault(); ctrl.copySelected();
      } else if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "v") {
        e.preventDefault(); ctrl.pasteElements();
      } else if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "d") {
        e.preventDefault();
        ctrl.copySelected();
        ctrl.pasteElements();
      } else if ((e.key === "Enter" || e.key === "F2") && state.selectedIds.length === 1) {
        const target = slide.elements.find((x) => x.id === state.selectedIds[0]);
        if (target && (target.type === "text" || target.type === "shape")) {
          e.preventDefault();
          setEditingId(target.id);
        }
      } else if (!e.metaKey && !e.ctrlKey && !e.altKey && e.key.length === 1 && state.selectedIds.length === 1) {
        // Type-to-start-editing: any printable key on a selected text element enters edit mode
        // and replaces its content with that character.
        const target = slide.elements.find((x) => x.id === state.selectedIds[0]);
        if (target && !target.locked && target.type === "text") {
          e.preventDefault();
          ctrl.updateElement(slide.id, target.id, { html: e.key });
          setEditingId(target.id);
        }
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [ctrl, slide.id, slide.elements, state.selectedIds, editingId]);

  const slideW = SLIDE_W * effectiveScale;
  const slideH = SLIDE_H * effectiveScale;
  const zoomed = zoomFactor > 1.01;

  return (
    <div
      ref={wrapRef}
      style={{
        flex: 1,
        overflow: zoomed ? "auto" : "hidden",
        background: "var(--oo-color-bg-alt, #e8e8e8)",
        display: "flex",
        alignItems: zoomed ? "flex-start" : "center",
        justifyContent: zoomed ? "flex-start" : "center",
        position: "relative",
      }}
    >
      <div
        ref={slideRef}
        style={{
          width: slideW,
          height: slideH,
          flexShrink: 0,
          position: "relative",
          boxShadow: "0 4px 32px rgba(0,0,0,0.18)",
          margin: zoomed ? 24 : 0,
        }}
        onMouseDown={onCanvasMouseDown}
      >
        <ScaledSlide slide={slide} theme={theme} scale={effectiveScale} autoFit={false}>
          {slide.elements.map((el) => {
            const selected = state.selectedIds.includes(el.id);
            const isEditing = editingId === el.id && (el.type === "text" || el.type === "shape");
            const wrapperStyle: React.CSSProperties = {
              position: "absolute",
              left: el.x, top: el.y, width: el.w, height: el.h,
              outline: selected
                ? `2px solid ${el.locked ? "#f59e0b" : "var(--oo-color-primary, #2563eb)"}`
                : "none",
              cursor: el.locked ? "default" : "move",
              transform: el.rotation ? `rotate(${el.rotation}deg)` : undefined,
            };
            if (isEditing && el.type === "text") {
              return (
                <TextEditOverlay key={el.id}
                  el={el as TextElement} slideId={slide.id}
                  ctrl={ctrl} wrapperStyle={wrapperStyle}
                  onDone={() => setEditingId(null)}
                />
              );
            }
            if (isEditing && el.type === "shape") {
              return (
                <ShapeEditOverlay key={el.id}
                  el={el as ShapeElement} slideId={slide.id}
                  ctrl={ctrl} wrapperStyle={wrapperStyle}
                  onDone={() => setEditingId(null)}
                />
              );
            }
            return (
              <div
                key={el.id}
                style={wrapperStyle}
                onMouseDown={(e) => onElementMouseDown(e, el)}
                onDoubleClick={(e) => {
                  if (el.type === "text" || el.type === "shape") {
                    e.stopPropagation();
                    ctrl.setSelection([el.id]);
                    setEditingId(el.id);
                  }
                }}
              >
                <div style={{ position: "absolute", inset: 0, pointerEvents: "none" }}>
                  <ElementView el={{ ...el, x: 0, y: 0, rotation: undefined } as SlideElement} />
                </div>
                {selected && (
                  <>
                    <div
                      onMouseDown={(e) => onRotateHandleMouseDown(e, el)}
                      style={{
                        position: "absolute",
                        left: el.w / 2 - HANDLE_SIZE / 2,
                        top: -HANDLE_SIZE / 2 - 28,
                        width: HANDLE_SIZE, height: HANDLE_SIZE,
                        background: "white",
                        border: "2px solid var(--oo-color-primary, #2563eb)",
                        borderRadius: "50%",
                        cursor: "grab",
                        display: "flex", alignItems: "center", justifyContent: "center",
                        fontSize: 9, userSelect: "none",
                      }}
                    >↻</div>
                    <div style={{
                      position: "absolute",
                      left: el.w / 2 - 0.5, top: -28,
                      width: 1, height: 28,
                      background: "var(--oo-color-primary, #2563eb)",
                      pointerEvents: "none",
                    }} />
                    {(["nw", "n", "ne", "e", "se", "s", "sw", "w"] as Handle[]).map((h) => {
                      const pos = handlePos(h, el.w, el.h);
                      return (
                        <div
                          key={h}
                          onMouseDown={(e) => onHandleMouseDown(e, el, h)}
                          style={{
                            position: "absolute",
                            left: pos.x - HANDLE_SIZE / 2,
                            top: pos.y - HANDLE_SIZE / 2,
                            width: HANDLE_SIZE, height: HANDLE_SIZE,
                            background: "white",
                            border: "2px solid var(--oo-color-primary, #2563eb)",
                            borderRadius: 3,
                            cursor: cursorFor(h),
                          }}
                        />
                      );
                    })}
                  </>
                )}
              </div>
            );
          })}
          {drag?.kind === "marquee" && (
            <div
              style={{
                position: "absolute",
                left: Math.min(drag.startX, drag.x),
                top: Math.min(drag.startY, drag.y),
                width: Math.abs(drag.x - drag.startX),
                height: Math.abs(drag.y - drag.startY),
                background: "rgba(37,99,235,0.1)",
                border: "1px dashed var(--oo-color-primary, #2563eb)",
                pointerEvents: "none",
              }}
            />
          )}
          {guides.map((g, i) => (
            <div
              key={i}
              style={{
                position: "absolute",
                background: "#ff00aa",
                pointerEvents: "none",
                ...(g.axis === "v"
                  ? { left: g.pos - 0.5, top: 0, width: 1, height: SLIDE_H }
                  : { top: g.pos - 0.5, left: 0, height: 1, width: SLIDE_W }),
              }}
            />
          ))}
        </ScaledSlide>
      </div>

      {/* Zoom badge */}
      <div style={{
        position: "absolute",
        bottom: 8, left: 8,
        padding: "2px 8px",
        background: "rgba(0,0,0,0.55)",
        color: "white",
        borderRadius: 4,
        fontSize: 11,
        pointerEvents: "none",
      }}>
        {Math.round(effectiveScale * 100)}%
      </div>
    </div>
  );
}

function handlePos(h: string, w: number, h2: number): { x: number; y: number } {
  const cx = w / 2, cy = h2 / 2;
  switch (h) {
    case "nw": return { x: 0, y: 0 };
    case "n": return { x: cx, y: 0 };
    case "ne": return { x: w, y: 0 };
    case "e": return { x: w, y: cy };
    case "se": return { x: w, y: h2 };
    case "s": return { x: cx, y: h2 };
    case "sw": return { x: 0, y: h2 };
    default: return { x: 0, y: cy };
  }
}
function cursorFor(h: string) {
  switch (h) {
    case "n": case "s": return "ns-resize";
    case "e": case "w": return "ew-resize";
    case "ne": case "sw": return "nesw-resize";
    default: return "nwse-resize";
  }
}
