// @orbitoffice/xlsx-io — placeholder XLSX read + write. Deno/edge-safe.

import { readZip, writeZip, entryAsText, type ZipEntry } from "../zip";
import { PLACEHOLDER_REGEX, autoMapPlaceholder, type SmartDocPlaceholder } from "../../packages/core/smartDocs";
import type { SerializedWorkbook } from "../../packages/sheet/persist";
import type { CellStyle, MergeRect } from "../../packages/sheet/model";

// ──────────────────────────────────────────────────────────────────────────────
// READ
// ──────────────────────────────────────────────────────────────────────────────

function decodeRichText(node: string): string {
  const tRe = /<t\b[^>]*>([\s\S]*?)<\/t>/g;
  let out = "", m: RegExpExecArray | null;
  while ((m = tRe.exec(node))) out += m[1];
  return out
    .replace(/&amp;/g, "&").replace(/&lt;/g, "<").replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"').replace(/&apos;/g, "'");
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

// ──────────────────────────────────────────────────────────────────────────────
// WRITE  (writeXlsxFromWorkbook)
// ──────────────────────────────────────────────────────────────────────────────
//
// Deno-safe: no DOMParser, no document, no window.
// Column widths assumed in pixels (÷7 → XLSX character units).
// Row heights assumed in pixels (×0.75 → pt).

type Sheet  = SerializedWorkbook["sheets"][number];
type SCell  = Sheet["cells"][string];

// ── Utilities ──

function txt(s: string): Uint8Array { return new TextEncoder().encode(s); }

function escXml(s: string): string {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;")
          .replace(/"/g, "&quot;").replace(/'/g, "&apos;");
}

function hexColor(c?: string | null): string | null {
  if (!c || c === "transparent" || c === "none") return null;
  const h6 = /^#([0-9a-f]{6})$/i.exec(c);
  if (h6) return h6[1].toUpperCase();
  const h3 = /^#([0-9a-f]{3})$/i.exec(c);
  if (h3) return h3[1].split("").map((x) => x + x).join("").toUpperCase();
  return null;
}

function relsDoc(rels: string[]): string {
  return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>\n` +
    `<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">` +
    rels.join("") + `</Relationships>`;
}

// ── Address helpers ──

function idxToCol(idx: number): string {
  // 0 → "A", 25 → "Z", 26 → "AA"
  let col = "";
  let n = idx + 1;
  while (n > 0) {
    const r = (n - 1) % 26;
    col = String.fromCharCode(65 + r) + col;
    n = Math.floor((n - 1) / 26);
  }
  return col;
}

function colToIdx(col: string): number {
  let idx = 0;
  for (const ch of col.toUpperCase()) idx = idx * 26 + (ch.charCodeAt(0) - 64);
  return idx - 1; // 0-based
}

function parseAddr(addr: string): { row: number; col: number; ref: string } {
  const m = /^([A-Z]+)(\d+)$/i.exec(addr);
  if (!m) return { row: 0, col: 0, ref: addr.toUpperCase() };
  return { row: parseInt(m[2], 10) - 1, col: colToIdx(m[1]), ref: addr.toUpperCase() };
}

function mergeRef(mr: MergeRect): string {
  return `${idxToCol(mr.c1)}${mr.r1 + 1}:${idxToCol(mr.c2)}${mr.r2 + 1}`;
}

// ── Number format IDs ──

function numFmtId(fmt?: CellStyle["format"]): number {
  switch (fmt) {
    case "integer":  return 1;
    case "number":   return 2;
    case "percent":  return 9;
    case "date":     return 14;
    case "currency": return 164; // custom: #,##0.00
    default:         return 0;
  }
}

// ── Style table ──

interface XfEntry {
  fontIdx: number;
  fillIdx: number;
  borderIdx: number;
  nfId: number;
  alignH?: "left" | "center" | "right";
  wrap?: boolean;
}

class StyleTable {
  private fontMap   = new Map<string, number>();
  private fillMap   = new Map<string, number>();
  private borderMap = new Map<string, number>();
  private xfMap     = new Map<string, number>();

  // index 0 = defaults
  readonly fonts:   string[] = [this._fontXml({})];
  readonly fills:   string[] = ["<fill><patternFill patternType=\"none\"/></fill>",
                                 "<fill><patternFill patternType=\"gray125\"/></fill>"];
  readonly borders: string[] = [this._borderXml({})];
  readonly xfs:     XfEntry[] = [{ fontIdx: 0, fillIdx: 0, borderIdx: 0, nfId: 0 }];

  private _fontXml(s: CellStyle): string {
    let xml = "<font>";
    if (s.bold)       xml += "<b/>";
    if (s.italic)     xml += "<i/>";
    if (s.underline)  xml += "<u/>";
    const sz = s.fontSize ? Math.max(1, Math.round(s.fontSize * 0.75)) : 0;
    if (sz)           xml += `<sz val="${sz}"/>`;
    const ch = hexColor(s.color);
    if (ch)           xml += `<color rgb="FF${ch}"/>`;
    xml += `<name val="${escXml(s.fontFamily || "Calibri")}"/>`;
    xml += "<family val=\"2\"/></font>";
    return xml;
  }

  private _borderXml(b: NonNullable<CellStyle["borders"]>): string {
    const side = (on?: boolean, tag = "") =>
      on ? `<${tag} style="thin"><color rgb="FF000000"/></${tag}>` : `<${tag}/>`;
    return `<border>` +
      side(b.left, "left") + side(b.right, "right") +
      side(b.top, "top")   + side(b.bottom, "bottom") +
      `<diagonal/></border>`;
  }

  private _fontKey(s: CellStyle): string {
    return `${+!!s.bold}${+!!s.italic}${+!!s.underline}|${s.fontSize ?? ""}|${s.color ?? ""}|${s.fontFamily ?? ""}`;
  }

  getFontIdx(s?: CellStyle): number {
    if (!s) return 0;
    if (!s.bold && !s.italic && !s.underline && !s.fontSize && !s.color && !s.fontFamily) return 0;
    const key = this._fontKey(s);
    let idx = this.fontMap.get(key);
    if (idx === undefined) {
      idx = this.fonts.length;
      this.fonts.push(this._fontXml(s));
      this.fontMap.set(key, idx);
    }
    return idx;
  }

  getFillIdx(s?: CellStyle): number {
    if (!s?.bg) return 0;
    const hex = hexColor(s.bg);
    if (!hex) return 0;
    let idx = this.fillMap.get(hex);
    if (idx === undefined) {
      idx = this.fills.length;
      this.fills.push(
        `<fill><patternFill patternType="solid">` +
        `<fgColor rgb="FF${hex}"/><bgColor indexed="64"/>` +
        `</patternFill></fill>`,
      );
      this.fillMap.set(hex, idx);
    }
    return idx;
  }

  getBorderIdx(s?: CellStyle): number {
    if (!s?.borders) return 0;
    const b = s.borders;
    const key = `${+!!b.top}${+!!b.right}${+!!b.bottom}${+!!b.left}`;
    if (key === "0000") return 0;
    let idx = this.borderMap.get(key);
    if (idx === undefined) {
      idx = this.borders.length;
      this.borders.push(this._borderXml(b));
      this.borderMap.set(key, idx);
    }
    return idx;
  }

  getXfIdx(s?: CellStyle): number {
    if (!s) return 0;
    const fontIdx   = this.getFontIdx(s);
    const fillIdx   = this.getFillIdx(s);
    const borderIdx = this.getBorderIdx(s);
    const nfId      = numFmtId(s.format);
    if (fontIdx === 0 && fillIdx === 0 && borderIdx === 0 && nfId === 0 && !s.align && !s.wrapText) return 0;
    const key = `${fontIdx}|${fillIdx}|${borderIdx}|${nfId}|${s.align ?? ""}|${+!!s.wrapText}`;
    let idx = this.xfMap.get(key);
    if (idx === undefined) {
      idx = this.xfs.length;
      this.xfs.push({ fontIdx, fillIdx, borderIdx, nfId, alignH: s.align, wrap: s.wrapText });
      this.xfMap.set(key, idx);
    }
    return idx;
  }

  buildStylesXml(hasCurrency: boolean): string {
    const numFmts = hasCurrency
      ? `<numFmts count="1"><numFmt numFmtId="164" formatCode="#,##0.00"/></numFmts>`
      : `<numFmts count="0"/>`;

    const xfsXml = this.xfs.map((xf) => {
      const applyNum    = xf.nfId !== 0   ? ` applyNumberFormat="1"` : "";
      const applyFont   = xf.fontIdx !== 0   ? ` applyFont="1"` : "";
      const applyFill   = xf.fillIdx !== 0   ? ` applyFill="1"` : "";
      const applyBorder = xf.borderIdx !== 0 ? ` applyBorder="1"` : "";
      const hasAlign    = xf.alignH || xf.wrap;
      const applyAlign  = hasAlign ? ` applyAlignment="1"` : "";
      const alignXml    = hasAlign
        ? `<alignment${xf.alignH ? ` horizontal="${xf.alignH}"` : ""}${xf.wrap ? ` wrapText="1"` : ""}/>`
        : "";
      const open = `<xf numFmtId="${xf.nfId}" fontId="${xf.fontIdx}" fillId="${xf.fillIdx}" borderId="${xf.borderIdx}" xfId="0"`;
      return hasAlign
        ? `${open}${applyNum}${applyFont}${applyFill}${applyBorder}${applyAlign}>${alignXml}</xf>`
        : `${open}${applyNum}${applyFont}${applyFill}${applyBorder}/>`;
    }).join("");

    return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>\n` +
      `<styleSheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main">` +
      numFmts +
      `<fonts count="${this.fonts.length}">${this.fonts.join("")}</fonts>` +
      `<fills count="${this.fills.length}">${this.fills.join("")}</fills>` +
      `<borders count="${this.borders.length}">${this.borders.join("")}</borders>` +
      `<cellStyleXfs count="1"><xf numFmtId="0" fontId="0" fillId="0" borderId="0"/></cellStyleXfs>` +
      `<cellXfs count="${this.xfs.length}">${xfsXml}</cellXfs>` +
      `<cellStyles count="1"><cellStyle name="Normal" xfId="0" builtinId="0"/></cellStyles>` +
      `</styleSheet>`;
  }
}

// ── Shared strings ──

class SharedStrings {
  private map = new Map<string, number>();
  readonly list: string[] = [];

  getIdx(s: string): number {
    let idx = this.map.get(s);
    if (idx === undefined) {
      idx = this.list.length;
      this.list.push(s);
      this.map.set(s, idx);
    }
    return idx;
  }

  buildXml(): string {
    const items = this.list
      .map((s) => `<si><t xml:space="preserve">${escXml(s)}</t></si>`)
      .join("");
    return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>\n` +
      `<sst xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" ` +
      `count="${this.list.length}" uniqueCount="${this.list.length}">` +
      items + `</sst>`;
  }
}

// ── Worksheet XML builder ──

function worksheetXml(
  sheet: Sheet,
  ss: SharedStrings,
  styles: StyleTable,
): string {
  // Sort cell keys row-major (ascending row, then col)
  const cellKeys = Object.keys(sheet.cells).sort((a, b) => {
    const pa = parseAddr(a), pb = parseAddr(b);
    return pa.row !== pb.row ? pa.row - pb.row : pa.col - pb.col;
  });

  // Group by row
  const rowMap = new Map<number, Array<{ ref: string; cell: SCell }>>();
  for (const key of cellKeys) {
    const { row, ref } = parseAddr(key);
    const cell = sheet.cells[key];
    if (!rowMap.has(row)) rowMap.set(row, []);
    rowMap.get(row)!.push({ ref, cell });
  }

  // cols (column widths)
  let colsXml = "";
  const colEntries = Object.entries(sheet.cols).sort((a, b) => Number(a[0]) - Number(b[0]));
  if (colEntries.length > 0) {
    const colDefs = colEntries.map(([idxStr, w]) => {
      const col1 = Number(idxStr) + 1; // 1-based
      const xlsxW = Math.max(1, Math.round((w / 7) * 100) / 100);
      return `<col min="${col1}" max="${col1}" width="${xlsxW}" customWidth="1"/>`;
    }).join("");
    colsXml = `<cols>${colDefs}</cols>`;
  }

  // sheetData
  const rowNums = [...rowMap.keys()].sort((a, b) => a - b);
  const rowsXml = rowNums.map((rowIdx) => {
    const rowNum = rowIdx + 1;
    const rowH   = sheet.rows[rowIdx];
    const htAttr = rowH ? ` ht="${Math.max(1, Math.round(rowH * 0.75 * 100) / 100)}" customHeight="1"` : "";
    const cells  = rowMap.get(rowIdx)!;
    const cellsXml = cells.map(({ ref, cell }) => {
      const xfIdx = styles.getXfIdx(cell.s);
      const sAttr = xfIdx !== 0 ? ` s="${xfIdx}"` : "";
      const v = cell.v;

      if (cell.f) {
        // Formula — value is empty (calculated on open)
        return `<c r="${ref}"${sAttr}><f>${escXml(cell.f)}</f><v/></c>`;
      }
      if (v === null || v === undefined) {
        return sAttr ? `<c r="${ref}"${sAttr}/>` : "";
      }
      if (typeof v === "boolean") {
        return `<c r="${ref}" t="b"${sAttr}><v>${v ? 1 : 0}</v></c>`;
      }
      if (typeof v === "number") {
        return `<c r="${ref}"${sAttr}><v>${v}</v></c>`;
      }
      // String
      const idx = ss.getIdx(String(v));
      return `<c r="${ref}" t="s"${sAttr}><v>${idx}</v></c>`;
    }).filter(Boolean).join("");

    return `<row r="${rowNum}"${htAttr}>${cellsXml}</row>`;
  }).join("");

  // mergeCells
  let mergeXml = "";
  if (sheet.merges && sheet.merges.length > 0) {
    const refs = sheet.merges.map((mr) => `<mergeCell ref="${mergeRef(mr)}"/>`).join("");
    mergeXml = `<mergeCells count="${sheet.merges.length}">${refs}</mergeCells>`;
  }

  // freezePane
  let sheetViewXml = `<sheetViews><sheetView tabSelected="1" workbookViewId="0">`;
  if (sheet.freezeRows || sheet.freezeCols) {
    const fr = sheet.freezeRows ?? 0;
    const fc = sheet.freezeCols ?? 0;
    const activeCell = `${idxToCol(fc)}${fr + 1}`;
    sheetViewXml +=
      `<pane xSplit="${fc}" ySplit="${fr}" topLeftCell="${activeCell}" activePane="bottomRight" state="frozen"/>`;
  }
  sheetViewXml += `</sheetView></sheetViews>`;

  return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>\n` +
    `<worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" ` +
    `xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships">` +
    sheetViewXml +
    `<sheetFormatPr defaultRowHeight="15"/>` +
    colsXml +
    `<sheetData>${rowsXml}</sheetData>` +
    mergeXml +
    `</worksheet>`;
}

// ── Main export ──

/**
 * Converts an orbit-office SerializedWorkbook (JSON) to an XLSX buffer.
 * Runs in browser, Deno, and Cloudflare Workers (no DOM APIs).
 */
export async function writeXlsxFromWorkbook(wb: SerializedWorkbook): Promise<ArrayBuffer> {
  const entries: ZipEntry[] = [];
  const ss     = new SharedStrings();
  const styles = new StyleTable();

  // Detect if any cell uses currency format (for custom numFmt entry)
  const hasCurrency = wb.sheets.some((s) =>
    Object.values(s.cells).some((c) => c.s?.format === "currency"),
  );

  // Pre-register all styles and strings (so indices are stable)
  for (const sheet of wb.sheets) {
    for (const cell of Object.values(sheet.cells)) {
      styles.getXfIdx(cell.s);
      if (cell.v !== null && cell.v !== undefined && typeof cell.v === "string") {
        ss.getIdx(cell.v);
      }
    }
  }

  // Worksheets
  for (let i = 0; i < wb.sheets.length; i++) {
    const sheet = wb.sheets[i];
    entries.push({
      name: `xl/worksheets/sheet${i + 1}.xml`,
      data: txt(worksheetXml(sheet, ss, styles)),
    });
    // Minimal worksheet rels (no external refs needed for now)
    entries.push({
      name: `xl/worksheets/_rels/sheet${i + 1}.xml.rels`,
      data: txt(relsDoc([])),
    });
  }

  // Shared strings
  entries.push({ name: "xl/sharedStrings.xml", data: txt(ss.buildXml()) });

  // Styles
  entries.push({ name: "xl/styles.xml", data: txt(styles.buildStylesXml(hasCurrency)) });

  // Workbook
  const sheetsXml = wb.sheets.map((s, i) =>
    `<sheet name="${escXml(s.name)}" sheetId="${i + 1}" r:id="rId${i + 1}"/>`,
  ).join("");

  entries.push({
    name: "xl/workbook.xml",
    data: txt(
      `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>\n` +
      `<workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" ` +
      `xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships">` +
      `<bookViews><workbookView xWindow="0" yWindow="0" windowWidth="20000" windowHeight="15000"/></bookViews>` +
      `<sheets>${sheetsXml}</sheets>` +
      `</workbook>`,
    ),
  });

  // Workbook rels
  const wbRels = [
    ...wb.sheets.map((_, i) =>
      `<Relationship Id="rId${i + 1}" ` +
      `Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" ` +
      `Target="worksheets/sheet${i + 1}.xml"/>`,
    ),
    `<Relationship Id="rId${wb.sheets.length + 1}" ` +
    `Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/sharedStrings" ` +
    `Target="sharedStrings.xml"/>`,
    `<Relationship Id="rId${wb.sheets.length + 2}" ` +
    `Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/styles" ` +
    `Target="styles.xml"/>`,
  ];
  entries.push({ name: "xl/_rels/workbook.xml.rels", data: txt(relsDoc(wbRels)) });

  // Root rels
  entries.push({
    name: "_rels/.rels",
    data: txt(relsDoc([
      `<Relationship Id="rId1" ` +
      `Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" ` +
      `Target="xl/workbook.xml"/>`,
    ])),
  });

  // Content types
  const sheetOverrides = wb.sheets.map((_, i) =>
    `<Override PartName="/xl/worksheets/sheet${i + 1}.xml" ` +
    `ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/>`,
  ).join("");

  entries.push({
    name: "[Content_Types].xml",
    data: txt(
      `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>\n` +
      `<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">` +
      `<Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>` +
      `<Default Extension="xml" ContentType="application/xml"/>` +
      `<Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/>` +
      `<Override PartName="/xl/sharedStrings.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sharedStrings+xml"/>` +
      `<Override PartName="/xl/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.styles+xml"/>` +
      sheetOverrides +
      `</Types>`,
    ),
  });

  return writeZip(entries);
}
