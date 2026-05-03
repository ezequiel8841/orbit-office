// Find & Replace popover for the active sheet.
import { useEffect, useMemo, useRef, useState } from "react";
import type { SheetController } from "./controller";
import { a1, colToLetters } from "./address";
import type { Cell } from "./model";
import { useT } from "../core/i18n";

interface Match { row: number; col: number; }

interface Props {
  ctrl: SheetController;
  initialMode?: "find" | "replace";
  onClose: () => void;
}

export function FindReplace({ ctrl, initialMode = "find", onClose }: Props) {
  const t = useT();
  const [mode, setMode] = useState<"find" | "replace">(initialMode);
  const [needle, setNeedle] = useState("");
  const [replacement, setReplacement] = useState("");
  const [caseSensitive, setCs] = useState(false);
  const [wholeWord, setWw] = useState(false);
  const [useRegex, setRx] = useState(false);
  const [idx, setIdx] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => { inputRef.current?.focus(); }, []);

  const matcher = useMemo(() => {
    if (!needle) return null;
    try {
      if (useRegex) {
        return new RegExp(needle, caseSensitive ? "g" : "gi");
      }
      let pat = needle.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
      if (wholeWord) pat = `\\b${pat}\\b`;
      return new RegExp(pat, caseSensitive ? "g" : "gi");
    } catch {
      return null;
    }
  }, [needle, caseSensitive, wholeWord, useRegex]);

  const matches = useMemo<Match[]>(() => {
    if (!matcher) return [];
    const sh = ctrl.getActiveSheet();
    const out: Match[] = [];
    sh.cells.forEach((cell, key) => {
      const text = cellText(cell);
      if (text == null) return;
      matcher.lastIndex = 0;
      if (matcher.test(text)) {
        const m = /^([A-Z]+)(\d+)$/.exec(key);
        if (!m) return;
        const col = lettersToColLocal(m[1]);
        const row = parseInt(m[2], 10) - 1;
        out.push({ row, col });
      }
    });
    out.sort((a, b) => a.row - b.row || a.col - b.col);
    return out;
    // re-run when workbook bumps
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [matcher, ctrl.store.get().workbook]);

  useEffect(() => {
    if (idx >= matches.length) setIdx(0);
  }, [matches.length, idx]);

  const goto = (n: number) => {
    if (!matches.length) return;
    const i = ((n % matches.length) + matches.length) % matches.length;
    setIdx(i);
    const m = matches[i];
    ctrl.setSelection({ r1: m.row, c1: m.col, r2: m.row, c2: m.col }, m);
  };

  const replaceOne = () => {
    if (!matches.length || !matcher) return;
    const m = matches[idx];
    const sh = ctrl.getActiveSheet();
    const cell = sh.cells.get(a1(m.row, m.col));
    const text = cellText(cell) ?? "";
    matcher.lastIndex = 0;
    const next = text.replace(matcher, replacement);
    ctrl.exec({ kind: "setCell", row: m.row, col: m.col, raw: next });
    goto(idx);
  };

  const replaceAll = () => {
    if (!matches.length || !matcher) return;
    let n = 0;
    for (const m of matches) {
      const sh = ctrl.getActiveSheet();
      const cell = sh.cells.get(a1(m.row, m.col));
      const text = cellText(cell) ?? "";
      matcher.lastIndex = 0;
      const next = text.replace(matcher, replacement);
      if (next !== text) {
        ctrl.exec({ kind: "setCell", row: m.row, col: m.col, raw: next });
        n++;
      }
    }
    // toast-style log
    console.info(`Replaced ${n} occurrence${n === 1 ? "" : "s"}`);
  };

  return (
    <div
      role="dialog"
      aria-label="Find and replace"
      style={{
        position: "absolute", top: 8, right: 8, zIndex: 50,
        background: "var(--oo-color-bg)", color: "var(--oo-color-fg)",
        border: "1px solid var(--oo-color-border)", borderRadius: 6,
        padding: 8, boxShadow: "0 6px 24px rgba(0,0,0,.15)",
        display: "flex", flexDirection: "column", gap: 6, width: 320,
        font: "inherit", fontSize: 12,
      }}
      onKeyDown={(e) => {
        if (e.key === "Escape") { e.stopPropagation(); onClose(); }
        else if (e.key === "Enter") { e.preventDefault(); goto(idx + (e.shiftKey ? -1 : 1)); }
      }}
    >
      <div style={{ display: "flex", gap: 4 }}>
        <button className="oo-btn" aria-pressed={mode === "find"} onClick={() => setMode("find")}>{t("common.find")}</button>
        <button className="oo-btn" aria-pressed={mode === "replace"} onClick={() => setMode("replace")}>{t("common.replace")}</button>
        <span style={{ marginLeft: "auto", color: "var(--oo-color-fg-muted)", fontSize: 11 }}>
          {matches.length ? `${idx + 1} / ${matches.length}` : t("ph.empty")}
        </span>
        <button className="oo-btn" onClick={onClose} aria-label="Close">×</button>
      </div>
      <input
        ref={inputRef}
        className="oo-input"
        placeholder={t("common.find")}
        value={needle}
        onChange={(e) => setNeedle(e.target.value)}
        style={inputStyle}
      />
      {mode === "replace" && (
        <input
          className="oo-input"
          placeholder={t("common.replaceWith")}
          value={replacement}
          onChange={(e) => setReplacement(e.target.value)}
          style={inputStyle}
        />
      )}
      <div style={{ display: "flex", gap: 8, fontSize: 11, alignItems: "center" }}>
        <label><input type="checkbox" checked={caseSensitive} onChange={(e) => setCs(e.target.checked)} /> Aa</label>
        <label><input type="checkbox" checked={wholeWord} onChange={(e) => setWw(e.target.checked)} /> Word</label>
        <label><input type="checkbox" checked={useRegex} onChange={(e) => setRx(e.target.checked)} /> .*</label>
        <span style={{ marginLeft: "auto", display: "flex", gap: 4 }}>
          <button className="oo-btn" onClick={() => goto(idx - 1)}>‹</button>
          <button className="oo-btn" onClick={() => goto(idx + 1)}>›</button>
        </span>
      </div>
      {mode === "replace" && (
        <div style={{ display: "flex", gap: 4 }}>
          <button className="oo-btn" onClick={replaceOne}>{t("common.replace")}</button>
          <button className="oo-btn" onClick={replaceAll}>{t("common.replaceAll")}</button>
        </div>
      )}
      {matches[idx] && (
        <div style={{ fontSize: 11, color: "var(--oo-color-fg-muted)" }}>
          @ {colToLetters(matches[idx].col)}{matches[idx].row + 1}
        </div>
      )}
    </div>
  );
}

const inputStyle: React.CSSProperties = {
  width: "100%", padding: "4px 6px",
  border: "1px solid var(--oo-color-border)", borderRadius: 4,
  background: "var(--oo-color-bg)", color: "var(--oo-color-fg)",
  font: "inherit", fontSize: 12, outline: "none",
};

function cellText(cell: Cell | undefined): string | null {
  if (!cell) return null;
  if (cell.f) return "=" + cell.f;
  if (cell.v == null) return null;
  return String(cell.v);
}
function lettersToColLocal(s: string): number {
  let n = 0;
  for (let i = 0; i < s.length; i++) n = n * 26 + (s.charCodeAt(i) - 64);
  return n - 1;
}
