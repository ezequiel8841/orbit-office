// @orbitoffice/doc — minimal syntax highlighter (~3 KB).
// Returns HTML with <span class="oo-hl-{kind}"> spans.
// Supports: js, ts, py, html, css, json, md.

type Lang = "js" | "ts" | "py" | "html" | "css" | "json" | "md";

const KW: Record<string, string[]> = {
  js: "break case catch class const continue debugger default delete do else export extends finally for function if import in instanceof let new of return super switch this throw try typeof var void while with yield async await null true false undefined".split(" "),
  ts: "abstract any as boolean break case catch class const continue debugger default delete do else enum export extends finally for from function if implements import in instanceof interface let module namespace new null number of package private protected public readonly return string super switch this throw true try type typeof undefined var void while with yield async await false".split(" "),
  py: "False None True and as assert async await break class continue def del elif else except finally for from global if import in is lambda nonlocal not or pass raise return try while with yield".split(" "),
  css: [],
  html: [],
  json: ["true","false","null"],
  md: [],
};

function escape(s: string): string {
  return s.replace(/[&<>]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;" }[c]!));
}

function span(kind: string, text: string): string {
  return `<span class="oo-hl-${kind}">${escape(text)}</span>`;
}

function highlightProgrammatic(src: string, lang: Lang): string {
  const kw = new Set(KW[lang] ?? []);
  let out = "";
  let i = 0;
  const n = src.length;
  while (i < n) {
    const c = src[i];
    // line comment // or #
    if ((lang !== "py" && c === "/" && src[i + 1] === "/") || (lang === "py" && c === "#")) {
      let j = i;
      while (j < n && src[j] !== "\n") j++;
      out += span("comment", src.slice(i, j));
      i = j;
      continue;
    }
    // block comment /* */
    if (lang !== "py" && c === "/" && src[i + 1] === "*") {
      let j = i + 2;
      while (j < n && !(src[j] === "*" && src[j + 1] === "/")) j++;
      j = Math.min(n, j + 2);
      out += span("comment", src.slice(i, j));
      i = j;
      continue;
    }
    // strings
    if (c === '"' || c === "'" || c === "`") {
      const q = c;
      let j = i + 1;
      while (j < n && src[j] !== q) {
        if (src[j] === "\\") j++;
        j++;
      }
      j = Math.min(n, j + 1);
      out += span("string", src.slice(i, j));
      i = j;
      continue;
    }
    // numbers
    if (/[0-9]/.test(c)) {
      let j = i;
      while (j < n && /[0-9._eExX+\-a-fA-F]/.test(src[j])) j++;
      out += span("number", src.slice(i, j));
      i = j;
      continue;
    }
    // identifiers
    if (/[A-Za-z_$]/.test(c)) {
      let j = i;
      while (j < n && /[A-Za-z0-9_$]/.test(src[j])) j++;
      const word = src.slice(i, j);
      out += kw.has(word) ? span("keyword", word) : escape(word);
      i = j;
      continue;
    }
    out += escape(c);
    i++;
  }
  return out;
}

function highlightHtml(src: string): string {
  return escape(src)
    .replace(/(&lt;\/?)([a-zA-Z][a-zA-Z0-9-]*)/g, '$1<span class="oo-hl-keyword">$2</span>')
    .replace(/([a-zA-Z-]+)=(&quot;[^&]*?&quot;)/g, '<span class="oo-hl-attr">$1</span>=<span class="oo-hl-string">$2</span>');
}

function highlightCss(src: string): string {
  return escape(src)
    .replace(/(\/\*[\s\S]*?\*\/)/g, '<span class="oo-hl-comment">$1</span>')
    .replace(/([a-zA-Z-]+)\s*:/g, '<span class="oo-hl-attr">$1</span>:')
    .replace(/(#[0-9a-fA-F]{3,8}|\b\d+(\.\d+)?(px|em|rem|%|vh|vw)?)/g, '<span class="oo-hl-number">$1</span>');
}

function highlightMd(src: string): string {
  return escape(src)
    .replace(/^(#{1,6} .*)$/gm, '<span class="oo-hl-keyword">$1</span>')
    .replace(/(\*\*[^*]+\*\*|__[^_]+__)/g, '<span class="oo-hl-string">$1</span>')
    .replace(/(`[^`]+`)/g, '<span class="oo-hl-number">$1</span>');
}

export function highlight(src: string, lang: string): string {
  const l = (lang || "").toLowerCase();
  switch (l) {
    case "html": case "xml": case "svg": return highlightHtml(src);
    case "css": return highlightCss(src);
    case "md": case "markdown": return highlightMd(src);
    case "js": case "ts": case "py": case "json":
      return highlightProgrammatic(src, l as Lang);
    default:
      return escape(src);
  }
}
