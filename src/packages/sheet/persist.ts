// Workbook serialization (JSON) + localStorage adapter. Zero deps.
import {
  type WorkbookData,
  type SheetData,
  type Cell,
  createSheet,
} from "./model";

interface SerializedCell {
  v?: import("./model").CellValue;
  f?: string;
  s?: import("./model").CellStyle;
}
interface SerializedSheet {
  id: string;
  name: string;
  numRows: number;
  numCols: number;
  cells: Record<string, SerializedCell>;
  cols: Record<string, number>;
  rows: Record<string, number>;
  filters: Record<string, string[]>;
  merges: import("./model").MergeRect[];
  freezeRows?: number;
  freezeCols?: number;
  validations?: import("./model").DataValidation[];
  charts?: import("./model").ChartSpec[];
  condFormats?: import("./model").CondFormat[];
}
export interface SerializedWorkbook {
  version: 1;
  activeSheetId: string;
  sheets: SerializedSheet[];
}

export function serializeWorkbook(wb: WorkbookData): SerializedWorkbook {
  return {
    version: 1,
    activeSheetId: wb.activeSheetId,
    sheets: wb.sheets.map((s) => {
      const cells: Record<string, SerializedCell> = {};
      s.cells.forEach((cell, k) => {
        const out: SerializedCell = {};
        if (cell.v !== undefined && cell.v !== null) out.v = cell.v;
        if (cell.f) out.f = cell.f;
        if (cell.s) out.s = cell.s;
        cells[k] = out;
      });
      const cols: Record<string, number> = {};
      s.cols.forEach((v, k) => (cols[k] = v.w));
      const rows: Record<string, number> = {};
      s.rows.forEach((v, k) => (rows[k] = v.h));
      const filters: Record<string, string[]> = {};
      s.filters.forEach((v, k) => (filters[k] = [...v]));
      return {
        id: s.id,
        name: s.name,
        numRows: s.numRows,
        numCols: s.numCols,
        cells,
        cols,
        rows,
        filters,
        merges: [...s.merges],
        freezeRows: s.freezeRows,
        freezeCols: s.freezeCols,
        validations: [...s.validations],
        charts: [...s.charts],
        condFormats: [...s.condFormats],
      };
    }),
  };
}

export function deserializeWorkbook(data: SerializedWorkbook): WorkbookData {
  const sheets: SheetData[] = data.sheets.map((s) => {
    const sheet = createSheet(s.name, s.numRows, s.numCols);
    sheet.id = s.id;
    for (const k in s.cells) {
      const c = s.cells[k];
      const cell: Cell = {};
      if (c.v !== undefined) cell.v = c.v;
      if (c.f) cell.f = c.f;
      if (c.s) cell.s = c.s;
      sheet.cells.set(k, cell);
    }
    for (const k in s.cols) sheet.cols.set(Number(k), { w: s.cols[k] });
    for (const k in s.rows) sheet.rows.set(Number(k), { h: s.rows[k] });
    for (const k in s.filters) sheet.filters.set(Number(k), new Set(s.filters[k]));
    sheet.merges = s.merges ?? [];
    sheet.freezeRows = s.freezeRows ?? 0;
    sheet.freezeCols = s.freezeCols ?? 0;
    sheet.validations = s.validations ?? [];
    sheet.charts = s.charts ?? [];
    sheet.condFormats = s.condFormats ?? [];
    return sheet;
  });
  return { sheets, activeSheetId: data.activeSheetId };
}

export function workbookToJson(wb: WorkbookData): string {
  return JSON.stringify(serializeWorkbook(wb));
}
export function workbookFromJson(json: string): WorkbookData | null {
  try {
    const data = JSON.parse(json) as SerializedWorkbook;
    if (!data || data.version !== 1) return null;
    return deserializeWorkbook(data);
  } catch {
    return null;
  }
}

export interface PersistAdapter {
  load(): WorkbookData | null;
  save(wb: WorkbookData): void;
}

export function localStorageAdapter(key: string): PersistAdapter {
  const safe = (fn: () => void) => {
    try { fn(); } catch { /* quota / private mode */ }
  };
  return {
    load() {
      try {
        const raw = localStorage.getItem(key);
        if (!raw) return null;
        return workbookFromJson(raw);
      } catch { return null; }
    },
    save(wb) {
      safe(() => localStorage.setItem(key, workbookToJson(wb)));
    },
  };
}
