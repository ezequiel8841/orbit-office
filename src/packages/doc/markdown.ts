// @orbitoffice/doc — Markdown ↔ HTML (subset of CommonMark+GFM).
// Zero deps. Used for import/export of the editor content.

import { escapeHtml } from "../core/utils";

/* ---------------- Markdown → HTML ---------------- */

export function mdToHtml(md: string): string {
  const lines = md.replace(/\r\n?/g, "\n").split("\n");
  const out: string[] = [];
  let i = 0;
  while (i < lines.length) {
    const line = lines[i];

    if (/^\s*$/.test(line)) { i++; continue; }

    // fenced code
    const fence = line.match(/^```(\w+)?\s*$/);
    if (fence) {
      const lang = fence[1] ?? "";
      i++;
      const buf: string[] = [];
      while (i < lines.length && !/^```\s*$/.test(lines[i])) buf.push(lines[i++]);
      i++; // closing fence
      out.push(
        `<pre data-lang="${escapeHtml(lang)}"><code>${escapeHtml(buf.join("\n"))}</code></pre>`,
      );
      continue;
    }

    // headings
    const h = line.match(/^(#{1,6})\s+(.*)$/);
    if (h) {
      const level = h[1].length;
      out.push(`<h${level}>${inlineMd(h[2])}</h${level}>`);
      i++; continue;
    }

    // hr
    if (/^\s*([-*_])\s*\1\s*\1[-*_\s]*$/.test(line)) {
      out.push("<hr/>"); i++; continue;
    }

    // blockquote
    if (/^>\s?/.test(line)) {
      const buf: string[] = [];
      while (i < lines.length && /^>\s?/.test(lines[i])) {
        buf.push(lines[i].replace(/^>\s?/, ""));
        i++;
      }
      out.push(`<blockquote>${inlineMd(buf.join(" "))}</blockquote>`);
      continue;
    }

    // lists
    if (/^\s*([-*+]|\d+\.)\s+/.test(line)) {
      const ordered = /^\s*\d+\.\s+/.test(line);
      const tag = ordered ? "ol" : "ul";
      const items: string[] = [];
      while (i < lines.length && /^\s*([-*+]|\d+\.)\s+/.test(lines[i])) {
        const m = lines[i].match(/^\s*(?:[-*+]|\d+\.)\s+(.*)$/)!;
        let text = m[1];
        const chk = text.match(/^\[([ xX])\]\s+(.*)$/);
        if (chk) {
          const checked = chk[1].toLowerCase() === "x";
          items.push(
            `<li data-checked="${checked}"><input type="checkbox"${checked ? " checked" : ""} disabled/> ${inlineMd(chk[2])}</li>`,
          );
        } else {
          items.push(`<li>${inlineMd(text)}</li>`);
        }
        i++;
      }
      out.push(`<${tag}>${items.join("")}</${tag}>`);
      continue;
    }

    // paragraph (collect adjacent non-empty lines)
    const buf: string[] = [line];
    i++;
    while (i < lines.length && !/^\s*$/.test(lines[i]) && !startsBlock(lines[i])) {
      buf.push(lines[i++]);
    }
    out.push(`<p>${inlineMd(buf.join(" "))}</p>`);
  }
  return out.join("");
}

function startsBlock(l: string): boolean {
  return (
    /^#{1,6}\s+/.test(l) ||
    /^\s*([-*+]|\d+\.)\s+/.test(l) ||
    /^>\s?/.test(l) ||
    /^```/.test(l) ||
    /^\s*([-*_])\s*\1\s*\1[-*_\s]*$/.test(l)
  );
}

function inlineMd(s: string): string {
  let out = escapeHtml(s);
  // images: ![alt](src)
  out = out.replace(/!\[([^\]]*)\]\(([^)\s]+)\)/g,
    (_m, alt, src) => `<img src="${alt ? alt : ""}" alt="${alt}" data-src="${src}"/>`
      .replace('src=""', `src="${src}"`));
  // links: [text](href)
  out = out.replace(/\[([^\]]+)\]\(([^)\s]+)\)/g,
    (_m, text, href) => `<a href="${href}">${text}</a>`);
  // inline code
  out = out.replace(/`([^`]+)`/g, (_m, c) => `<code>${c}</code>`);
  // bold **x** or __x__
  out = out.replace(/(\*\*|__)(.+?)\1/g, "<strong>$2</strong>");
  // italic *x* or _x_
  out = out.replace(/(\*|_)(.+?)\1/g, "<em>$2</em>");
  // strike ~~x~~
  out = out.replace(/~~(.+?)~~/g, "<s>$1</s>");
  return out;
}

/* ---------------- HTML → Markdown ---------------- */

export function htmlToMd(html: string): string {
  const div = document.createElement("div");
  div.innerHTML = html;
  return walk(div).trim() + "\n";
}

function walk(node: Node): string {
  if (node.nodeType === Node.TEXT_NODE) return node.textContent ?? "";
  if (node.nodeType !== Node.ELEMENT_NODE) return "";
  const el = node as HTMLElement;
  const tag = el.tagName.toLowerCase();
  const inner = () => Array.from(el.childNodes).map(walk).join("");
  switch (tag) {
    case "h1": case "h2": case "h3": case "h4": case "h5": case "h6": {
      const n = +tag[1];
      return `\n${"#".repeat(n)} ${inner()}\n\n`;
    }
    case "p": case "div": return `\n${inner()}\n\n`;
    case "br": return "  \n";
    case "hr": return `\n---\n\n`;
    case "strong": case "b": return `**${inner()}**`;
    case "em": case "i": return `*${inner()}*`;
    case "s": case "del": case "strike": return `~~${inner()}~~`;
    case "u": return `<u>${inner()}</u>`;
    case "code":
      if (el.parentElement?.tagName === "PRE") return inner();
      return `\`${inner()}\``;
    case "pre": {
      const code = el.querySelector("code");
      const lang = el.getAttribute("data-lang") ?? "";
      const txt = (code?.textContent ?? el.textContent ?? "").replace(/\n+$/, "");
      return `\n\`\`\`${lang}\n${txt}\n\`\`\`\n\n`;
    }
    case "blockquote": {
      const lines = inner().trim().split("\n");
      return `\n${lines.map((l) => `> ${l}`).join("\n")}\n\n`;
    }
    case "ul": case "ol": {
      const items = Array.from(el.children).filter((c) => c.tagName === "LI") as HTMLElement[];
      const out = items.map((li, idx) => {
        const checked = li.getAttribute("data-checked");
        const prefix = tag === "ol" ? `${idx + 1}.` : "-";
        const box = checked != null ? (checked === "true" ? "[x] " : "[ ] ") : "";
        return `${prefix} ${box}${walk(li).trim()}`;
      }).join("\n");
      return `\n${out}\n\n`;
    }
    case "li": return inner();
    case "a": {
      const href = el.getAttribute("href") ?? "";
      return `[${inner()}](${href})`;
    }
    case "img": {
      const alt = el.getAttribute("alt") ?? "";
      const src = el.getAttribute("src") ?? "";
      return `![${alt}](${src})`;
    }
    default: return inner();
  }
}
