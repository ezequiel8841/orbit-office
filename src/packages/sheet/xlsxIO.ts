// Native XLSX import/export — no external dependencies.
// XLSX is a ZIP of XML files (OOXML spec). We use the project's own zip.ts.
import { readZip, writeZip, entryAsText } from "../io/zip";
import type { WorkbookData, SheetData, Cell } from "./model";
import { a1, colToLetters, lettersToCol, parseA1 } from "./address";

// ─── XML helpers ────────────────────────────────────────────────────────────

function esc(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}

function unescape(s: string): string {
  return s
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'");
}

/** Extract first capture of a regex from a string, or null. */
function pick(re: RegExp, s: string): string | null {
  const m = re.exec(s);
  return m ? m[1] : null;
}

/** Extract attribute value from an XML tag string. */
function attr(tag: string, name: string): string | null {
  const re = new RegExp(`${name}="([^"]*)"`, "i");
  return pick(re, tag);
}

// ─── A1/RC address helpers ──────────────────────────────────────────────────

/** Convert Excel column+row (1-based) to 0-based {row, col}. */
function decodeCell(ref: string): { row: number; col: number } | null {
  const m = /^(\$?)([A-Za-z]+)(\$?)(\d+)$/.exec(ref.trim());
  if (!m) return null;
  return { col: lettersToCol(m[2].toUpperCase()), row: parseInt(m[4], 10) - 1 };
}

/** Encode 0-based {row, col} to uppercase A1. */
function encodeCell(row: number, col: number): string {
  return `${colToLetters(col)}${row + 1}`;
}

// ─── IMPORT ─────────────────────────────────────────────────────────────────

export async function importXlsx(file: File): Promise<WorkbookData> {
  const buf = await file.arrayBuffer();
  const entries = await readZip(buf);
  const get = (name: string) => entryAsText(entries, name);

  // 1. Parse workbook to find sheet names + rIds
  const wbXml = get("xl/workbook.xml") ?? "";
  const relsXml = get("xl/_rels/workbook.xml.rels") ?? "";

  // Map rId → target path
  const rIdToTarget = new Map<string, string>();
  const relRe = /<Relationship\s[^>]*>/gi;
  let rm: RegExpExecArray | null;
  while ((rm = relRe.exec(relsXml))) {
    const id = attr(rm[0], "Id");
    let target = attr(rm[0], "Target");
    if (id && target) {
      if (!target.startsWith("xl/") && !target.startsWith("/")) target = "xl/" + target;
      rIdToTarget.set(id, target);
    }
  }

  // Extract sheet entries from workbook.xml
  const sheetDefs: { name: string; rId: string }[] = [];
  const sheetRe = /<sheet\s[^>]*\/?>/gi;
  while ((rm = sheetRe.exec(wbXml))) {
    const name = attr(rm[0], "name") ?? "Sheet";
    const rId = attr(rm[0], "r:id") ?? attr(rm[0], "r:Id") ?? "";
    if (rId) sheetDefs.push({ name: unescape(name), rId });
  }

  // 2. Shared strings
  const ssXml = get("xl/sharedStrings.xml") ?? "";
  const sharedStrings: string[] = [];
  const siRe = /<si\b[^>]*>([\s\S]*?)<\/si>/g;
  while ((rm = siRe.exec(ssXml))) {
    // Collect all <t> text inside the <si>
    const si = rm[1];
    let text = "";
    const tRe = /<t\b[^>]*>([\s\S]*?)<\/t>/g;
    let tm: RegExpExecArray | null;
    while ((tm = tRe.exec(si))) text += unescape(tm[1]);
    sharedStrings.push(text);
  }

  // 3. Parse each worksheet
  const sheets: SheetData[] = [];
  for (const def of sheetDefs) {
    const target = rIdToTarget.get(def.rId);
    const wsXml = target ? (get(target) ?? "") : "";
    const sheet = parseWorksheet(wsXml, def.name, sharedStrings);
    sheets.push(sheet);
  }

  if (!sheets.length) sheets.push(emptySheet("Sheet1"));

  return { sheets, activeSheetId: sheets[0].id, names: [] };
}

function parseWorksheet(xml: string, name: string, ss: string[]): SheetData {
  const cells = new Map<string, Cell>();
  let maxRow = 0;
  let maxCol = 0;

  // Parse <row> elements, then <c> cells inside each row
  const rowRe = /<row\b[^>]*>([\s\S]*?)<\/row>/g;
  let rm: RegExpExecArray | null;

  while ((rm = rowRe.exec(xml))) {
    const rowBlock = rm[1];
    const cellRe = /<c\b([^>]*)>([\s\S]*?)<\/c>|<c\b([^>]*)\/>/g;
    let cm: RegExpExecArray | null;

    while ((cm = cellRe.exec(rowBlock))) {
      const tagAttrs = cm[1] ?? cm[3] ?? "";
      const inner = cm[2] ?? "";
      const ref = attr(tagAttrs, "r");
      if (!ref) continue;
      const pos = decodeCell(ref);
      if (!pos) continue;

      const cellType = attr(tagAttrs, "t") ?? "n";
      const vMatch = /<v\b[^>]*>([\s\S]*?)<\/v>/i.exec(inner);
      const fMatch = /<f\b[^>]*>([\s\S]*?)<\/f>/i.exec(inner);
      const rawV = vMatch ? unescape(vMatch[1]) : null;
      const rawF = fMatch ? unescape(fMatch[1]) : null;

      const cell: Cell = {};

      if (rawF) {
        cell.f = rawF;
        // cache value if present
        if (rawV !== null) {
          if (cellType === "b") cell.v = rawV === "1";
          else if (cellType === "s") cell.v = ss[parseInt(rawV, 10)] ?? rawV;
          else { const n = parseFloat(rawV); cell.v = isNaN(n) ? rawV : n; }
        }
      } else if (rawV !== null) {
        if (cellType === "b") {
          cell.v = rawV === "1";
        } else if (cellType === "s") {
          cell.v = ss[parseInt(rawV, 10)] ?? rawV;
        } else if (cellType === "str" || cellType === "inlineStr") {
          cell.v = rawV;
        } else if (cellType === "e") {
          cell.v = rawV; // error string e.g. "#DIV/0!"
        } else {
          const n = parseFloat(rawV);
          cell.v = isNaN(n) ? rawV : n;
        }
      }

      if (cell.v !== undefined || cell.f) {
        cells.set(a1(pos.row, pos.col), cell);
        if (pos.row > maxRow) maxRow = pos.row;
        if (pos.col > maxCol) maxCol = pos.col;
      }
    }
  }

  // Parse column widths from <col> elements
  const cols = new Map<number, { w: number }>();
  const colRe = /<col\b([^>]*)\/>/g;
  while ((rm = colRe.exec(xml))) {
    const min = parseInt(attr(rm[1], "min") ?? "0", 10) - 1;
    const max = parseInt(attr(rm[1], "max") ?? "0", 10) - 1;
    const wStr = attr(rm[1], "width");
    if (wStr) {
      const w = Math.round(parseFloat(wStr) * 7); // EMU → px approx
      for (let c = min; c <= max && c < 200; c++) cols.set(c, { w: Math.max(40, w) });
    }
  }

  return {
    id: `s_${Math.random().toString(36).slice(2, 9)}`,
    name,
    cells,
    cols,
    rows: new Map(),
    numRows: Math.max(200, maxRow + 20),
    numCols: Math.max(26, maxCol + 5),
    filters: new Map(),
    hiddenRows: new Set(),
    merges: [],
    freezeRows: 0,
    freezeCols: 0,
    validations: [],
    charts: [],
    condFormats: [],
  };
}

// ─── EXPORT ─────────────────────────────────────────────────────────────────

export async function exportXlsx(wb: WorkbookData, filename = "workbook.xlsx"): Promise<void> {
  const enc = new TextEncoder();
  const entries: { name: string; data: Uint8Array }[] = [];
  const push = (name: string, text: string) => entries.push({ name, data: enc.encode(text) });

  // Collect shared strings across all sheets
  const ssIndex = new Map<string, number>();
  const ssArr: string[] = [];
  const intern = (s: string): number => {
    if (ssIndex.has(s)) return ssIndex.get(s)!;
    const i = ssArr.length;
    ssArr.push(s);
    ssIndex.set(s, i);
    return i;
  };

  // Build worksheet XML for each sheet (shared strings pass)
  const wsXmls: string[] = [];
  for (const sheet of wb.sheets) {
    wsXmls.push(buildWorksheetXml(sheet, intern));
  }

  // [Content_Types].xml
  const sheetCTs = wb.sheets
    .map((_, i) => `<Override PartName="/xl/worksheets/sheet${i + 1}.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/>`)
    .join("");
  push(
    "[Content_Types].xml",
    `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">
  <Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>
  <Default Extension="xml" ContentType="application/xml"/>
  <Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/>
  <Override PartName="/xl/sharedStrings.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sharedStrings+xml"/>
  <Override PartName="/xl/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.styles+xml"/>
  ${sheetCTs}
</Types>`,
  );

  // _rels/.rels
  push(
    "_rels/.rels",
    `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
  <Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="xl/workbook.xml"/>
</Relationships>`,
  );

  // xl/_rels/workbook.xml.rels
  const wbRels = wb.sheets
    .map(
      (_, i) =>
        `<Relationship Id="rId${i + 1}" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet${i + 1}.xml"/>`,
    )
    .join("\n  ");
  const ssRel = `<Relationship Id="rId${wb.sheets.length + 1}" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/sharedStrings" Target="sharedStrings.xml"/>`;
  push(
    "xl/_rels/workbook.xml.rels",
    `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
  ${wbRels}
  ${ssRel}
</Relationships>`,
  );

  // xl/workbook.xml
  const sheetsXml = wb.sheets
    .map((s, i) => `<sheet name="${esc(s.name)}" sheetId="${i + 1}" r:id="rId${i + 1}"/>`)
    .join("\n    ");
  push(
    "xl/workbook.xml",
    `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main"
          xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships">
  <sheets>
    ${sheetsXml}
  </sheets>
</workbook>`,
  );

  // xl/styles.xml (minimal)
  push(
    "xl/styles.xml",
    `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<styleSheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main">
  <fonts count="1"><font><sz val="11"/><name val="Calibri"/></font></fonts>
  <fills count="2"><fill><patternFill patternType="none"/></fill><fill><patternFill patternType="gray125"/></fill></fills>
  <borders count="1"><border><left/><right/><top/><bottom/><diagonal/></border></borders>
  <cellStyleXfs count="1"><xf numFmtId="0" fontId="0" fillId="0" borderId="0"/></cellStyleXfs>
  <cellXfs count="1"><xf numFmtId="0" fontId="0" fillId="0" borderId="0" xfId="0"/></cellXfs>
</styleSheet>`,
  );

  // xl/sharedStrings.xml
  const siXml = ssArr.map((s) => `<si><t>${esc(s)}</t></si>`).join("\n");
  push(
    "xl/sharedStrings.xml",
    `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<sst xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" count="${ssArr.length}" uniqueCount="${ssArr.length}">
${siXml}
</sst>`,
  );

  // xl/worksheets/sheetN.xml
  for (let i = 0; i < wb.sheets.length; i++) {
    push(`xl/worksheets/sheet${i + 1}.xml`, wsXmls[i]);
  }

  const buf = await writeZip(entries);
  triggerDownload(buf, filename);
}

function buildWorksheetXml(sheet: SheetData, intern: (s: string) => number): string {
  // Group cells by row
  const rowMap = new Map<number, { col: number; cell: Cell }[]>();
  let maxRow = 0;
  let maxCol = 0;

  for (const [k, cell] of sheet.cells) {
    const p = parseA1(k);
    if (!p) continue;
    if (!rowMap.has(p.row)) rowMap.set(p.row, []);
    rowMap.get(p.row)!.push({ col: p.col, cell });
    if (p.row > maxRow) maxRow = p.row;
    if (p.col > maxCol) maxCol = p.col;
  }

  // Column widths
  let colsXml = "";
  if (sheet.cols.size > 0) {
    const colEntries = [...sheet.cols.entries()].sort((a, b) => a[0] - b[0]);
    colsXml =
      "<cols>" +
      colEntries
        .map(([c, { w }]) => {
          const excelW = (w / 7).toFixed(2);
          return `<col min="${c + 1}" max="${c + 1}" width="${excelW}" customWidth="1"/>`;
        })
        .join("") +
      "</cols>";
  }

  // Rows
  const rowsXml = [...rowMap.entries()]
    .sort((a, b) => a[0] - b[0])
    .map(([r, cols]) => {
      const cellsXml = cols
        .sort((a, b) => a.col - b.col)
        .map(({ col, cell }) => buildCellXml(r, col, cell, intern))
        .join("");
      return `<row r="${r + 1}">${cellsXml}</row>`;
    })
    .join("\n");

  const ref = maxRow === 0 && maxCol === 0 ? "A1" : `A1:${encodeCell(maxRow, maxCol)}`;

  return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main">
  <dimension ref="${ref}"/>
  ${colsXml}
  <sheetData>
${rowsXml}
  </sheetData>
</worksheet>`;
}

function buildCellXml(row: number, col: number, cell: Cell, intern: (s: string) => number): string {
  const ref = encodeCell(row, col);

  if (cell.f) {
    // Formula cell
    const vTag = cell.v !== null && cell.v !== undefined ? `<v>${esc(String(cell.v))}</v>` : "";
    return `<c r="${ref}"><f>${esc(cell.f)}</f>${vTag}</c>`;
  }

  if (cell.v === null || cell.v === undefined) return "";

  if (typeof cell.v === "boolean") {
    return `<c r="${ref}" t="b"><v>${cell.v ? "1" : "0"}</v></c>`;
  }
  if (typeof cell.v === "number") {
    return `<c r="${ref}"><v>${cell.v}</v></c>`;
  }
  // String — use shared strings
  const idx = intern(cell.v as string);
  return `<c r="${ref}" t="s"><v>${idx}</v></c>`;
}

function triggerDownload(buf: ArrayBuffer, filename: string): void {
  const blob = new Blob([buf], { type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

// ─── Empty sheet helper ──────────────────────────────────────────────────────

function emptySheet(name: string): SheetData {
  return {
    id: `s_${Math.random().toString(36).slice(2, 9)}`,
    name,
    cells: new Map(),
    cols: new Map(),
    rows: new Map(),
    numRows: 200,
    numCols: 26,
    filters: new Map(),
    hiddenRows: new Set(),
    merges: [],
    freezeRows: 0,
    freezeCols: 0,
    validations: [],
    charts: [],
    condFormats: [],
  };
}
