// @orbitoffice/sheet — Smart Docs placeholder helpers.
import { PLACEHOLDER_REGEX, autoMapPlaceholder, type SmartDocPlaceholder } from "../core/smartDocs";
import type { SheetData } from "./model";

export interface WorkbookLike { sheets: SheetData[] }

export function extractWorkbookPlaceholders(wb: WorkbookLike): SmartDocPlaceholder[] {
  const map = new Map<string, SmartDocPlaceholder>();
  for (const sh of wb.sheets) {
    sh.cells.forEach((cell) => {
      if (typeof cell.v !== "string") return;
      PLACEHOLDER_REGEX.lastIndex = 0;
      let m: RegExpExecArray | null;
      while ((m = PLACEHOLDER_REGEX.exec(cell.v))) {
        const key = m[1];
        const auto = autoMapPlaceholder(key);
        const id = `${auto.mapping_type}.${auto.mapping_key}.${key}`;
        const cur = map.get(id);
        if (cur) cur.occurrences = (cur.occurrences ?? 1) + 1;
        else map.set(id, { key, ...auto, occurrences: 1 });
      }
    });
  }
  return [...map.values()];
}
