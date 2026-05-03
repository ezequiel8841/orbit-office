// @orbitoffice/slides — Smart Docs placeholder helpers.
import { PLACEHOLDER_REGEX, autoMapPlaceholder, type SmartDocPlaceholder } from "../core/smartDocs";
import type { Deck, SlideElement } from "./model";

function elementText(el: SlideElement): string {
  if (el.type === "text") {
    // strip HTML
    return el.html.replace(/<[^>]+>/g, " ");
  }
  return "";
}

export function extractDeckPlaceholders(deck: Deck): SmartDocPlaceholder[] {
  const map = new Map<string, SmartDocPlaceholder>();
  deck.slides.forEach((slide, idx) => {
    const slideIdx = idx + 1;
    for (const el of slide.elements) {
      const text = elementText(el);
      if (!text) continue;
      PLACEHOLDER_REGEX.lastIndex = 0;
      let m: RegExpExecArray | null;
      while ((m = PLACEHOLDER_REGEX.exec(text))) {
        const key = m[1];
        const auto = autoMapPlaceholder(key);
        const id = `${auto.mapping_type}.${auto.mapping_key}.${key}`;
        const cur = map.get(id);
        if (cur) {
          cur.occurrences = (cur.occurrences ?? 1) + 1;
          if (!cur.slide_indices?.includes(slideIdx)) cur.slide_indices?.push(slideIdx);
        } else {
          map.set(id, { key, ...auto, occurrences: 1, slide_indices: [slideIdx] });
        }
      }
    }
  });
  return [...map.values()];
}
