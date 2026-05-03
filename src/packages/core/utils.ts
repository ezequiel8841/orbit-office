// @orbitoffice/core — utilities (zero deps).

export const clamp = (n: number, lo: number, hi: number) =>
  n < lo ? lo : n > hi ? hi : n;

export function debounce<T extends (...a: never[]) => void>(fn: T, ms: number) {
  let t: ReturnType<typeof setTimeout> | null = null;
  return (...args: Parameters<T>) => {
    if (t) clearTimeout(t);
    t = setTimeout(() => fn(...args), ms);
  };
}

export function throttle<T extends (...a: never[]) => void>(fn: T, ms: number) {
  let last = 0;
  let pending: ReturnType<typeof setTimeout> | null = null;
  let lastArgs: Parameters<T>;
  return (...args: Parameters<T>) => {
    lastArgs = args;
    const now = Date.now();
    const remaining = ms - (now - last);
    if (remaining <= 0) {
      if (pending) { clearTimeout(pending); pending = null; }
      last = now;
      fn(...args);
    } else if (!pending) {
      pending = setTimeout(() => {
        last = Date.now();
        pending = null;
        fn(...lastArgs);
      }, remaining);
    }
  };
}

export function rafThrottle<T extends (...a: never[]) => void>(fn: T) {
  let queued = false;
  let lastArgs: Parameters<T>;
  return (...args: Parameters<T>) => {
    lastArgs = args;
    if (queued) return;
    queued = true;
    requestAnimationFrame(() => {
      queued = false;
      fn(...lastArgs);
    });
  };
}

export const uuid = () =>
  typeof crypto !== "undefined" && "randomUUID" in crypto
    ? crypto.randomUUID()
    : Math.random().toString(36).slice(2) + Date.now().toString(36);

export const escapeHtml = (s: string) =>
  s.replace(/[&<>"']/g, (c) => ({
    "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;",
  }[c]!));

export const deepClone = <T,>(v: T): T =>
  typeof structuredClone === "function"
    ? structuredClone(v)
    : (JSON.parse(JSON.stringify(v)) as T);

const NUM_FMT_CACHE = new Map<string, Intl.NumberFormat>();
export function formatNumber(
  value: number,
  opts: Intl.NumberFormatOptions = {},
  locale = "en-US",
): string {
  const key = locale + JSON.stringify(opts);
  let f = NUM_FMT_CACHE.get(key);
  if (!f) {
    f = new Intl.NumberFormat(locale, opts);
    NUM_FMT_CACHE.set(key, f);
  }
  return f.format(value);
}

/** Parse common date formats: ISO, YYYY-MM-DD, DD/MM/YYYY, MM/DD/YYYY (en). */
export function parseDate(input: string): Date | null {
  const s = input.trim();
  if (!s) return null;
  // Native attempt first (handles ISO well).
  const native = new Date(s);
  if (!isNaN(native.getTime()) && /\d{4}-\d{2}-\d{2}/.test(s)) return native;
  let m = s.match(/^(\d{1,2})[\/\-.](\d{1,2})[\/\-.](\d{2,4})$/);
  if (m) {
    let [, a, b, y] = m;
    const ai = +a, bi = +b;
    let yi = +y; if (yi < 100) yi += 2000;
    // Heuristic: if first > 12, treat as DD/MM; else assume DD/MM (BR default).
    const day = ai, month = bi;
    const d = new Date(yi, month - 1, day);
    return isNaN(d.getTime()) ? null : d;
  }
  return isNaN(native.getTime()) ? null : native;
}
