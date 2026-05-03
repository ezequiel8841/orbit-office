import { useEffect, useMemo, useState } from "react";
import { useStore } from "../core/store";
import { createSheetController } from "./controller";
import { Toolbar } from "./Toolbar";
import { Grid } from "./Grid";
import { Tabs } from "./Tabs";
import { FindReplace } from "./FindReplace";
import { a1, colToLetters, normalizeRange } from "./address";
import { formatCell } from "./format";
import { localStorageAdapter, serializeWorkbook, deserializeWorkbook, type SerializedWorkbook } from "./persist";
import type { MappingOption, SmartDocPlaceholder } from "../core/smartDocs";
import { extractWorkbookPlaceholders } from "./placeholders";
import { useT } from "../core/i18n";

export interface SheetProps {
  className?: string;
  style?: React.CSSProperties;
  /** If set, workbook is auto-saved to localStorage under this key. Ignored when `value` is set. */
  persistKey?: string;
  /** Controlled workbook (serialized JSON form). When set, persistKey is ignored. */
  value?: SerializedWorkbook;
  onChange?: (workbook: SerializedWorkbook) => void;
  readOnly?: boolean;
  hideExport?: boolean;
  hideImport?: boolean;
  placeholderOptions?: MappingOption[];
  onPlaceholdersChange?: (list: SmartDocPlaceholder[]) => void;
}

export function Sheet({
  className, style, persistKey, value, onChange, readOnly,
  hideExport: _hideExport, hideImport: _hideImport,
  placeholderOptions, onPlaceholdersChange,
}: SheetProps) {
  void _hideExport; void _hideImport;
  const t = useT();
  const controlled = value !== undefined;
  const ctrl = useMemo(() => {
    if (controlled && value) {
      const wb = deserializeWorkbook(value);
      const c = createSheetController({});
      // Replace store workbook
      c.store.set((s) => ({ ...s, workbook: wb }));
      return c;
    }
    return createSheetController(persistKey ? { persist: localStorageAdapter(persistKey) } : {});
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [controlled ? "controlled" : persistKey]);
  const state = useStore(ctrl.store);
  const [find, setFind] = useState<null | "find" | "replace">(null);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "f") {
        e.preventDefault();
        setFind("find");
      } else if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "h") {
        e.preventDefault();
        setFind("replace");
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  const sh = ctrl.getActiveSheet();
  const sel = normalizeRange(state.selection);
  const activeAddr = `${colToLetters(state.active.col)}${state.active.row + 1}`;
  const activeCell = sh.cells.get(a1(state.active.row, state.active.col));
  const formulaText = activeCell?.f
    ? "=" + activeCell.f
    : activeCell?.v == null
    ? ""
    : String(activeCell.v);

  // Emit changes upward in controlled mode
  useEffect(() => {
    if (!controlled) return;
    onChange?.(serializeWorkbook(state.workbook));
    if (onPlaceholdersChange) onPlaceholdersChange(extractWorkbookPlaceholders(state.workbook));
  }, [controlled, state.workbook, onChange, onPlaceholdersChange]);

  function insertPlaceholder(key: string) {
    const token = `{{${key}}}`;
    const cur = sh.cells.get(a1(state.active.row, state.active.col));
    const next = (cur?.f ? "=" + cur.f : cur?.v == null ? "" : String(cur.v)) + token;
    ctrl.exec({ kind: "setCell", row: state.active.row, col: state.active.col, raw: next });
  }

  // Status: count + sum + avg of selection numerics (computed)
  const stats = useMemo(() => {
    let count = 0;
    let numCount = 0;
    let sum = 0;
    for (let r = sel.r1; r <= sel.r2; r++) {
      for (let c = sel.c1; c <= sel.c2; c++) {
        const v = ctrl.getValue(r, c);
        if (v !== null && v !== "") count++;
        if (typeof v === "number") {
          numCount++;
          sum += v;
        }
      }
    }
    return { count, numCount, sum, avg: numCount ? sum / numCount : 0 };
  }, [ctrl, state.workbook, sel.r1, sel.r2, sel.c1, sel.c2]);

  return (
    <div className={"oo-root oo-sheet " + (className ?? "")} style={{ position: "relative", pointerEvents: readOnly ? "none" : undefined, opacity: readOnly ? 0.85 : undefined, ...style }}>
      {find && <FindReplace ctrl={ctrl} initialMode={find} onClose={() => setFind(null)} />}
      <Toolbar ctrl={ctrl} />
      {placeholderOptions && placeholderOptions.length > 0 && (
        <div style={{ display: "flex", gap: 4, padding: "4px 8px", borderBottom: "1px solid var(--oo-color-border)" }}>
          <select
            className="oo-btn"
            defaultValue=""
            disabled={readOnly}
            title={t("common.placeholderInsertCell")}
            onChange={(e) => { if (e.target.value) { insertPlaceholder(e.target.value); e.currentTarget.value = ""; } }}
          >
            <option value="">{`{{ }}`} {t("common.placeholder")}…</option>
            {placeholderOptions.map((o) => (
              <option key={`${o.mapping_type}.${o.mapping_key}`} value={o.mapping_key.includes(".") ? o.mapping_key.split(".").pop()! : o.mapping_key}>
                {o.label}
              </option>
            ))}
          </select>
        </div>
      )}
      <div className="oo-formulabar">
        <input
          className="oo-namebox"
          value={activeAddr}
          readOnly
          aria-label={t("sheet.activeCell")}
        />
        <input
          className="oo-formulainput"
          value={state.editing?.draft ?? formulaText}
          onChange={(e) => {
            if (!state.editing)
              ctrl.beginEdit(state.active.row, state.active.col, e.target.value);
            else ctrl.updateDraft(e.target.value);
          }}
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              e.preventDefault();
              ctrl.commitEdit({ dr: 1, dc: 0 });
            } else if (e.key === "Escape") {
              ctrl.cancelEdit();
            }
          }}
          aria-label={t("sheet.formulaBar")}
        />
      </div>
      <Grid ctrl={ctrl} />
      <div className="oo-statusbar" role="status">
        <span>{t("sheet.statusSelection")}: {stats.count} {stats.count === 1 ? t("sheet.statusCell") : t("sheet.statusCells")}</span>
        {stats.numCount > 0 && (
          <>
            <span>{t("sheet.statusSum")}: {formatCell(stats.sum)}</span>
            <span>{t("sheet.statusAvg")}: {formatCell(stats.avg)}</span>
            <span>{t("sheet.statusCount")}: {stats.numCount}</span>
          </>
        )}
      </div>
      <Tabs ctrl={ctrl} />
    </div>
  );
}

export default Sheet;
