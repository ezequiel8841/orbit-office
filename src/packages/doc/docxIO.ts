// @orbitoffice/doc — HTML → DOCX exporter (pure OOXML via zip.ts, no dependencies).
import { writeZip, type ZipEntry } from "../../packages-optional/zip/index";

function xmlEnc(s: string): string {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
}

function rgbToHex(rgb: string): string {
  const m = rgb.match(/rgb\((\d+),\s*(\d+),\s*(\d+)\)/);
  if (!m) return rgb.replace("#", "");
  return [+m[1], +m[2], +m[3]].map((x) => x.toString(16).padStart(2, "0")).join("");
}

interface RunProps {
  bold?: boolean;
  italic?: boolean;
  underline?: boolean;
  strike?: boolean;
  code?: boolean;
  sub?: boolean;
  sup?: boolean;
  color?: string;
  fontSize?: number;
  fontFamily?: string;
}

function buildRpr(p: RunProps): string {
  const parts: string[] = [];
  if (p.bold || p.code) parts.push("<w:b/><w:bCs/>");
  if (p.italic) parts.push("<w:i/><w:iCs/>");
  if (p.underline) parts.push('<w:u w:val="single"/>');
  if (p.strike) parts.push("<w:strike/>");
  if (p.color) parts.push(`<w:color w:val="${rgbToHex(p.color).replace("#", "")}"/>`);
  if (p.fontSize) parts.push(`<w:sz w:val="${Math.round(p.fontSize * 2)}"/><w:szCs w:val="${Math.round(p.fontSize * 2)}"/>`);
  if (p.code) parts.push('<w:rFonts w:ascii="Courier New" w:hAnsi="Courier New"/>');
  else if (p.fontFamily) parts.push(`<w:rFonts w:ascii="${xmlEnc(p.fontFamily)}" w:hAnsi="${xmlEnc(p.fontFamily)}"/>`);
  if (p.sub) parts.push('<w:vertAlign w:val="subscript"/>');
  if (p.sup) parts.push('<w:vertAlign w:val="superscript"/>');
  return parts.length > 0 ? `<w:rPr>${parts.join("")}</w:rPr>` : "";
}

function nodeToRuns(node: Node, props: RunProps = {}): string {
  if (node.nodeType === Node.TEXT_NODE) {
    const text = node.textContent ?? "";
    if (!text) return "";
    return `<w:r>${buildRpr(props)}<w:t xml:space="preserve">${xmlEnc(text)}</w:t></w:r>`;
  }
  if (node.nodeType !== Node.ELEMENT_NODE) return "";
  const el = node as HTMLElement;
  const tag = el.tagName.toLowerCase();
  const p: RunProps = { ...props };
  if (tag === "b" || tag === "strong") p.bold = true;
  if (tag === "i" || tag === "em") p.italic = true;
  if (tag === "u") p.underline = true;
  if (tag === "s" || tag === "del" || tag === "strike") p.strike = true;
  if (tag === "code") p.code = true;
  if (tag === "sub") p.sub = true;
  if (tag === "sup") p.sup = true;
  if (tag === "span") {
    const st = el.style;
    if (st.color) p.color = st.color;
    if (st.fontSize) p.fontSize = parseFloat(st.fontSize);
    if (st.fontFamily) p.fontFamily = st.fontFamily.replace(/['"]/g, "").split(",")[0].trim();
  }
  if (tag === "br") return '<w:r><w:br/></w:r>';
  if (tag === "a") {
    return [...el.childNodes].map((n) => nodeToRuns(n, p)).join("");
  }
  // ignore images / inputs in runs
  if (tag === "img" || tag === "input") return "";
  return [...el.childNodes].map((n) => nodeToRuns(n, p)).join("");
}

function listItems(ul: HTMLElement, numId: string, level = 0): string {
  return [...ul.children].map((child) => {
    const tag = child.tagName.toLowerCase();
    if (tag === "li") {
      const runs = [...child.childNodes]
        .filter((n) => !(n.nodeType === Node.ELEMENT_NODE && /^(ul|ol)$/.test((n as HTMLElement).tagName.toLowerCase())))
        .map((n) => nodeToRuns(n))
        .join("");
      let result = `<w:p><w:pPr><w:numPr><w:ilvl w:val="${level}"/><w:numId w:val="${numId}"/></w:numPr></w:pPr>${runs}</w:p>`;
      // nested lists
      for (const sub of child.children) {
        const st = sub.tagName.toLowerCase();
        if (st === "ul" || st === "ol") {
          const subNumId = st === "ol" ? "2" : "1";
          result += listItems(sub as HTMLElement, subNumId, level + 1);
        }
      }
      return result;
    }
    return "";
  }).join("");
}

function elementToXml(el: HTMLElement): string {
  const tag = el.tagName.toLowerCase();
  const align = el.style.textAlign;
  const jc = align ? `<w:jc w:val="${align === "justify" ? "both" : align}"/>` : "";

  const headingStyles: Record<string, string> = {
    h1: "Heading1", h2: "Heading2", h3: "Heading3",
    h4: "Heading4", h5: "Heading5", h6: "Heading6",
  };

  if (headingStyles[tag]) {
    const runs = [...el.childNodes].map((n) => nodeToRuns(n)).join("");
    return `<w:p><w:pPr><w:pStyle w:val="${headingStyles[tag]}"/>${jc}</w:pPr>${runs}</w:p>`;
  }

  if (tag === "p") {
    const runs = [...el.childNodes].map((n) => nodeToRuns(n)).join("");
    return `<w:p><w:pPr>${jc}</w:pPr>${runs}</w:p>`;
  }

  if (tag === "blockquote") {
    const runs = [...el.childNodes].map((n) => nodeToRuns(n)).join("");
    return `<w:p><w:pPr><w:pStyle w:val="Quote"/>${jc}</w:pPr>${runs}</w:p>`;
  }

  if (tag === "pre") {
    const runs = [...el.childNodes].map((n) => nodeToRuns(n)).join("");
    return `<w:p><w:pPr><w:pStyle w:val="Code"/></w:pPr>${runs}</w:p>`;
  }

  if (tag === "ul" || tag === "ol") {
    const numId = tag === "ol" ? "2" : "1";
    return listItems(el, numId, 0);
  }

  if (tag === "hr") {
    return '<w:p><w:pPr><w:pBdr><w:bottom w:val="single" w:sz="6" w:space="1" w:color="AAAAAA"/></w:pBdr></w:pPr></w:p>';
  }

  if (tag === "table") {
    const rows = el.querySelectorAll("tr");
    const rowsXml = [...rows].map((tr) => {
      const cells = [...tr.querySelectorAll("td, th")];
      const isHeader = cells[0]?.tagName === "TH";
      const cellsXml = cells.map((cell) => {
        const runs = [...(cell as HTMLElement).childNodes].map((n) => nodeToRuns(n, isHeader ? { bold: true } : {})).join("");
        return `<w:tc><w:tcPr><w:tcBorders><w:top w:val="single" w:sz="4" w:space="0" w:color="CCCCCC"/><w:left w:val="single" w:sz="4" w:space="0" w:color="CCCCCC"/><w:bottom w:val="single" w:sz="4" w:space="0" w:color="CCCCCC"/><w:right w:val="single" w:sz="4" w:space="0" w:color="CCCCCC"/></w:tcBorders></w:tcPr><w:p>${runs ? `<w:r><w:t xml:space="preserve"></w:t></w:r>${runs}` : "<w:r><w:t> </w:t></w:r>"}</w:p></w:tc>`;
      }).join("");
      return `<w:tr>${cellsXml}</w:tr>`;
    }).join("");
    return `<w:tbl><w:tblPr><w:tblStyle w:val="TableGrid"/><w:tblW w:w="0" w:type="auto"/></w:tblPr><w:tblGrid/>${rowsXml}</w:tbl>`;
  }

  if (tag === "div") {
    if (el.classList.contains("oo-page-break")) {
      return '<w:p><w:r><w:br w:type="page"/></w:r></w:p>';
    }
    return [...el.childNodes].map((n) => nodeToXml(n)).join("");
  }

  // nav, section, figure, etc. — recurse
  return [...el.childNodes].map((n) => nodeToXml(n)).join("");
}

function nodeToXml(node: Node): string {
  if (node.nodeType === Node.TEXT_NODE) {
    const text = (node.textContent ?? "").trim();
    return text ? `<w:p><w:r><w:t xml:space="preserve">${xmlEnc(text)}</w:t></w:r></w:p>` : "";
  }
  if (node.nodeType !== Node.ELEMENT_NODE) return "";
  return elementToXml(node as HTMLElement);
}

export async function exportDocx(html: string, filename = "document.docx"): Promise<void> {
  const root = document.createElement("div");
  root.innerHTML = html;

  const bodyXml = [...root.childNodes].map((n) => nodeToXml(n)).filter(Boolean).join("\n");

  const utf8 = new TextEncoder();

  const contentTypes = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">
  <Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>
  <Default Extension="xml" ContentType="application/xml"/>
  <Override PartName="/word/document.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml"/>
  <Override PartName="/word/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.styles+xml"/>
  <Override PartName="/word/settings.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.settings+xml"/>
  <Override PartName="/word/numbering.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.numbering+xml"/>
</Types>`;

  const rootRels = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
  <Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="word/document.xml"/>
</Relationships>`;

  const docRels = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
  <Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/styles" Target="styles.xml"/>
  <Relationship Id="rId2" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/settings" Target="settings.xml"/>
  <Relationship Id="rId3" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/numbering" Target="numbering.xml"/>
</Relationships>`;

  const documentXml = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main"
            xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships">
  <w:body>
${bodyXml}
    <w:sectPr>
      <w:pgSz w:w="12240" w:h="15840"/>
      <w:pgMar w:top="1440" w:right="1440" w:bottom="1440" w:left="1440" w:header="720" w:footer="720" w:gutter="0"/>
    </w:sectPr>
  </w:body>
</w:document>`;

  const stylesXml = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<w:styles xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main">
  <w:docDefaults>
    <w:rPrDefault><w:rPr>
      <w:rFonts w:ascii="Calibri" w:hAnsi="Calibri"/>
      <w:sz w:val="24"/><w:szCs w:val="24"/>
    </w:rPr></w:rPrDefault>
  </w:docDefaults>
  <w:style w:type="paragraph" w:styleId="Normal" w:default="1"><w:name w:val="Normal"/></w:style>
  <w:style w:type="paragraph" w:styleId="Heading1"><w:name w:val="heading 1"/>
    <w:pPr><w:spacing w:before="240" w:after="120"/></w:pPr>
    <w:rPr><w:b/><w:bCs/><w:sz w:val="52"/><w:szCs w:val="52"/></w:rPr></w:style>
  <w:style w:type="paragraph" w:styleId="Heading2"><w:name w:val="heading 2"/>
    <w:pPr><w:spacing w:before="200" w:after="100"/></w:pPr>
    <w:rPr><w:b/><w:bCs/><w:sz w:val="40"/><w:szCs w:val="40"/></w:rPr></w:style>
  <w:style w:type="paragraph" w:styleId="Heading3"><w:name w:val="heading 3"/>
    <w:pPr><w:spacing w:before="160" w:after="80"/></w:pPr>
    <w:rPr><w:b/><w:bCs/><w:sz w:val="32"/><w:szCs w:val="32"/></w:rPr></w:style>
  <w:style w:type="paragraph" w:styleId="Heading4"><w:name w:val="heading 4"/>
    <w:rPr><w:b/><w:bCs/><w:sz w:val="28"/><w:szCs w:val="28"/></w:rPr></w:style>
  <w:style w:type="paragraph" w:styleId="Heading5"><w:name w:val="heading 5"/>
    <w:rPr><w:b/><w:bCs/><w:sz w:val="26"/><w:szCs w:val="26"/></w:rPr></w:style>
  <w:style w:type="paragraph" w:styleId="Heading6"><w:name w:val="heading 6"/>
    <w:rPr><w:sz w:val="24"/><w:szCs w:val="24"/></w:rPr></w:style>
  <w:style w:type="paragraph" w:styleId="Quote"><w:name w:val="Quote"/>
    <w:pPr><w:ind w:left="720"/></w:pPr>
    <w:rPr><w:i/><w:iCs/><w:color w:val="666666"/></w:rPr></w:style>
  <w:style w:type="paragraph" w:styleId="Code"><w:name w:val="Code"/>
    <w:pPr><w:shd w:val="clear" w:color="auto" w:fill="F0F0F0"/><w:ind w:left="360"/></w:pPr>
    <w:rPr><w:rFonts w:ascii="Courier New" w:hAnsi="Courier New"/><w:sz w:val="20"/></w:rPr></w:style>
  <w:style w:type="table" w:styleId="TableGrid"><w:name w:val="Table Grid"/></w:style>
</w:styles>`;

  const settingsXml = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<w:settings xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main">
  <w:defaultTabStop w:val="720"/>
  <w:compat><w:compatSetting w:name="compatibilityMode" w:uri="http://schemas.microsoft.com/office/word" w:val="15"/></w:compat>
</w:settings>`;

  const numberingXml = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<w:numbering xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main">
  <w:abstractNum w:abstractNumId="0">
    <w:multiLevelType w:val="hybridMultilevel"/>
    <w:lvl w:ilvl="0"><w:start w:val="1"/><w:numFmt w:val="bullet"/><w:lvlText w:val="•"/>
      <w:lvlJc w:val="left"/><w:pPr><w:ind w:left="720" w:hanging="360"/></w:pPr></w:lvl>
    <w:lvl w:ilvl="1"><w:start w:val="1"/><w:numFmt w:val="bullet"/><w:lvlText w:val="◦"/>
      <w:lvlJc w:val="left"/><w:pPr><w:ind w:left="1080" w:hanging="360"/></w:pPr></w:lvl>
  </w:abstractNum>
  <w:abstractNum w:abstractNumId="1">
    <w:multiLevelType w:val="hybridMultilevel"/>
    <w:lvl w:ilvl="0"><w:start w:val="1"/><w:numFmt w:val="decimal"/><w:lvlText w:val="%1."/>
      <w:lvlJc w:val="left"/><w:pPr><w:ind w:left="720" w:hanging="360"/></w:pPr></w:lvl>
    <w:lvl w:ilvl="1"><w:start w:val="1"/><w:numFmt w:val="lowerLetter"/><w:lvlText w:val="%2."/>
      <w:lvlJc w:val="left"/><w:pPr><w:ind w:left="1080" w:hanging="360"/></w:pPr></w:lvl>
  </w:abstractNum>
  <w:num w:numId="1"><w:abstractNumId w:val="0"/></w:num>
  <w:num w:numId="2"><w:abstractNumId w:val="1"/></w:num>
</w:numbering>`;

  const entries: ZipEntry[] = [
    { name: "[Content_Types].xml", data: utf8.encode(contentTypes) },
    { name: "_rels/.rels", data: utf8.encode(rootRels) },
    { name: "word/_rels/document.xml.rels", data: utf8.encode(docRels) },
    { name: "word/document.xml", data: utf8.encode(documentXml) },
    { name: "word/styles.xml", data: utf8.encode(stylesXml) },
    { name: "word/settings.xml", data: utf8.encode(settingsXml) },
    { name: "word/numbering.xml", data: utf8.encode(numberingXml) },
  ];

  const buf = await writeZip(entries);
  const blob = new Blob([buf], {
    type: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  });
  const a = document.createElement("a");
  a.href = URL.createObjectURL(blob);
  a.download = filename;
  a.click();
  URL.revokeObjectURL(a.href);
}
