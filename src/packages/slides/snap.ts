// @orbitoffice/slides — snap + smart guides helpers (zero deps).
import { SLIDE_W, SLIDE_H, type SlideElement } from "./model";

export interface Guide {
  axis: "v" | "h";
  /** Slide-space coordinate in pixels. */
  pos: number;
}

export interface SnapResult {
  x: number;
  y: number;
  guides: Guide[];
}

const SNAP_PX = 6;
const GRID = 20;

/** Returns important alignment lines (left/center/right + top/middle/bottom) plus slide center. */
function targetsFor(els: SlideElement[]): { v: number[]; h: number[] } {
  const v: number[] = [0, SLIDE_W / 2, SLIDE_W];
  const h: number[] = [0, SLIDE_H / 2, SLIDE_H];
  for (const e of els) {
    v.push(e.x, e.x + e.w / 2, e.x + e.w);
    h.push(e.y, e.y + e.h / 2, e.y + e.h);
  }
  return { v, h };
}

/** Snap a moving element's bbox (x,y,w,h) against `others`. */
export function snapMove(
  x: number,
  y: number,
  w: number,
  h: number,
  others: SlideElement[],
  opts: { grid?: boolean } = {},
): SnapResult {
  const { v, h: H } = targetsFor(others);
  const guides: Guide[] = [];
  let nx = x, ny = y;

  // Snap candidate positions for the moving box.
  const candX = [x, x + w / 2, x + w];
  const candY = [y, y + h / 2, y + h];

  let bestDx = SNAP_PX + 1, bestDxIdx = -1, bestDxTarget = 0;
  for (let i = 0; i < candX.length; i++) {
    for (const t of v) {
      const d = Math.abs(candX[i] - t);
      if (d < bestDx) { bestDx = d; bestDxIdx = i; bestDxTarget = t; }
    }
  }
  let bestDy = SNAP_PX + 1, bestDyIdx = -1, bestDyTarget = 0;
  for (let i = 0; i < candY.length; i++) {
    for (const t of H) {
      const d = Math.abs(candY[i] - t);
      if (d < bestDy) { bestDy = d; bestDyIdx = i; bestDyTarget = t; }
    }
  }

  if (bestDxIdx >= 0) {
    nx = bestDxTarget - [0, w / 2, w][bestDxIdx];
    guides.push({ axis: "v", pos: bestDxTarget });
  } else if (opts.grid) {
    nx = Math.round(x / GRID) * GRID;
  }
  if (bestDyIdx >= 0) {
    ny = bestDyTarget - [0, h / 2, h][bestDyIdx];
    guides.push({ axis: "h", pos: bestDyTarget });
  } else if (opts.grid) {
    ny = Math.round(y / GRID) * GRID;
  }
  return { x: nx, y: ny, guides };
}

// ---------- Align / Distribute ----------
export type AlignKind = "left" | "centerH" | "right" | "top" | "middle" | "bottom";
export type DistributeKind = "h" | "v";

export function align(els: SlideElement[], kind: AlignKind): Map<string, { x?: number; y?: number }> {
  const out = new Map<string, { x?: number; y?: number }>();
  if (els.length === 0) return out;
  if (kind === "left") {
    const m = Math.min(...els.map((e) => e.x));
    els.forEach((e) => out.set(e.id, { x: m }));
  } else if (kind === "right") {
    const m = Math.max(...els.map((e) => e.x + e.w));
    els.forEach((e) => out.set(e.id, { x: m - e.w }));
  } else if (kind === "centerH") {
    const m = (Math.min(...els.map((e) => e.x)) + Math.max(...els.map((e) => e.x + e.w))) / 2;
    els.forEach((e) => out.set(e.id, { x: m - e.w / 2 }));
  } else if (kind === "top") {
    const m = Math.min(...els.map((e) => e.y));
    els.forEach((e) => out.set(e.id, { y: m }));
  } else if (kind === "bottom") {
    const m = Math.max(...els.map((e) => e.y + e.h));
    els.forEach((e) => out.set(e.id, { y: m - e.h }));
  } else if (kind === "middle") {
    const m = (Math.min(...els.map((e) => e.y)) + Math.max(...els.map((e) => e.y + e.h))) / 2;
    els.forEach((e) => out.set(e.id, { y: m - e.h / 2 }));
  }
  return out;
}

export function distribute(els: SlideElement[], kind: DistributeKind): Map<string, { x?: number; y?: number }> {
  const out = new Map<string, { x?: number; y?: number }>();
  if (els.length < 3) return out;
  const sorted = [...els].sort((a, b) => (kind === "h" ? a.x - b.x : a.y - b.y));
  const first = sorted[0];
  const last = sorted[sorted.length - 1];
  if (kind === "h") {
    const span = (last.x + last.w / 2) - (first.x + first.w / 2);
    const step = span / (sorted.length - 1);
    sorted.forEach((e, i) => {
      if (i === 0 || i === sorted.length - 1) return;
      const cx = (first.x + first.w / 2) + step * i;
      out.set(e.id, { x: cx - e.w / 2 });
    });
  } else {
    const span = (last.y + last.h / 2) - (first.y + first.h / 2);
    const step = span / (sorted.length - 1);
    sorted.forEach((e, i) => {
      if (i === 0 || i === sorted.length - 1) return;
      const cy = (first.y + first.h / 2) + step * i;
      out.set(e.id, { y: cy - e.h / 2 });
    });
  }
  return out;
}
