// @orbitoffice/xlsx-io — placeholder-focused XLSX read.
// Walks xl/sharedStrings.xml + inline-strings in sheet*.xml.

import { readZip, entryAsText } from "../zip";
import { PLACEHOLDER_REGEX, autoMapPlaceholder, type SmartDocPlaceholder } from "../../packages/core/smartDocs";

function decodeRichText(node: string): string {
  // Concatenate every <t>...</t> inside the node.
  const tRe = /<t\b[^>]*>([\s\S]*?)<\/t>/g;
  let out = "";
  let m: RegExpExecArray | null;
  while ((m = tRe.exec(node))) out += m[1];
  return out
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'");
}

export async function readXlsxStrings(buf: ArrayBuffer): Promise<string[]> {
  const entries = await readZip(buf);
  const out: string[] = [];
  const ss = entryAsText(entries, "xl/sharedStrings.xml");
  if (ss) {
    const siRe = /<si\b[^>]*>([\s\S]*?)<\/si>/g;
    let m: RegExpExecArray | null;
    while ((m = siRe.exec(ss))) out.push(decodeRichText(m[1]));
  }
  // Inline strings in sheets
  for (const ent of entries) {
    if (!/^xl\/worksheets\/sheet\d+\.xml$/.test(ent.name)) continue;
    const xml = new TextDecoder().decode(ent.data);
    const isRe = /<is\b[^>]*>([\s\S]*?)<\/is>/g;
    let m: RegExpExecArray | null;
    while ((m = isRe.exec(xml))) out.push(decodeRichText(m[1]));
  }
  return out;
}

export async function detectXlsxPlaceholders(buf: ArrayBuffer): Promise<SmartDocPlaceholder[]> {
  const strings = await readXlsxStrings(buf);
  const map = new Map<string, SmartDocPlaceholder>();
  for (const s of strings) {
    PLACEHOLDER_REGEX.lastIndex = 0;
    let m: RegExpExecArray | null;
    while ((m = PLACEHOLDER_REGEX.exec(s))) {
      const key = m[1];
      const auto = autoMapPlaceholder(key);
      const id = `${auto.mapping_type}.${auto.mapping_key}.${key}`;
      const cur = map.get(id);
      if (cur) cur.occurrences = (cur.occurrences ?? 1) + 1;
      else map.set(id, { key, ...auto, occurrences: 1 });
    }
  }
  return [...map.values()];
}
