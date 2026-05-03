// Sheet data model. Sparse, Map-based.
export type CellValue = string | number | boolean | null;

export interface BorderSides {
  top?: boolean;
  right?: boolean;
  bottom?: boolean;
  left?: boolean;
}
export interface CellStyle {
  bold?: boolean;
  italic?: boolean;
  underline?: boolean;
  align?: "left" | "center" | "right";
  color?: string;
  bg?: string;
  format?: NumFormat;
  borders?: BorderSides;
}
export type NumFormat =
  | "general"
  | "number"
  | "integer"
  | "percent"
  | "currency"
  | "date";

export interface Cell {
  v?: CellValue;
  f?: string; // formula text without leading '='
  s?: CellStyle;
  /** Optional comment text. */
  cm?: string;
}

export interface MergeRect {
  r1: number;
  c1: number;
  r2: number;
  c2: number;
}
export interface DataValidation {
  /** Range coverage. */
  r1: number; c1: number; r2: number; c2: number;
  rule:
    | { kind: "list"; values: string[] }
    | { kind: "number"; min?: number; max?: number }
    | { kind: "text"; minLen?: number; maxLen?: number };
  /** When true, invalid input is rejected. Otherwise just flagged. */
  strict?: boolean;
}
export interface SheetData {
  id: string;
  name: string;
  cells: Map<string, Cell>; // key "A1"
  cols: Map<number, { w: number }>;
  rows: Map<number, { h: number }>;
  numRows: number;
  numCols: number;
  /** Per-column filter: only rows whose value (string) is in the set are visible. null = no filter. */
  filters: Map<number, Set<string>>;
  /** Derived from filters; rows hidden from view. */
  hiddenRows: Set<number>;
  /** Merged ranges. Anchor = top-left. */
  merges: MergeRect[];
  /** Frozen header rows/columns. */
  freezeRows: number;
  freezeCols: number;
  /** Data validations (first match wins). */
  validations: DataValidation[];
  /** Charts anchored to ranges. */
  charts: ChartSpec[];
  /** Conditional formatting rules. First match wins per cell. */
  condFormats: CondFormat[];
}

export type CondRule =
  | { kind: "greater"; value: number }
  | { kind: "less"; value: number }
  | { kind: "between"; min: number; max: number }
  | { kind: "equal"; value: string | number }
  | { kind: "contains"; text: string }
  | { kind: "duplicates" }
  | { kind: "topN"; n: number; bottom?: boolean }
  | { kind: "colorScale"; min?: string; mid?: string; max?: string };

export interface CondFormat {
  /** Range coverage. */
  r1: number; c1: number; r2: number; c2: number;
  rule: CondRule;
  /** Applied style when rule matches (ignored for colorScale, which computes bg). */
  style?: { bg?: string; color?: string; bold?: boolean; italic?: boolean };
}

export interface ChartSpec {
  id: string;
  kind: "line" | "bar" | "column";
  /** Data source range (incl. header row if hasHeader). */
  range: MergeRect;
  hasHeader?: boolean;
  /** Position in pixels (canvas-absolute). */
  x: number; y: number; w: number; h: number;
  title?: string;
}

export interface NamedRange {
  /** Lower-cased name used for lookup. */
  name: string;
  /** Reference text like "Sheet1!A1:B5" or "Sheet1!A1". */
  ref: string;
}

export interface WorkbookData {
  sheets: SheetData[];
  activeSheetId: string;
  /** Workbook-scoped named ranges. */
  names?: NamedRange[];
}

export const DEFAULT_COL_W = 96;
export const DEFAULT_ROW_H = 24;
export const HEADER_H = 24;
export const HEADER_W = 44;

export function createSheet(
  name = "Sheet1",
  numRows = 200,
  numCols = 26,
): SheetData {
  return {
    id: "s_" + Math.random().toString(36).slice(2, 9),
    name,
    cells: new Map(),
    cols: new Map(),
    rows: new Map(),
    numRows,
    numCols,
    filters: new Map(),
    hiddenRows: new Set(),
    merges: [],
    freezeRows: 0,
    freezeCols: 0,
    validations: [],
    charts: [],
    condFormats: [],
  };
}

export function createWorkbook(): WorkbookData {
  const s = createSheet();
  return { sheets: [s], activeSheetId: s.id, names: [] };
}
