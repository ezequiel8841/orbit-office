// @orbitoffice/pptx-io — placeholder-focused PPTX read.
// Walks ppt/slides/slide*.xml and consolidates <a:t> per <a:p>.

import { readZip, entryAsText } from "../zip";
import { PLACEHOLDER_REGEX, autoMapPlaceholder, type SmartDocPlaceholder } from "../../packages/core/smartDocs";

export interface PptxSlideText { slide: number; paragraphs: string[] }

export async function readPptxText(buf: ArrayBuffer): Promise<PptxSlideText[]> {
  const entries = await readZip(buf);
  const out: PptxSlideText[] = [];
  const slideRe = /^ppt\/slides\/slide(\d+)\.xml$/;
  const slideEntries = entries
    .filter((e) => slideRe.test(e.name))
    .sort((a, b) => Number(a.name.match(slideRe)![1]) - Number(b.name.match(slideRe)![1]));
  for (const ent of slideEntries) {
    const xml = entryAsText(entries, ent.name) ?? "";
    const idx = Number(ent.name.match(slideRe)![1]);
    const paragraphs: string[] = [];
    const pRe = /<a:p\b[^>]*>([\s\S]*?)<\/a:p>/g;
    let m: RegExpExecArray | null;
    while ((m = pRe.exec(xml))) {
      const tRe = /<a:t\b[^>]*>([\s\S]*?)<\/a:t>/g;
      let text = "";
      let t: RegExpExecArray | null;
      while ((t = tRe.exec(m[1]))) text += t[1];
      paragraphs.push(text
        .replace(/&amp;/g, "&")
        .replace(/&lt;/g, "<")
        .replace(/&gt;/g, ">")
        .replace(/&quot;/g, '"')
        .replace(/&apos;/g, "'"));
    }
    out.push({ slide: idx, paragraphs });
  }
  return out;
}

export async function detectPptxPlaceholders(buf: ArrayBuffer): Promise<SmartDocPlaceholder[]> {
  const slides = await readPptxText(buf);
  const map = new Map<string, SmartDocPlaceholder>();
  for (const sl of slides) {
    for (const p of sl.paragraphs) {
      PLACEHOLDER_REGEX.lastIndex = 0;
      let m: RegExpExecArray | null;
      while ((m = PLACEHOLDER_REGEX.exec(p))) {
        const key = m[1];
        const auto = autoMapPlaceholder(key);
        const id = `${auto.mapping_type}.${auto.mapping_key}.${key}`;
        const cur = map.get(id);
        if (cur) {
          cur.occurrences = (cur.occurrences ?? 1) + 1;
          if (!cur.slide_indices?.includes(sl.slide)) cur.slide_indices?.push(sl.slide);
        } else {
          map.set(id, { key, ...auto, occurrences: 1, slide_indices: [sl.slide] });
        }
      }
    }
  }
  return [...map.values()];
}
