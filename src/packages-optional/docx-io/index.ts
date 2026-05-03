// @orbitoffice/docx-io — minimal DOCX read/write focused on Smart Docs.
// Reads document.xml → simple HTML (paragraphs, headings, runs with b/i/u, tables).
// Writes a minimal OOXML package from HTML containing the same subset.

import { readZip, writeZip, entryAsText, type ZipEntry } from "../zip";
import { extractPlaceholders, wrapLiteralPlaceholders } from "../../packages/doc/placeholders";
import type { SmartDocPlaceholder } from "../../packages/core/smartDocs";

const W_NS = 'xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main"';

function escapeXml(s: string): string {
  return s.replace(/[&<>"']/g, (c) =>
    ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&apos;" }[c]!),
  );
}
function unescapeXml(s: string): string {
  return s
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'")
    .replace(/&amp;/g, "&");
}

// ---------------------------------------------------------------------------
// READ
// ---------------------------------------------------------------------------
export async function readDocxToHtml(buf: ArrayBuffer): Promise<{
  html: string;
  placeholders: SmartDocPlaceholder[];
}> {
  const entries = await readZip(buf);
  const xml = entryAsText(entries, "word/document.xml");
  if (!xml) throw new Error("DOCX: word/document.xml not found");

  const blocks: string[] = [];
  // Iterate over every <w:p> or <w:tbl> top-level
  const bodyMatch = xml.match(/<w:body[^>]*>([\s\S]*?)<\/w:body>/);
  const body = bodyMatch ? bodyMatch[1] : xml;
  const partRe = /<w:(p|tbl)\b[^>]*>([\s\S]*?)<\/w:\1>/g;
  let m: RegExpExecArray | null;
  while ((m = partRe.exec(body))) {
    if (m[1] === "p") blocks.push(parseParagraph(m[2]));
    else blocks.push(parseTable(m[2]));
  }
  const html = wrapLiteralPlaceholders(blocks.join("\n"));
  return { html, placeholders: extractPlaceholders(html) };
}

function parseParagraph(inner: string): string {
  // Heading style?
  let tag = "p";
  const styleMatch = inner.match(/<w:pStyle\s+w:val="([^"]+)"/);
  if (styleMatch) {
    const s = styleMatch[1].toLowerCase();
    const h = s.match(/heading(\d)/);
    if (h) tag = `h${Math.min(6, Number(h[1]))}`;
  }
  // Concat runs
  const runRe = /<w:r\b[^>]*>([\s\S]*?)<\/w:r>/g;
  let html = "";
  let r: RegExpExecArray | null;
  while ((r = runRe.exec(inner))) html += parseRun(r[1]);
  if (!html) html = "<br/>";
  return `<${tag}>${html}</${tag}>`;
}

function parseRun(inner: string): string {
  const rPr = inner.match(/<w:rPr>([\s\S]*?)<\/w:rPr>/)?.[1] ?? "";
  const bold = /<w:b\b/.test(rPr);
  const italic = /<w:i\b/.test(rPr);
  const underline = /<w:u\b/.test(rPr);
  // Concatenate every <w:t> and <w:tab/> and <w:br/>
  let text = "";
  const tRe = /<w:(t|tab|br)\b([^/>]*)(?:\/>|>([\s\S]*?)<\/w:\1>)/g;
  let m: RegExpExecArray | null;
  while ((m = tRe.exec(inner))) {
    if (m[1] === "t") text += unescapeXml(m[3] ?? "");
    else if (m[1] === "tab") text += "\t";
    else if (m[1] === "br") text += "<br/>";
  }
  let html = escapeXml(text).replace(/&lt;br\/&gt;/g, "<br/>");
  if (underline) html = `<u>${html}</u>`;
  if (italic) html = `<em>${html}</em>`;
  if (bold) html = `<strong>${html}</strong>`;
  return html;
}

function parseTable(inner: string): string {
  const rows: string[] = [];
  const rowRe = /<w:tr\b[^>]*>([\s\S]*?)<\/w:tr>/g;
  let m: RegExpExecArray | null;
  while ((m = rowRe.exec(inner))) {
    const cells: string[] = [];
    const cellRe = /<w:tc\b[^>]*>([\s\S]*?)<\/w:tc>/g;
    let c: RegExpExecArray | null;
    while ((c = cellRe.exec(m[1]))) {
      const pRe = /<w:p\b[^>]*>([\s\S]*?)<\/w:p>/g;
      let cellHtml = "";
      let pp: RegExpExecArray | null;
      while ((pp = pRe.exec(c[1]))) cellHtml += parseParagraph(pp[1]);
      cells.push(`<td>${cellHtml || "<br/>"}</td>`);
    }
    rows.push(`<tr>${cells.join("")}</tr>`);
  }
  return `<table class="oo-doc-table">${rows.join("")}</table>`;
}

// ---------------------------------------------------------------------------
// WRITE
// ---------------------------------------------------------------------------
export async function writeDocxFromHtml(html: string): Promise<ArrayBuffer> {
  const bodyXml = htmlBlocksToXml(html);
  const documentXml =
    `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>\n` +
    `<w:document ${W_NS}><w:body>${bodyXml}<w:sectPr/></w:body></w:document>`;
  const entries: ZipEntry[] = [
    {
      name: "[Content_Types].xml",
      data: txt(
        `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>` +
          `<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">` +
          `<Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>` +
          `<Default Extension="xml" ContentType="application/xml"/>` +
          `<Override PartName="/word/document.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml"/>` +
          `</Types>`,
      ),
    },
    {
      name: "_rels/.rels",
      data: txt(
        `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>` +
          `<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">` +
          `<Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="word/document.xml"/>` +
          `</Relationships>`,
      ),
    },
    { name: "word/document.xml", data: txt(documentXml) },
  ];
  return writeZip(entries);
}

function txt(s: string): Uint8Array { return new TextEncoder().encode(s); }

function htmlBlocksToXml(html: string): string {
  if (typeof DOMParser === "undefined") {
    // Crude fallback: wrap whole text into a single paragraph
    return paragraphXml(escapeXml(html.replace(/<[^>]+>/g, "")), "p");
  }
  const doc = new DOMParser().parseFromString(`<div>${html}</div>`, "text/html");
  const root = doc.body.firstElementChild as HTMLElement;
  return Array.from(root.children).map(blockToXml).join("");
}

function blockToXml(node: Element): string {
  const tag = node.tagName.toLowerCase();
  if (/^h[1-6]$/.test(tag)) return paragraphXml(inlineRuns(node), tag);
  if (tag === "table") return tableXml(node as HTMLTableElement);
  return paragraphXml(inlineRuns(node), "p");
}

function paragraphXml(runs: string, tag: string): string {
  const pPr = tag !== "p"
    ? `<w:pPr><w:pStyle w:val="Heading${tag.slice(1)}"/></w:pPr>`
    : "";
  return `<w:p>${pPr}${runs}</w:p>`;
}

function inlineRuns(node: Element): string {
  let out = "";
  node.childNodes.forEach((c) => { out += inlineRun(c, {}); });
  return out || `<w:r><w:t xml:space="preserve"></w:t></w:r>`;
}

function inlineRun(n: Node, fmt: { b?: boolean; i?: boolean; u?: boolean }): string {
  if (n.nodeType === 3) {
    const text = n.textContent ?? "";
    if (!text) return "";
    const rPrParts: string[] = [];
    if (fmt.b) rPrParts.push("<w:b/>");
    if (fmt.i) rPrParts.push("<w:i/>");
    if (fmt.u) rPrParts.push('<w:u w:val="single"/>');
    const rPr = rPrParts.length ? `<w:rPr>${rPrParts.join("")}</w:rPr>` : "";
    return `<w:r>${rPr}<w:t xml:space="preserve">${escapeXml(text)}</w:t></w:r>`;
  }
  if (n.nodeType !== 1) return "";
  const el = n as HTMLElement;
  const tag = el.tagName.toLowerCase();
  if (tag === "br") return `<w:r><w:br/></w:r>`;
  // Smart Docs chip → emit literal {{key}}
  if (el.hasAttribute("data-ph")) {
    const label = el.getAttribute("data-label") ?? el.textContent ?? "";
    const key = label.replace(/[{}]/g, "");
    return `<w:r><w:t xml:space="preserve">{{${escapeXml(key)}}}</w:t></w:r>`;
  }
  const next = { ...fmt };
  if (tag === "b" || tag === "strong") next.b = true;
  if (tag === "i" || tag === "em") next.i = true;
  if (tag === "u") next.u = true;
  let out = "";
  el.childNodes.forEach((c) => { out += inlineRun(c, next); });
  return out;
}

function tableXml(tbl: HTMLTableElement): string {
  const rows: string[] = [];
  tbl.querySelectorAll("tr").forEach((tr) => {
    const cells: string[] = [];
    tr.querySelectorAll("td,th").forEach((td) => {
      cells.push(`<w:tc><w:tcPr><w:tcW w:w="2000" w:type="dxa"/></w:tcPr>${paragraphXml(inlineRuns(td), "p")}</w:tc>`);
    });
    rows.push(`<w:tr>${cells.join("")}</w:tr>`);
  });
  return `<w:tbl>${rows.join("")}</w:tbl>`;
}

// Convenience: detect placeholders from raw bytes (Deno-friendly).
export async function detectDocxPlaceholders(buf: ArrayBuffer): Promise<SmartDocPlaceholder[]> {
  const { placeholders } = await readDocxToHtml(buf);
  return placeholders;
}
