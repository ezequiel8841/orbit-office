// @orbitoffice/doc — TeX subset → SVG renderer (~2 KB, no deps).
// Supports: a^b, a_b, \frac{a}{b}, \sqrt{a}, greek letters, +,-,=,*,/,(,),
// numbers, identifiers. Layout is metric-approximated.

interface Box { svg: string; w: number; h: number; baseline: number; }

const GREEK: Record<string, string> = {
  alpha: "α", beta: "β", gamma: "γ", delta: "δ", epsilon: "ε", zeta: "ζ",
  eta: "η", theta: "θ", iota: "ι", kappa: "κ", lambda: "λ", mu: "μ",
  nu: "ν", xi: "ξ", pi: "π", rho: "ρ", sigma: "σ", tau: "τ", upsilon: "υ",
  phi: "φ", chi: "χ", psi: "ψ", omega: "ω",
  Gamma: "Γ", Delta: "Δ", Theta: "Θ", Lambda: "Λ", Xi: "Ξ", Pi: "Π",
  Sigma: "Σ", Phi: "Φ", Psi: "Ψ", Omega: "Ω",
  infty: "∞", times: "×", cdot: "·", pm: "±", leq: "≤", geq: "≥", neq: "≠",
  to: "→", sum: "∑", int: "∫", partial: "∂",
};

class P {
  i = 0;
  constructor(public src: string) {}
  peek() { return this.src[this.i]; }
  next() { return this.src[this.i++]; }
  eof() { return this.i >= this.src.length; }
}

function textBox(t: string, fontSize = 16): Box {
  const w = t.length * fontSize * 0.55;
  return {
    svg: `<text x="0" y="${fontSize}" font-family="serif" font-style="italic" font-size="${fontSize}">${t}</text>`,
    w, h: fontSize * 1.2, baseline: fontSize,
  };
}

function group(boxes: Box[]): Box {
  let x = 0;
  let h = 0;
  let baseline = 0;
  const parts: string[] = [];
  for (const b of boxes) {
    parts.push(`<g transform="translate(${x},0)">${b.svg}</g>`);
    x += b.w + 2;
    h = Math.max(h, b.h);
    baseline = Math.max(baseline, b.baseline);
  }
  return { svg: parts.join(""), w: x, h, baseline };
}

function frac(num: Box, den: Box): Box {
  const w = Math.max(num.w, den.w) + 6;
  const ny = 0;
  const dy = num.h + 4;
  const lineY = num.h + 2;
  return {
    svg:
      `<g transform="translate(${(w - num.w) / 2},${ny})">${num.svg}</g>` +
      `<line x1="0" y1="${lineY}" x2="${w}" y2="${lineY}" stroke="currentColor" stroke-width="1"/>` +
      `<g transform="translate(${(w - den.w) / 2},${dy})">${den.svg}</g>`,
    w, h: num.h + den.h + 4, baseline: lineY + 4,
  };
}

function sqrt(inner: Box): Box {
  const pad = 4;
  const w = inner.w + pad * 2 + 8;
  const h = inner.h + 4;
  return {
    svg:
      `<path d="M0,${h * 0.6} L4,${h} L10,2 L${w},2" fill="none" stroke="currentColor"/>` +
      `<g transform="translate(${pad + 8},2)">${inner.svg}</g>`,
    w, h, baseline: inner.baseline + 2,
  };
}

function supSub(base: Box, sup?: Box, sub?: Box): Box {
  const sx = base.w + 1;
  let extraW = 0;
  let extraH = base.h;
  let parts = base.svg;
  if (sup) {
    parts += `<g transform="translate(${sx},-${base.h * 0.4})">${sup.svg}</g>`;
    extraW = Math.max(extraW, sup.w);
    extraH = Math.max(extraH, base.h + sup.h * 0.6);
  }
  if (sub) {
    parts += `<g transform="translate(${sx},${base.h * 0.4})">${sub.svg}</g>`;
    extraW = Math.max(extraW, sub.w);
    extraH = Math.max(extraH, base.h + sub.h * 0.6);
  }
  return { svg: parts, w: base.w + extraW, h: extraH, baseline: base.baseline };
}

function parseAtom(p: P): Box {
  while (!p.eof() && p.peek() === " ") p.i++;
  const c = p.peek();
  if (c === "{") {
    p.i++;
    const b = parseExpr(p, "}");
    if (p.peek() === "}") p.i++;
    return b;
  }
  if (c === "\\") {
    p.i++;
    let name = "";
    while (!p.eof() && /[a-zA-Z]/.test(p.peek())) name += p.next();
    if (name === "frac") {
      const n = parseAtom(p);
      const d = parseAtom(p);
      return frac(n, d);
    }
    if (name === "sqrt") {
      const inner = parseAtom(p);
      return sqrt(inner);
    }
    if (GREEK[name]) return textBox(GREEK[name]);
    return textBox(name);
  }
  if (/[0-9]/.test(c)) {
    let n = "";
    while (!p.eof() && /[0-9.]/.test(p.peek())) n += p.next();
    return textBox(n);
  }
  if (/[A-Za-z]/.test(c)) {
    return textBox(p.next());
  }
  // operators / punctuation
  return textBox(p.next() ?? "");
}

function parseExpr(p: P, stop = ""): Box {
  const items: Box[] = [];
  while (!p.eof() && p.peek() !== stop) {
    let b = parseAtom(p);
    while (p.peek() === "^" || p.peek() === "_") {
      let sup: Box | undefined, sub: Box | undefined;
      if (p.peek() === "^") { p.i++; sup = parseAtom(p); }
      if (p.peek() === "_") { p.i++; sub = parseAtom(p); }
      b = supSub(b, sup, sub);
    }
    items.push(b);
  }
  return group(items);
}

export function renderMath(tex: string): string {
  const box = parseExpr(new P(tex));
  const w = Math.ceil(box.w + 4);
  const h = Math.ceil(box.h + 4);
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}" viewBox="0 0 ${w} ${h}" class="oo-doc-math" role="img" aria-label="${tex.replace(/"/g, "&quot;")}">${box.svg}</svg>`;
}
