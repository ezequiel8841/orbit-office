// @orbitoffice/doc — minimal HTML sanitizer.
// Whitelist-based, parses with DOMParser, strips dangerous tags/attrs,
// neutralises javascript: / data: (except images) URLs.

const ALLOWED_TAGS = new Set([
  "a","p","span","div","br","hr","strong","b","em","i","u","s","sub","sup",
  "code","pre","blockquote","h1","h2","h3","h4","h5","h6",
  "ul","ol","li","input","img","table","thead","tbody","tr","th","td","figure","figcaption",
  "nav",
  "svg","path","line","rect","circle","ellipse","g","text","tspan",
]);

const ALLOWED_ATTRS: Record<string, Set<string>> = {
  a: new Set(["href","title","target","rel"]),
  img: new Set(["src","alt","title","width","height"]),
  input: new Set(["type","checked","disabled"]),
  span: new Set(["style"]),
  div: new Set(["style","class"]),
  nav: new Set(["class","style"]),
  td: new Set(["colspan","rowspan","style"]),
  th: new Set(["colspan","rowspan","style"]),
  table: new Set(["class","style"]),
  li: new Set(["data-checked","data-list","style"]),
  ul: new Set(["data-list"]),
  ol: new Set(["start"]),
  h1: new Set(["id"]), h2: new Set(["id"]), h3: new Set(["id"]),
  h4: new Set(["id"]), h5: new Set(["id"]), h6: new Set(["id"]),
  svg: new Set(["xmlns","width","height","viewBox","class","role","aria-label","style"]),
  path: new Set(["d","fill","stroke","stroke-width","stroke-linecap","stroke-linejoin"]),
  line: new Set(["x1","y1","x2","y2","stroke","stroke-width"]),
  rect: new Set(["x","y","width","height","fill","stroke","rx","ry"]),
  circle: new Set(["cx","cy","r","fill","stroke"]),
  ellipse: new Set(["cx","cy","rx","ry","fill","stroke"]),
  g: new Set(["transform","fill","stroke"]),
  text: new Set(["x","y","font-family","font-style","font-size","fill","transform"]),
  tspan: new Set(["x","y","dx","dy"]),
};

const SAFE_STYLE = /^(color|background(-color)?|font-size|font-weight|font-style|font-family|text-align|text-decoration|margin-left|width|height)\s*:\s*[^;{}<>]+$/i;

function safeUrl(url: string, allowData = false): string | null {
  const u = url.trim().toLowerCase();
  if (u.startsWith("javascript:") || u.startsWith("vbscript:")) return null;
  if (u.startsWith("data:") && !allowData) return null;
  return url;
}

function sanitizeStyle(value: string): string {
  return value
    .split(";")
    .map((s) => s.trim())
    .filter((s) => s && SAFE_STYLE.test(s))
    .join("; ");
}

function walk(node: Node) {
  if (node.nodeType === 1) {
    const el = node as HTMLElement;
    const tag = el.tagName.toLowerCase();
    if (!ALLOWED_TAGS.has(tag)) {
      // unwrap children
      const parent = el.parentNode;
      if (parent) {
        while (el.firstChild) parent.insertBefore(el.firstChild, el);
        parent.removeChild(el);
      }
      return;
    }
    const allowed = ALLOWED_ATTRS[tag] ?? new Set<string>();
    for (const attr of Array.from(el.attributes)) {
      const name = attr.name.toLowerCase();
      if (name.startsWith("on")) { el.removeAttribute(attr.name); continue; }
      if (!allowed.has(name)) { el.removeAttribute(attr.name); continue; }
      if (name === "href") {
        const safe = safeUrl(attr.value);
        if (safe == null) el.removeAttribute(attr.name);
        else el.setAttribute("rel", "noopener noreferrer");
      } else if (name === "src") {
        const safe = safeUrl(attr.value, tag === "img");
        if (safe == null) el.removeAttribute(attr.name);
      } else if (name === "style") {
        const v = sanitizeStyle(attr.value);
        if (v) el.setAttribute("style", v); else el.removeAttribute("style");
      }
    }
  }
  // recurse over a static copy of children since we may mutate
  for (const child of Array.from(node.childNodes)) walk(child);
}

export function sanitizeHtml(html: string): string {
  const doc = new DOMParser().parseFromString(`<div>${html}</div>`, "text/html");
  const root = doc.body.firstElementChild as HTMLElement;
  walk(root);
  return root.innerHTML;
}
