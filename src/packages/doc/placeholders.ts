// @orbitoffice/doc — Smart Docs placeholder utilities.
// Chips render as `<span class="oo-doc-chip" data-ph="<type>.<key>"
// data-label="<key>" contenteditable="false">{{key}}</span>` so they survive
// any HTML round-trip and are picked up by the CRM `parse-smart-doc-template`.

import {
  PLACEHOLDER_REGEX,
  autoMapPlaceholder,
  type SmartDocPlaceholder,
} from "../core/smartDocs";

const CHIP_CLASS = "oo-doc-chip";

function escapeHtml(s: string): string {
  return s.replace(/[&<>"']/g, (c) =>
    ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]!),
  );
}

function chipHtml(key: string): string {
  const m = autoMapPlaceholder(key);
  return (
    `<span class="${CHIP_CLASS}" data-ph="${m.mapping_type}.${escapeHtml(m.mapping_key)}"` +
    ` data-label="${escapeHtml(key)}" contenteditable="false">{{${escapeHtml(key)}}}</span>`
  );
}

/**
 * Walks `html` and wraps any literal `{{key}}` that is NOT already inside a
 * `data-ph` chip. Safe to call repeatedly (idempotent).
 */
export function wrapLiteralPlaceholders(html: string): string {
  if (!html) return html;
  if (typeof document === "undefined") {
    // Node fallback (used by tests / Deno edge): naive replace, but skips
    // strings already inside a chip span.
    return html.replace(PLACEHOLDER_REGEX, (full, key) => {
      if (typeof key !== "string") return full;
      return chipHtml(key);
    });
  }
  const root = document.createElement("div");
  root.innerHTML = html;
  const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT, {
    acceptNode(node) {
      let p: Node | null = node.parentNode;
      while (p && p !== root) {
        if (p.nodeType === 1 && (p as HTMLElement).hasAttribute("data-ph")) {
          return NodeFilter.FILTER_REJECT;
        }
        p = p.parentNode;
      }
      return PLACEHOLDER_REGEX.test(node.textContent ?? "")
        ? NodeFilter.FILTER_ACCEPT
        : NodeFilter.FILTER_SKIP;
    },
  });
  const targets: Text[] = [];
  let n: Node | null;
  while ((n = walker.nextNode())) targets.push(n as Text);
  for (const t of targets) {
    const text = t.textContent ?? "";
    PLACEHOLDER_REGEX.lastIndex = 0;
    let last = 0;
    const frag = document.createDocumentFragment();
    let m: RegExpExecArray | null;
    while ((m = PLACEHOLDER_REGEX.exec(text))) {
      if (m.index > last) frag.appendChild(document.createTextNode(text.slice(last, m.index)));
      const tpl = document.createElement("template");
      tpl.innerHTML = chipHtml(m[1]);
      frag.appendChild(tpl.content);
      last = m.index + m[0].length;
    }
    if (last < text.length) frag.appendChild(document.createTextNode(text.slice(last)));
    t.parentNode?.replaceChild(frag, t);
  }
  return root.innerHTML;
}

/** Extract every chip + literal placeholder into a `SmartDocPlaceholder[]`. */
export function extractPlaceholders(root: HTMLElement | string): SmartDocPlaceholder[] {
  const map = new Map<string, SmartDocPlaceholder>();
  const add = (key: string, type?: string, mappingKey?: string) => {
    const auto = autoMapPlaceholder(key);
    const mapping_type = (type as SmartDocPlaceholder["mapping_type"]) || auto.mapping_type;
    const mapping_key = mappingKey || auto.mapping_key;
    const id = `${mapping_type}.${mapping_key}.${key}`;
    const cur = map.get(id);
    if (cur) cur.occurrences = (cur.occurrences ?? 1) + 1;
    else map.set(id, { key, mapping_type, mapping_key, occurrences: 1 });
  };

  if (typeof root === "string" || typeof document === "undefined") {
    const html = typeof root === "string" ? root : (root as HTMLElement).innerHTML;
    // Chip spans
    const chipRe = /<span[^>]*data-ph="([^"]+)"[^>]*data-label="([^"]+)"[^>]*>/g;
    let m: RegExpExecArray | null;
    while ((m = chipRe.exec(html))) {
      const [type, ...rest] = m[1].split(".");
      add(m[2], type, rest.join("."));
    }
    // Strip chips and find literal placeholders in the remainder
    const stripped = html.replace(/<span[^>]*data-ph="[^"]+"[^>]*>[\s\S]*?<\/span>/g, "");
    PLACEHOLDER_REGEX.lastIndex = 0;
    let lit: RegExpExecArray | null;
    while ((lit = PLACEHOLDER_REGEX.exec(stripped))) add(lit[1]);
    return [...map.values()];
  }

  // DOM path
  root.querySelectorAll<HTMLElement>("[data-ph]").forEach((el) => {
    const ph = el.getAttribute("data-ph") ?? "";
    const label = el.getAttribute("data-label") ?? el.textContent ?? "";
    const [type, ...rest] = ph.split(".");
    const key = (label.match(/\{\{\s*([\w][\w.\-]{0,80})\s*\}\}/)?.[1]) ?? label;
    add(key, type, rest.join("."));
  });
  // Literal text outside chips
  const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT, {
    acceptNode(node) {
      let p: Node | null = node.parentNode;
      while (p && p !== root) {
        if (p.nodeType === 1 && (p as HTMLElement).hasAttribute("data-ph")) {
          return NodeFilter.FILTER_REJECT;
        }
        p = p.parentNode;
      }
      return NodeFilter.FILTER_ACCEPT;
    },
  });
  let n: Node | null;
  while ((n = walker.nextNode())) {
    const text = n.textContent ?? "";
    PLACEHOLDER_REGEX.lastIndex = 0;
    let m: RegExpExecArray | null;
    while ((m = PLACEHOLDER_REGEX.exec(text))) add(m[1]);
  }
  return [...map.values()];
}

/**
 * Replace chip spans with raw `{{key}}` so the CRM `generate-smart-doc`
 * function can run its templating engine.
 */
export function serializeHtmlForGenerate(html: string): string {
  return html.replace(
    /<span[^>]*\sdata-ph="[^"]+"[^>]*\sdata-label="([^"]+)"[^>]*>[\s\S]*?<\/span>/g,
    (_full, label) => `{{${label}}}`,
  );
}

/** Build the chip HTML for a given placeholder (for insert commands). */
export function buildChipHtml(ph: SmartDocPlaceholder): string {
  return (
    `<span class="${CHIP_CLASS}" data-ph="${ph.mapping_type}.${escapeHtml(ph.mapping_key)}"` +
    ` data-label="${escapeHtml(ph.key)}" contenteditable="false">{{${escapeHtml(ph.key)}}}</span>`
  );
}
