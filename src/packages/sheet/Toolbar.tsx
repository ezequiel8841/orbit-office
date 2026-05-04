import { useStore } from "../core/store";
import type { SheetController } from "./controller";
import type { CellStyle, NumFormat } from "./model";
import { a1 } from "./address";
import {
  IconBold,
  IconItalic,
  IconUnderline,
  IconAlignLeft,
  IconAlignCenter,
  IconAlignRight,
  IconUndo,
  IconRedo,
  IconDownload,
  IconUpload,
  IconSortAsc,
  IconSortDesc,
  IconFilter,
  IconMerge,
  IconUnmerge,
  IconBorderAll,
  IconBorderOutside,
  IconBorderClear,
  IconFreeze,
  IconChart,
  IconCheck,
  IconWrapText,
} from "../icons";
import { writeDelimited, parseDelimited } from "./csv";
import { importXlsx, exportXlsx } from "./xlsxIO";
import React, { useState } from "react";
import { FilterPopover } from "./FilterPopover";
import { ValidationPopover } from "./ValidationPopover";
import { CondFormatPopover } from "./CondFormatPopover";
import { normalizeRange } from "./address";
import { useT } from "../core/i18n";

function ToolGrp({ label, children, end }: { label: string; children: React.ReactNode; end?: boolean }) {
  return (
    <div style={{
      display: "flex", flexDirection: "column", flexShrink: 0,
      borderRight: end ? "none" : "1px solid var(--oo-color-border)",
    }}>
      <div style={{
        display: "flex", flex: 1, flexWrap: "wrap", gap: 2,
        padding: "5px 7px 3px", alignItems: "center",
      }}>
        {children}
      </div>
      <div style={{
        fontSize: 10, color: "var(--oo-color-fg-muted, #888)",
        textAlign: "center", padding: "1px 6px 3px",
        borderTop: "1px solid var(--oo-color-border)",
        userSelect: "none", whiteSpace: "nowrap",
      }}>
        {label}
      </div>
    </div>
  );
}

export function Toolbar({ ctrl }: { ctrl: SheetController }) {
  const state = useStore(ctrl.store);
  const t = useT();
  const sh = ctrl.getActiveSheet();
  const cur = sh.cells.get(a1(state.active.row, state.active.col))?.s ?? {};
  const [filterOpen, setFilterOpen] = useState(false);
  const [dvOpen, setDvOpen] = useState(false);
  const [cfOpen, setCfOpen] = useState(false);

  const toggle = (style: Partial<CellStyle>) =>
    ctrl.exec({ kind: "applyStyle", range: state.selection, style });

  const setFormat = (format: NumFormat) =>
    ctrl.exec({ kind: "applyStyle", range: state.selection, style: { format } });

  function exportCsv() {
    const rows: string[][] = [];
    for (let r = 0; r < sh.numRows; r++) {
      const row: string[] = [];
      let any = false;
      for (let c = 0; c < sh.numCols; c++) {
        const cell = sh.cells.get(a1(r, c));
        const v = cell?.f ? "=" + cell.f : cell?.v == null ? "" : String(cell.v);
        if (v !== "") any = true;
        row.push(v);
      }
      if (any) {
        while (rows.length < r) rows.push([]);
        rows.push(row);
      }
    }
    const csv = writeDelimited(rows);
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = (sh.name || "sheet") + ".csv";
    a.click();
    URL.revokeObjectURL(url);
  }

  function importCsv() {
    const input = document.createElement("input");
    input.type = "file";
    input.accept = ".csv,text/csv,text/plain";
    input.onchange = async () => {
      const file = input.files?.[0];
      if (!file) return;
      const text = await file.text();
      const rows = parseDelimited(text);
      if (!rows.length) return;
      const range = {
        r1: 0,
        c1: 0,
        r2: rows.length - 1,
        c2: Math.max(0, ...rows.map((r) => r.length)) - 1,
      };
      ctrl.exec({ kind: "setRange", range, values: rows });
      ctrl.setSelection(range, { row: 0, col: 0 });
    };
    input.click();
  }

  return (
    <div
      className="oo-toolbar"
      role="toolbar"
      aria-label="Spreadsheet toolbar"
      style={{
        display: "flex",
        flexWrap: "nowrap",
        gap: 0,
        borderBottom: "1px solid var(--oo-color-border)",
        background: "var(--oo-color-bg-alt, var(--oo-color-bg))",
        alignItems: "stretch",
        overflowX: "auto",
      }}
    >
      {/* ── Histórico ── */}
      <ToolGrp label={t("grp.history")}>
        <button
          className="oo-btn"
          aria-label="Undo"
          onClick={() => {
            ctrl.history.undo();
            ctrl.store.set((s) => ({ ...s }));
          }}
          disabled={!ctrl.history.canUndo()}
        >
          <IconUndo />{t("lbl.undo")}
        </button>
        <button
          className="oo-btn"
          aria-label="Redo"
          onClick={() => {
            ctrl.history.redo();
            ctrl.store.set((s) => ({ ...s }));
          }}
          disabled={!ctrl.history.canRedo()}
        >
          <IconRedo />{t("lbl.redo")}
        </button>
      </ToolGrp>

      {/* ── Fonte ── */}
      <ToolGrp label={t("grp.font")}>
        <select
          className="oo-select"
          aria-label="Font family"
          style={{ minWidth: 100 }}
          value={cur.fontFamily ?? ""}
          onChange={(e) => toggle({ fontFamily: e.target.value || undefined })}
        >
          <option value="">Default</option>
          <option value="Arial">Arial</option>
          <option value="Arial Black">Arial Black</option>
          <option value="Calibri">Calibri</option>
          <option value="Courier New">Courier New</option>
          <option value="Georgia">Georgia</option>
          <option value="Impact">Impact</option>
          <option value="Times New Roman">Times New Roman</option>
          <option value="Trebuchet MS">Trebuchet MS</option>
          <option value="Verdana">Verdana</option>
        </select>
        <input
          className="oo-input"
          type="number"
          aria-label="Font size"
          style={{ width: 48 }}
          min={8}
          max={72}
          placeholder="13"
          value={cur.fontSize ?? ""}
          onChange={(e) => {
            const v = parseInt(e.target.value, 10);
            if (!isNaN(v) && v >= 8 && v <= 72) toggle({ fontSize: v });
            else if (e.target.value === "") toggle({ fontSize: undefined });
          }}
        />
        <button
          className="oo-btn"
          aria-label="Wrap text"
          aria-pressed={!!cur.wrapText}
          title="Wrap text"
          onClick={() => toggle({ wrapText: !cur.wrapText })}
        >
          <IconWrapText />{t("lbl.wrapText")}
        </button>
      </ToolGrp>

      {/* ── Estilo ── */}
      <ToolGrp label={t("grp.style")}>
        <button
          className="oo-btn"
          aria-label="Bold"
          aria-pressed={!!cur.bold}
          onClick={() => toggle({ bold: !cur.bold })}
        >
          <IconBold />
        </button>
        <button
          className="oo-btn"
          aria-label="Italic"
          aria-pressed={!!cur.italic}
          onClick={() => toggle({ italic: !cur.italic })}
        >
          <IconItalic />
        </button>
        <button
          className="oo-btn"
          aria-label="Underline"
          aria-pressed={!!cur.underline}
          onClick={() => toggle({ underline: !cur.underline })}
        >
          <IconUnderline />
        </button>
      </ToolGrp>

      {/* ── Alinhamento ── */}
      <ToolGrp label={t("grp.alignment")}>
        <button
          className="oo-btn"
          aria-label="Align left"
          aria-pressed={cur.align === "left"}
          onClick={() => toggle({ align: "left" })}
        >
          <IconAlignLeft />
        </button>
        <button
          className="oo-btn"
          aria-label="Align center"
          aria-pressed={cur.align === "center"}
          onClick={() => toggle({ align: "center" })}
        >
          <IconAlignCenter />
        </button>
        <button
          className="oo-btn"
          aria-label="Align right"
          aria-pressed={cur.align === "right"}
          onClick={() => toggle({ align: "right" })}
        >
          <IconAlignRight />
        </button>
      </ToolGrp>

      {/* ── Formato ── */}
      <ToolGrp label={t("grp.format")}>
        <select
          className="oo-select"
          aria-label="Number format"
          value={cur.format ?? "general"}
          onChange={(e) => setFormat(e.target.value as NumFormat)}
        >
          <option value="general">{t("sheet.formatGeneral")}</option>
          <option value="number">{t("sheet.formatNumber")}</option>
          <option value="integer">{t("sheet.formatInteger")}</option>
          <option value="percent">{t("sheet.formatPercent")}</option>
          <option value="currency">{t("sheet.formatCurrency")}</option>
          <option value="date">{t("sheet.formatDate")}</option>
        </select>
      </ToolGrp>

      {/* ── Dados ── */}
      <ToolGrp label={t("grp.data")}>
        <button
          className="oo-btn"
          aria-label="Sort ascending"
          title={t("sheet.sortAsc")}
          onClick={() => {
            const sel = normalizeRange(state.selection);
            const range =
              sel.r1 === sel.r2 && sel.c1 === sel.c2
                ? { r1: 0, c1: 0, r2: sh.numRows - 1, c2: sh.numCols - 1 }
                : sel;
            ctrl.exec({ kind: "sort", range, keys: [{ col: sel.c1, desc: false }] });
          }}
        >
          <IconSortAsc />A→Z
        </button>
        <button
          className="oo-btn"
          aria-label="Sort descending"
          title={t("sheet.sortDesc")}
          onClick={() => {
            const sel = normalizeRange(state.selection);
            const range =
              sel.r1 === sel.r2 && sel.c1 === sel.c2
                ? { r1: 0, c1: 0, r2: sh.numRows - 1, c2: sh.numCols - 1 }
                : sel;
            ctrl.exec({ kind: "sort", range, keys: [{ col: sel.c1, desc: true }] });
          }}
        >
          <IconSortDesc />Z→A
        </button>
        <button
          className="oo-btn"
          aria-label="Filter column"
          aria-pressed={filterOpen}
          title={t("sheet.filter")}
          onClick={() => setFilterOpen((v) => !v)}
        >
          <IconFilter />{t("lbl.filter")}
        </button>
      </ToolGrp>

      {/* ── Células ── */}
      <ToolGrp label={t("grp.cells")}>
        <button
          className="oo-btn"
          aria-label="Merge cells"
          title={t("sheet.merge")}
          onClick={() => ctrl.exec({ kind: "merge", range: state.selection })}
        >
          <IconMerge />{t("lbl.merge")}
        </button>
        <button
          className="oo-btn"
          aria-label="Unmerge cells"
          title={t("sheet.unmerge")}
          onClick={() => ctrl.exec({ kind: "unmerge", range: state.selection })}
        >
          <IconUnmerge />{t("lbl.unmerge")}
        </button>
        <button
          className="oo-btn"
          aria-label="All borders"
          title={t("sheet.bordersAll")}
          onClick={() =>
            ctrl.exec({
              kind: "applyBorders",
              range: state.selection,
              borders: {},
              mode: "all",
            })
          }
        >
          <IconBorderAll />{t("lbl.allBorders")}
        </button>
        <button
          className="oo-btn"
          aria-label="Outside borders"
          title={t("sheet.bordersOutside")}
          onClick={() =>
            ctrl.exec({
              kind: "applyBorders",
              range: state.selection,
              borders: {},
              mode: "outside",
            })
          }
        >
          <IconBorderOutside />{t("lbl.outerBorder")}
        </button>
        <button
          className="oo-btn"
          aria-label="Clear borders"
          title={t("sheet.bordersNone")}
          onClick={() =>
            ctrl.exec({
              kind: "applyBorders",
              range: state.selection,
              borders: {},
              mode: "clear",
            })
          }
        >
          <IconBorderClear />{t("lbl.noBorder")}
        </button>
      </ToolGrp>

      {/* ── Ferramentas ── */}
      <ToolGrp label={t("grp.tools")}>
        <button
          className="oo-btn"
          aria-label="Freeze rows/cols"
          aria-pressed={sh.freezeRows > 0 || sh.freezeCols > 0}
          title={t("sheet.freeze")}
          onClick={() => {
            if (sh.freezeRows > 0 || sh.freezeCols > 0) {
              ctrl.exec({ kind: "setFreeze", rows: 0, cols: 0 });
            } else {
              ctrl.exec({
                kind: "setFreeze",
                rows: state.active.row,
                cols: state.active.col,
              });
            }
          }}
        >
          <IconFreeze />{t("lbl.freeze")}
        </button>
        <button
          className="oo-btn"
          aria-label="Data validation"
          aria-pressed={dvOpen}
          title={t("sheet.validation")}
          onClick={() => setDvOpen((v) => !v)}
        >
          <IconCheck />{t("lbl.validate")}
        </button>
        <button
          className="oo-btn"
          aria-label="Conditional formatting"
          aria-pressed={cfOpen}
          title={t("sheet.condFormat")}
          onClick={() => setCfOpen((v) => !v)}
          style={{ display: "inline-flex", alignItems: "center", gap: 4 }}
        >
          <IconBorderAll />{t("lbl.condFormat")}
        </button>
        <button
          className="oo-btn"
          aria-label="Insert chart"
          title={t("sheet.chart")}
          onClick={() => {
            const sel = normalizeRange(state.selection);
            if (sel.r1 === sel.r2 && sel.c1 === sel.c2) return;
            ctrl.exec({
              kind: "addChart",
              chart: {
                id: "ch_" + Math.random().toString(36).slice(2, 9),
                kind: "column",
                range: { r1: sel.r1, c1: sel.c1, r2: sel.r2, c2: sel.c2 },
                hasHeader: true,
                x: 200,
                y: 60,
                w: 360,
                h: 220,
                title: "Chart",
              },
            });
          }}
        >
          <IconChart />{t("lbl.chart")}
        </button>
      </ToolGrp>

      {/* ── Arquivo ── */}
      <ToolGrp label={t("grp.export")} end>
        <button className="oo-btn" aria-label="Import CSV" onClick={importCsv}>
          <IconUpload />
          <span style={{ marginLeft: 6 }}>{t("common.import")}</span>
        </button>
        <button className="oo-btn" aria-label="Export CSV" onClick={exportCsv}>
          <IconDownload />
          <span style={{ marginLeft: 6 }}>{t("common.export")}</span>
        </button>
        <button
          className="oo-btn"
          aria-label="Open .xlsx"
          title="Open Excel file (.xlsx)"
          onClick={() => {
            const input = document.createElement("input");
            input.type = "file";
            input.accept = ".xlsx,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet";
            input.onchange = async () => {
              const file = input.files?.[0];
              if (!file) return;
              try {
                const wb = await importXlsx(file);
                ctrl.loadWorkbook(wb);
              } catch (e) {
                console.error("XLSX import failed", e);
              }
            };
            input.click();
          }}
        >
          <IconUpload />
          <span style={{ marginLeft: 6 }}>xlsx</span>
        </button>
        <button
          className="oo-btn"
          aria-label="Save .xlsx"
          title="Save as Excel file (.xlsx)"
          onClick={() => {
            const filename = (sh.name || "workbook") + ".xlsx";
            exportXlsx(ctrl.store.get().workbook, filename).catch((e) =>
              console.error("XLSX export failed", e),
            );
          }}
        >
          <IconDownload />
          <span style={{ marginLeft: 6 }}>xlsx</span>
        </button>
      </ToolGrp>

      {filterOpen && (
        <FilterPopover
          ctrl={ctrl}
          col={state.active.col}
          onClose={() => setFilterOpen(false)}
        />
      )}
      {dvOpen && (
        <ValidationPopover ctrl={ctrl} onClose={() => setDvOpen(false)} />
      )}
      {cfOpen && (
        <CondFormatPopover ctrl={ctrl} onClose={() => setCfOpen(false)} />
      )}
    </div>
  );
}
