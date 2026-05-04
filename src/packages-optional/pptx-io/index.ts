// @orbitoffice/pptx-io — placeholder PPTX read + write. Deno/edge-safe.

import { readZip, writeZip, entryAsText, type ZipEntry } from "../zip";
import { PLACEHOLDER_REGEX, autoMapPlaceholder, type SmartDocPlaceholder } from "../../packages/core/smartDocs";
import type { Deck, Slide, SlideElement, TextElement, ShapeElement, ImageElement } from "../../packages/slides/model";
import { getTheme } from "../../packages/slides/model";

// ──────────────────────────────────────────────────────────────────────────────
// READ
// ──────────────────────────────────────────────────────────────────────────────

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
        .replace(/&amp;/g, "&").replace(/&lt;/g, "<").replace(/&gt;/g, ">")
        .replace(/&quot;/g, '"').replace(/&apos;/g, "'"));
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

// ──────────────────────────────────────────────────────────────────────────────
// WRITE  (writePptxFromDeck)
// ──────────────────────────────────────────────────────────────────────────────
//
// Coordinate system: 1920×1080 slide-px → 12 192 000×6 858 000 EMU (16:9, 13.33" wide).
// Font size: 1 slide-px ≈ 0.5 pt → OOXML sz (hundredths-of-pt) = fontSize × 50.
// Deno-safe: no DOMParser, no document, no window.

const EMU_PER_PX = 6350;
const SLIDE_CX   = 12_192_000;
const SLIDE_CY   =  6_858_000;
const SZ_FACTOR  = 50; // slide-px → hundredths-of-pt

const NS_P  = "http://schemas.openxmlformats.org/presentationml/2006/main";
const NS_A  = "http://schemas.openxmlformats.org/drawingml/2006/main";
const NS_R  = "http://schemas.openxmlformats.org/officeDocument/2006/relationships";
const NS_RL = "http://schemas.openxmlformats.org/package/2006/relationships";

// ── Utilities ──

function txt(s: string): Uint8Array { return new TextEncoder().encode(s); }

function relsDoc(rels: string[]): string {
  return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>\n` +
    `<Relationships xmlns="${NS_RL}">${rels.join("")}</Relationships>`;
}

function px(n: number): number { return Math.round(n * EMU_PER_PX); }

function hexColor(c?: string | null): string | null {
  if (!c || c === "transparent" || c === "none") return null;
  const h6 = /^#([0-9a-f]{6})$/i.exec(c);
  if (h6) return h6[1].toUpperCase();
  const h3 = /^#([0-9a-f]{3})$/i.exec(c);
  if (h3) return h3[1].split("").map((x) => x + x).join("").toUpperCase();
  return null;
}

function escXml(s: string): string {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;")
          .replace(/"/g, "&quot;").replace(/'/g, "&apos;");
}

// ── Regex-based HTML → paragraphs with inline formatting (Deno-safe) ──

interface HtmlRun { text: string; b: boolean; i: boolean; u: boolean }
type HtmlPara = HtmlRun[];

function parseHtmlToParagraphs(html: string): HtmlPara[] {
  const paras: HtmlPara[] = [];
  let para: HtmlRun[] = [];
  let b = false, i = false, u = false;

  // Matches either a tag or a text node
  const TOKEN = /<(\/?)([\w]+)[^>]*\/?>|([^<]+)/g;
  let m: RegExpExecArray | null;

  function flushText(raw: string) {
    const text = raw
      .replace(/&amp;/g, "&").replace(/&lt;/g, "<").replace(/&gt;/g, ">")
      .replace(/&quot;/g, '"').replace(/&apos;/g, "'").replace(/&nbsp;/g, " ");
    if (text) para.push({ text, b, i, u });
  }

  function newPara() { paras.push(para); para = []; }

  while ((m = TOKEN.exec(html))) {
    if (m[3] !== undefined) {
      flushText(m[3]);
    } else {
      const isClose = m[1] === "/";
      const tag     = m[2].toLowerCase();
      if (tag === "br") {
        newPara();
      } else if (!isClose && (tag === "p" || tag === "div" || /^h\d$/.test(tag))) {
        if (para.length > 0) newPara();
      } else if (isClose && (tag === "p" || tag === "div" || /^h\d$/.test(tag))) {
        newPara();
      } else if (!isClose) {
        if (tag === "strong" || tag === "b") b = true;
        else if (tag === "em" || tag === "i")  i = true;
        else if (tag === "u")                  u = true;
      } else {
        if (tag === "strong" || tag === "b") b = false;
        else if (tag === "em" || tag === "i")  i = false;
        else if (tag === "u")                  u = false;
      }
    }
  }
  if (para.length > 0) paras.push(para);
  if (paras.length === 0) paras.push([{ text: "", b: false, i: false, u: false }]);
  return paras;
}

// ── Shape preset mapping ──

const SHAPE_PRST: Record<string, string> = {
  rect: "rect", ellipse: "ellipse", triangle: "triangle",
  line: "line", arrow: "rightArrow", star: "star5",
  diamond: "diamond", pentagon: "pentagon", hexagon: "hexagon",
};

// ── OOXML element builders ──

function xfrmXml(el: { x: number; y: number; w: number; h: number; rotation?: number }): string {
  const rot = el.rotation ? ` rot="${Math.round(el.rotation * 60000)}"` : "";
  return `<a:xfrm${rot}><a:off x="${px(el.x)}" y="${px(el.y)}"/><a:ext cx="${px(el.w)}" cy="${px(el.h)}"/></a:xfrm>`;
}

function runXml(run: HtmlRun, el: TextElement): string {
  const bAttr = (run.b || el.bold)      ? ` b="1"` : "";
  const iAttr = (run.i || el.italic)    ? ` i="1"` : "";
  const uAttr = (run.u || el.underline) ? ` u="sng"` : "";
  const szAttr = el.fontSize ? ` sz="${Math.round(el.fontSize * SZ_FACTOR)}"` : "";
  const colorHex = hexColor(el.color);
  const colorXml = colorHex ? `<a:solidFill><a:srgbClr val="${colorHex}"/></a:solidFill>` : "";
  const fontXml  = el.fontFamily && el.fontFamily !== "Default"
    ? `<a:latin typeface="${escXml(el.fontFamily)}"/>` : "";
  return `<a:r><a:rPr lang="pt-BR" dirty="0"${bAttr}${iAttr}${uAttr}${szAttr}>${colorXml}${fontXml}</a:rPr>` +
    `<a:t>${escXml(run.text)}</a:t></a:r>`;
}

function textElementXml(el: TextElement, spId: number): string {
  const paras  = parseHtmlToParagraphs(el.html);
  const algn   = el.align === "center" ? "ctr" : el.align === "right" ? "r" : "l";
  const bgHex  = hexColor(el.bgFill);
  const fillXml = bgHex
    ? `<a:solidFill><a:srgbClr val="${bgHex}"/></a:solidFill>`
    : `<a:noFill/>`;

  const parasXml = paras.map((runs) => {
    const runsXml = runs.length === 0
      ? `<a:r><a:rPr lang="pt-BR" dirty="0"/><a:t></a:t></a:r>`
      : runs.map((r) => runXml(r, el)).join("");
    return `<a:p><a:pPr algn="${algn}"/>${runsXml}</a:p>`;
  }).join("");

  return `<p:sp>` +
    `<p:nvSpPr><p:cNvPr id="${spId}" name="Text ${spId}"/><p:cNvSpPr txBox="1"/><p:nvPr/></p:nvSpPr>` +
    `<p:spPr>${xfrmXml(el)}<a:prstGeom prst="rect"><a:avLst/></a:prstGeom>${fillXml}</p:spPr>` +
    `<p:txBody><a:bodyPr wrap="square" anchor="t"/><a:lstStyle/>${parasXml}</p:txBody>` +
    `</p:sp>`;
}

function shapeElementXml(el: ShapeElement, spId: number): string {
  const prst     = SHAPE_PRST[el.shape] ?? "rect";
  const fillHex  = hexColor(el.fill);
  const fillXml  = fillHex
    ? `<a:solidFill><a:srgbClr val="${fillHex}"/></a:solidFill>`
    : `<a:noFill/>`;
  const strokeHex = hexColor(el.stroke);
  const lnXml = strokeHex && el.strokeWidth
    ? `<a:ln w="${Math.round(el.strokeWidth * 12700)}"><a:solidFill><a:srgbClr val="${strokeHex}"/></a:solidFill></a:ln>`
    : `<a:ln><a:noFill/></a:ln>`;

  let txBodyXml = "";
  if (el.shapeText) {
    const stHex   = hexColor(el.shapeTextColor);
    const stColor = stHex ? `<a:solidFill><a:srgbClr val="${stHex}"/></a:solidFill>` : "";
    const stSz    = el.shapeTextSize ? ` sz="${Math.round(el.shapeTextSize * SZ_FACTOR)}"` : "";
    const stB     = el.shapeTextBold ? ` b="1"` : "";
    const stAlgn  = el.shapeTextAlign === "center" ? "ctr" : el.shapeTextAlign === "right" ? "r" : "l";
    txBodyXml =
      `<p:txBody><a:bodyPr anchor="ctr"/><a:lstStyle/>` +
      `<a:p><a:pPr algn="${stAlgn}"/><a:r>` +
      `<a:rPr lang="pt-BR" dirty="0"${stSz}${stB}>${stColor}</a:rPr>` +
      `<a:t>${escXml(el.shapeText)}</a:t></a:r></a:p></p:txBody>`;
  }

  return `<p:sp>` +
    `<p:nvSpPr><p:cNvPr id="${spId}" name="Shape ${spId}"/><p:cNvSpPr/><p:nvPr/></p:nvSpPr>` +
    `<p:spPr>${xfrmXml(el)}<a:prstGeom prst="${prst}"><a:avLst/></a:prstGeom>${fillXml}${lnXml}</p:spPr>` +
    `${txBodyXml}</p:sp>`;
}

function imageElementXml(el: ImageElement, spId: number, rId: string): string {
  return `<p:pic>` +
    `<p:nvPicPr><p:cNvPr id="${spId}" name="Image ${spId}"/>` +
    `<p:cNvPicPr><a:picLocks noChangeAspect="1"/></p:cNvPicPr><p:nvPr/></p:nvPicPr>` +
    `<p:blipFill><a:blip r:embed="${rId}"/><a:stretch><a:fillRect/></a:stretch></p:blipFill>` +
    `<p:spPr>${xfrmXml(el)}<a:prstGeom prst="rect"><a:avLst/></a:prstGeom></p:spPr>` +
    `</p:pic>`;
}

function slideBackground(slide: Slide, theme: { bg: string }): string {
  if (slide.bgGradient) {
    const { c1, c2, angle } = slide.bgGradient;
    const ang = Math.round(((360 - angle + 90) % 360) * 60000);
    const h1  = hexColor(c1) ?? "FFFFFF";
    const h2  = hexColor(c2) ?? "000000";
    return `<p:bg><p:bgPr>` +
      `<a:gradFill><a:gsLst>` +
      `<a:gs pos="0"><a:srgbClr val="${h1}"/></a:gs>` +
      `<a:gs pos="100000"><a:srgbClr val="${h2}"/></a:gs>` +
      `</a:gsLst><a:lin ang="${ang}" scaled="0"/></a:gradFill>` +
      `<a:effectLst/></p:bgPr></p:bg>`;
  }
  const bg = hexColor(slide.background ?? theme.bg) ?? "FFFFFF";
  return `<p:bg><p:bgPr>` +
    `<a:solidFill><a:srgbClr val="${bg}"/></a:solidFill>` +
    `<a:effectLst/></p:bgPr></p:bg>`;
}

function slideMasterXml(): string {
  return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>\n` +
    `<p:sldMaster xmlns:p="${NS_P}" xmlns:a="${NS_A}" xmlns:r="${NS_R}">` +
    `<p:cSld><p:spTree>` +
    `<p:nvGrpSpPr><p:cNvPr id="1" name=""/><p:cNvGrpSpPr/><p:nvPr/></p:nvGrpSpPr>` +
    `<p:grpSpPr><a:xfrm><a:off x="0" y="0"/><a:ext cx="0" cy="0"/>` +
    `<a:chOff x="0" y="0"/><a:chExt cx="0" cy="0"/></a:xfrm></p:grpSpPr>` +
    `</p:spTree></p:cSld>` +
    `<p:txStyles>` +
    `<p:titleStyle><a:lvl1pPr><a:defRPr lang="pt-BR"/></a:lvl1pPr></p:titleStyle>` +
    `<p:bodyStyle><a:lvl1pPr><a:defRPr lang="pt-BR"/></a:lvl1pPr></p:bodyStyle>` +
    `<p:otherStyle><a:lvl1pPr><a:defRPr lang="pt-BR"/></a:lvl1pPr></p:otherStyle>` +
    `</p:txStyles>` +
    `<p:sldLayoutIdLst><p:sldLayoutId id="2147483649" r:id="rId1"/></p:sldLayoutIdLst>` +
    `</p:sldMaster>`;
}

function slideLayoutXml(): string {
  return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>\n` +
    `<p:sldLayout xmlns:p="${NS_P}" xmlns:a="${NS_A}" xmlns:r="${NS_R}" type="blank">` +
    `<p:cSld><p:spTree>` +
    `<p:nvGrpSpPr><p:cNvPr id="1" name=""/><p:cNvGrpSpPr/><p:nvPr/></p:nvGrpSpPr>` +
    `<p:grpSpPr><a:xfrm><a:off x="0" y="0"/><a:ext cx="0" cy="0"/>` +
    `<a:chOff x="0" y="0"/><a:chExt cx="0" cy="0"/></a:xfrm></p:grpSpPr>` +
    `</p:spTree></p:cSld>` +
    `</p:sldLayout>`;
}

// ── Image embedding ──

function parseDataUri(src: string): { data: Uint8Array; ext: string } | null {
  const m = /^data:image\/([a-z0-9+]+);base64,([A-Za-z0-9+/=\s]+)/.exec(src);
  if (!m) return null;
  let ext = m[1].toLowerCase();
  if (ext === "jpeg")    ext = "jpg";
  if (ext === "svg+xml") ext = "svg";
  try {
    const clean = m[2].replace(/\s/g, "");
    const bstr  = atob(clean);
    const u8    = new Uint8Array(bstr.length);
    for (let j = 0; j < bstr.length; j++) u8[j] = bstr.charCodeAt(j);
    return { data: u8, ext };
  } catch { return null; }
}

// ── Main export ──

/**
 * Converts an orbit-office Deck (JSON) to a PPTX buffer.
 * Runs in browser, Deno, and Cloudflare Workers (no DOM APIs).
 */
export async function writePptxFromDeck(deck: Deck): Promise<ArrayBuffer> {
  const theme        = getTheme(deck.themeId);
  const entries: ZipEntry[]  = [];
  const mediaEntries: ZipEntry[] = [];
  const mediaTypes   = new Set<string>();
  // Deduplication: src → global media target path
  const mediaCache   = new Map<string, string>(); // src → "../media/image{n}.{ext}"

  const slideXmls:   string[]   = [];
  const slideRelsArr: string[][] = [];

  for (const slide of deck.slides) {
    let spId   = 2;
    let nextRId = 2; // rId1 reserved for slideLayout
    // Per-slide: mediaTarget → rId (dedup images referenced multiple times in same slide)
    const slideImgRIds = new Map<string, string>();
    const imgRels: string[] = [];
    const shapes:  string[] = [];

    const els = [...slide.elements].sort((a, b) => (a.z ?? 0) - (b.z ?? 0));

    for (const el of els as SlideElement[]) {
      if (el.type === "text") {
        shapes.push(textElementXml(el as TextElement, spId++));
      } else if (el.type === "shape") {
        shapes.push(shapeElementXml(el as ShapeElement, spId++));
      } else if (el.type === "image") {
        const imgEl = el as ImageElement;
        // Ensure media file exists globally
        let target = mediaCache.get(imgEl.src);
        if (!target) {
          const parsed = parseDataUri(imgEl.src);
          if (!parsed) continue;
          const globalIdx = mediaEntries.length + 1;
          const mediaPath = `ppt/media/image${globalIdx}.${parsed.ext}`;
          mediaEntries.push({ name: mediaPath, data: parsed.data });
          mediaTypes.add(parsed.ext);
          target = `../media/image${globalIdx}.${parsed.ext}`;
          mediaCache.set(imgEl.src, target);
        }
        // Assign or reuse per-slide rId
        let rId = slideImgRIds.get(target);
        if (!rId) {
          rId = `rId${nextRId++}`;
          slideImgRIds.set(target, rId);
          imgRels.push(
            `<Relationship Id="${rId}" ` +
            `Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/image" ` +
            `Target="${target}"/>`,
          );
        }
        shapes.push(imageElementXml(imgEl, spId++, rId));
      }
    }

    const bgXml     = slideBackground(slide, theme);
    const spTreeXml =
      `<p:spTree>` +
      `<p:nvGrpSpPr><p:cNvPr id="1" name=""/><p:cNvGrpSpPr/><p:nvPr/></p:nvGrpSpPr>` +
      `<p:grpSpPr><a:xfrm>` +
      `<a:off x="0" y="0"/><a:ext cx="${SLIDE_CX}" cy="${SLIDE_CY}"/>` +
      `<a:chOff x="0" y="0"/><a:chExt cx="${SLIDE_CX}" cy="${SLIDE_CY}"/>` +
      `</a:xfrm></p:grpSpPr>` +
      shapes.join("") +
      `</p:spTree>`;

    slideXmls.push(
      `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>\n` +
      `<p:sld xmlns:p="${NS_P}" xmlns:a="${NS_A}" xmlns:r="${NS_R}">` +
      `<p:cSld>${bgXml}${spTreeXml}</p:cSld>` +
      `</p:sld>`,
    );
    slideRelsArr.push(imgRels);
  }

  // Slides + per-slide rels
  for (let i = 0; i < slideXmls.length; i++) {
    entries.push({ name: `ppt/slides/slide${i + 1}.xml`, data: txt(slideXmls[i]) });
    entries.push({
      name: `ppt/slides/_rels/slide${i + 1}.xml.rels`,
      data: txt(relsDoc([
        `<Relationship Id="rId1" ` +
        `Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/slideLayout" ` +
        `Target="../slideLayouts/slideLayout1.xml"/>`,
        ...slideRelsArr[i],
      ])),
    });
  }

  // Media files (after slides so their indices are stable)
  for (const me of mediaEntries) entries.push(me);

  // Slide master + layout
  entries.push({ name: "ppt/slideMasters/slideMaster1.xml", data: txt(slideMasterXml()) });
  entries.push({
    name: "ppt/slideMasters/_rels/slideMaster1.xml.rels",
    data: txt(relsDoc([
      `<Relationship Id="rId1" ` +
      `Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/slideLayout" ` +
      `Target="../slideLayouts/slideLayout1.xml"/>`,
    ])),
  });
  entries.push({ name: "ppt/slideLayouts/slideLayout1.xml", data: txt(slideLayoutXml()) });
  entries.push({
    name: "ppt/slideLayouts/_rels/slideLayout1.xml.rels",
    data: txt(relsDoc([
      `<Relationship Id="rId1" ` +
      `Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/slideMaster" ` +
      `Target="../slideMasters/slideMaster1.xml"/>`,
    ])),
  });

  // Presentation
  const slideIdList = deck.slides.map((_, i) =>
    `<p:sldId id="${256 + i}" r:id="rId${2 + i}"/>`,
  ).join("");

  entries.push({
    name: "ppt/presentation.xml",
    data: txt(
      `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>\n` +
      `<p:presentation xmlns:p="${NS_P}" xmlns:a="${NS_A}" xmlns:r="${NS_R}" saveSubsetFonts="1">` +
      `<p:sldMasterIdLst><p:sldMasterId id="2147483648" r:id="rId1"/></p:sldMasterIdLst>` +
      `<p:sldIdLst>${slideIdList}</p:sldIdLst>` +
      `<p:sldSz cx="${SLIDE_CX}" cy="${SLIDE_CY}" type="custom"/>` +
      `<p:notesSz cx="6858000" cy="9144000"/>` +
      `</p:presentation>`,
    ),
  });

  entries.push({
    name: "ppt/_rels/presentation.xml.rels",
    data: txt(relsDoc([
      `<Relationship Id="rId1" ` +
      `Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/slideMaster" ` +
      `Target="slideMasters/slideMaster1.xml"/>`,
      ...deck.slides.map((_, i) =>
        `<Relationship Id="rId${2 + i}" ` +
        `Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/slide" ` +
        `Target="slides/slide${i + 1}.xml"/>`,
      ),
    ])),
  });

  // Root relationships
  entries.push({
    name: "_rels/.rels",
    data: txt(relsDoc([
      `<Relationship Id="rId1" ` +
      `Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" ` +
      `Target="ppt/presentation.xml"/>`,
    ])),
  });

  // Content types
  const mediaDefaultXml = [...mediaTypes].map((ext) => {
    const ct = ext === "jpg" ? "image/jpeg" : ext === "svg" ? "image/svg+xml" : `image/${ext}`;
    return `<Default Extension="${ext}" ContentType="${ct}"/>`;
  }).join("");

  const slideOverrides = deck.slides.map((_, i) =>
    `<Override PartName="/ppt/slides/slide${i + 1}.xml" ` +
    `ContentType="application/vnd.openxmlformats-officedocument.presentationml.slide+xml"/>`,
  ).join("");

  entries.push({
    name: "[Content_Types].xml",
    data: txt(
      `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>\n` +
      `<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">` +
      `<Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>` +
      `<Default Extension="xml" ContentType="application/xml"/>` +
      mediaDefaultXml +
      `<Override PartName="/ppt/presentation.xml" ContentType="application/vnd.openxmlformats-officedocument.presentationml.presentation.main+xml"/>` +
      `<Override PartName="/ppt/slideMasters/slideMaster1.xml" ContentType="application/vnd.openxmlformats-officedocument.presentationml.slideMaster+xml"/>` +
      `<Override PartName="/ppt/slideLayouts/slideLayout1.xml" ContentType="application/vnd.openxmlformats-officedocument.presentationml.slideLayout+xml"/>` +
      slideOverrides +
      `</Types>`,
    ),
  });

  return writeZip(entries);
}
