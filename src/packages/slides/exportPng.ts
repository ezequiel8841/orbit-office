// @orbitoffice/slides — PNG export via SVG foreignObject + canvas (zero deps).
import { SLIDE_W, SLIDE_H, type Slide, type Deck } from "./model";

/** Renders a slide DOM element to a PNG data URL.
 *  Note: external images must be CORS-enabled or pre-converted to data URLs. */
export async function slideToPng(
  slideEl: HTMLElement,
  width = SLIDE_W,
  height = SLIDE_H,
  scale = 1,
): Promise<string> {
  const xml = new XMLSerializer().serializeToString(slideEl);
  const svg =
    `<svg xmlns="http://www.w3.org/2000/svg" width="${width * scale}" height="${height * scale}" viewBox="0 0 ${width} ${height}">` +
    `<foreignObject x="0" y="0" width="${width}" height="${height}">` +
    `<div xmlns="http://www.w3.org/1999/xhtml" style="width:${width}px;height:${height}px">${xml}</div>` +
    `</foreignObject></svg>`;
  const blob = new Blob([svg], { type: "image/svg+xml;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  try {
    const img = await loadImage(url);
    const canvas = document.createElement("canvas");
    canvas.width = width * scale;
    canvas.height = height * scale;
    const ctx = canvas.getContext("2d")!;
    ctx.fillStyle = "#fff";
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    ctx.drawImage(img, 0, 0);
    return canvas.toDataURL("image/png");
  } finally {
    URL.revokeObjectURL(url);
  }
}

function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((res, rej) => {
    const img = new Image();
    img.onload = () => res(img);
    img.onerror = rej;
    img.src = src;
  });
}

/** Triggers a browser download of arbitrary data. */
export function download(filename: string, dataUrl: string) {
  const a = document.createElement("a");
  a.href = dataUrl;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
}

/** Helper to export the entire deck as a sequential set of PNGs. */
export async function deckToPngs(
  deck: Deck,
  resolveSlideEl: (slide: Slide) => HTMLElement | null,
  scale = 1,
): Promise<{ slideId: string; png: string }[]> {
  const out: { slideId: string; png: string }[] = [];
  for (const s of deck.slides) {
    const el = resolveSlideEl(s);
    if (!el) continue;
    out.push({ slideId: s.id, png: await slideToPng(el, deck.size.w, deck.size.h, scale) });
  }
  return out;
}
