// @orbitoffice/slides — interactive canvas overlay (selection, drag, resize, inline text edit).
import { useEffect, useRef, useState } from "react";
import { useStore } from "../core/store";
import { ScaledSlide } from "./ScaledSlide";
import { ElementView } from "./ElementView";
import { SLIDE_H, SLIDE_W, getTheme, type SlideElement, type TextElement } from "./model";
import type { SlidesController } from "./controller";
import { snapMove, type Guide } from "./snap";

interface CanvasProps {
  ctrl: SlidesController;
}

const HANDLE_SIZE = 14;

export function Canvas({ ctrl }: CanvasProps) {
  const state = useStore(ctrl.store);
  const slide = state.deck.slides.find((s) => s.id === state.activeSlideId)!;
  const theme = getTheme(state.deck.themeId);

  const wrapRef = useRef<HTMLDivElement>(null);
  const [scale, setScale] = useState(0.5);
  const [editingId, setEditingId] = useState<string | null>(null);

  // Compute scale ourselves so we can map mouse → slide coords.
  useEffect(() => {
    const el = wrapRef.current;
    if (!el) return;
    const update = () => {
      const r = el.getBoundingClientRect();
      setScale(Math.min(r.width / SLIDE_W, r.height / SLIDE_H));
    };
    update();
    const ro = new ResizeObserver(update);
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  // Mouse → slide coords.
  function toSlide(clientX: number, clientY: number): { x: number; y: number } {
    const el = wrapRef.current!;
    const r = el.getBoundingClientRect();
    const cx = r.left + r.width / 2;
    const cy = r.top + r.height / 2;
    return {
      x: SLIDE_W / 2 + (clientX - cx) / scale,
      y: SLIDE_H / 2 + (clientY - cy) / scale,
    };
  }

  // ----- Drag/resize -----
  type Drag =
    | { kind: "move"; ids: string[]; startX: number; startY: number; orig: Map<string, { x: number; y: number }> }
    | { kind: "resize"; id: string; handle: Handle; startX: number; startY: number; orig: { x: number; y: number; w: number; h: number } }
    | { kind: "marquee"; startX: number; startY: number; x: number; y: number };
  type Handle = "nw" | "n" | "ne" | "e" | "se" | "s" | "sw" | "w";

  const [drag, setDrag] = useState<Drag | null>(null);
  const [guides, setGuides] = useState<Guide[]>([]);

  useEffect(() => {
    if (!drag) return;
    const onMove = (e: MouseEvent) => {
      const p = toSlide(e.clientX, e.clientY);
      if (drag.kind === "move") {
        const dx = p.x - drag.startX;
        const dy = p.y - drag.startY;
        // Snap using the first selected element's bbox.
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
  }, [drag, ctrl, slide.id, slide.elements, scale]);

  function onElementMouseDown(e: React.MouseEvent, el: SlideElement) {
    if (editingId === el.id) return;
    e.stopPropagation();
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

  function onCanvasMouseDown(e: React.MouseEvent) {
    if (e.target !== e.currentTarget && (e.target as HTMLElement).dataset.canvasBg !== "1") {
      // not the empty area
    }
    if (editingId) setEditingId(null);
    ctrl.setSelection([]);
    const p = toSlide(e.clientX, e.clientY);
    setDrag({ kind: "marquee", startX: p.x, startY: p.y, x: p.x, y: p.y });
  }

  // Keyboard nav (delete, arrows, esc)
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
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [ctrl, slide.id, slide.elements, state.selectedIds, editingId]);

  return (
    <div
      ref={wrapRef}
      style={{
        flex: 1,
        position: "relative",
        overflow: "hidden",
        background: "var(--oo-color-bg-alt, #f1f1f1)",
      }}
      onMouseDown={onCanvasMouseDown}
    >
      <ScaledSlide slide={slide} theme={theme} autoFit>
        {slide.elements.map((el) => {
          const selected = state.selectedIds.includes(el.id);
          const isEditing = editingId === el.id && el.type === "text";
          const wrapperStyle: React.CSSProperties = {
            position: "absolute",
            left: el.x, top: el.y, width: el.w, height: el.h,
            outline: selected ? "2px solid var(--oo-color-primary, #2563eb)" : "none",
            cursor: "move",
            transform: el.rotation ? `rotate(${el.rotation}deg)` : undefined,
          };
          if (isEditing && el.type === "text") {
            return (
              <div
                key={el.id}
                style={wrapperStyle}
                onMouseDown={(e) => e.stopPropagation()}
              >
                <div
                  contentEditable
                  suppressContentEditableWarning
                  autoFocus
                  ref={(node) => { if (node) node.innerHTML = el.html; }}
                  onBlur={(e) => {
                    ctrl.updateElement(slide.id, el.id, { html: e.currentTarget.innerHTML });
                    setEditingId(null);
                  }}
                  style={{
                    width: "100%", height: "100%",
                    color: el.color, fontSize: el.fontSize,
                    fontWeight: el.bold ? 700 : 400,
                    fontStyle: el.italic ? "italic" : undefined,
                    textDecoration: el.underline ? "underline" : undefined,
                    textAlign: (el as TextElement).align,
                    lineHeight: 1.25,
                    outline: "1px dashed var(--oo-color-primary, #2563eb)",
                    background: "rgba(255,255,255,0.04)",
                  }}
                />
              </div>
            );
          }
          return (
            <div
              key={el.id}
              style={wrapperStyle}
              onMouseDown={(e) => onElementMouseDown(e, el)}
              onDoubleClick={(e) => {
                if (el.type === "text") {
                  e.stopPropagation();
                  ctrl.setSelection([el.id]);
                  setEditingId(el.id);
                }
              }}
            >
              {/* render element content */}
              <div style={{ position: "absolute", inset: 0, pointerEvents: "none" }}>
                <ElementView el={{ ...el, x: 0, y: 0, rotation: undefined } as SlideElement} />
              </div>
              {selected && (
                <>
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
                          width: HANDLE_SIZE,
                          height: HANDLE_SIZE,
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
      <div
        style={{
          position: "absolute",
          bottom: 8,
          left: 8,
          padding: "2px 8px",
          background: "rgba(0,0,0,0.6)",
          color: "white",
          borderRadius: 4,
          fontSize: 11,
          pointerEvents: "none",
        }}
      >
        {Math.round(scale * 100)}%
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
