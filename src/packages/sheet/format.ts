import type { CellValue, NumFormat, CellStyle } from "./model";

// Coerce raw user input string into a typed CellValue.
export function coerceInput(raw: string): CellValue {
  if (raw === "") return null;
  const t = raw.trim();
  if (t === "TRUE" || t === "true") return true;
  if (t === "FALSE" || t === "false") return false;
  // number with optional % suffix
  const pctMatch = /^-?\d+(\.\d+)?%$/.exec(t);
  if (pctMatch) return parseFloat(t) / 100;
  if (/^-?\d+(\.\d+)?$/.test(t)) return parseFloat(t);
  return raw;
}

const fmtNumber = (n: number, frac = 2) =>
  new Intl.NumberFormat(undefined, {
    minimumFractionDigits: frac,
    maximumFractionDigits: frac,
  }).format(n);

const fmtCurrency = (n: number) =>
  new Intl.NumberFormat(undefined, {
    style: "currency",
    currency: "USD",
  }).format(n);

const fmtPercent = (n: number) =>
  new Intl.NumberFormat(undefined, {
    style: "percent",
    minimumFractionDigits: 1,
    maximumFractionDigits: 2,
  }).format(n);

export function formatCell(v: CellValue, style?: CellStyle): string {
  if (v === null || v === undefined) return "";
  if (typeof v === "boolean") return v ? "TRUE" : "FALSE";
  if (typeof v === "string") return v;
  // number
  const fmt: NumFormat = style?.format ?? "general";
  switch (fmt) {
    case "integer":
      return new Intl.NumberFormat().format(Math.trunc(v));
    case "number":
      return fmtNumber(v);
    case "currency":
      return fmtCurrency(v);
    case "percent":
      return fmtPercent(v);
    case "date": {
      // treat number as days since 1970-01-01 (simplified)
      const d = new Date(v * 86400000);
      return d.toISOString().slice(0, 10);
    }
    default:
      return Number.isInteger(v) ? String(v) : String(v);
  }
}

export function defaultAlign(v: CellValue): "left" | "right" | "center" {
  if (typeof v === "number") return "right";
  if (typeof v === "boolean") return "center";
  return "left";
}
