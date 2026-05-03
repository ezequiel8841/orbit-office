// @orbitoffice/doc — automatic table of contents.
import type { Block, DocFragment } from "./model";

export interface TocEntry { level: number; text: string; id: string; }

function slugify(s: string): string {
  return s
    .toLowerCase()
    .normalize("NFD").replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9\s-]/g, "")
    .trim()
    .replace(/\s+/g, "-")
    .slice(0, 64);
}

function inlineText(b: Block): string {
  return (b.children ?? []).map((c) => (c.type === "text" ? c.text : "")).join("");
}

export function buildToc(doc: DocFragment): TocEntry[] {
  const out: TocEntry[] = [];
  const seen = new Map<string, number>();
  for (const b of doc.blocks) {
    const m = /^h([1-6])$/.exec(b.type);
    if (!m) continue;
    const level = Number(m[1]);
    const text = inlineText(b).trim();
    if (!text) continue;
    let id = slugify(text);
    const n = seen.get(id) ?? 0;
    if (n > 0) id = `${id}-${n}`;
    seen.set(slugify(text), n + 1);
    out.push({ level, text, id });
  }
  return out;
}

export function buildTocFromHtml(root: HTMLElement): TocEntry[] {
  const out: TocEntry[] = [];
  const seen = new Map<string, number>();
  root.querySelectorAll("h1,h2,h3,h4,h5,h6").forEach((h) => {
    const level = Number(h.tagName.slice(1));
    const text = (h.textContent ?? "").trim();
    if (!text) return;
    let id = slugify(text);
    const n = seen.get(id) ?? 0;
    if (n > 0) id = `${id}-${n}`;
    seen.set(slugify(text), n + 1);
    if (!h.id) h.id = id;
    out.push({ level, text, id: h.id });
  });
  return out;
}
