import { useMemo, useState } from "react";
import type { SheetController } from "./controller";
import { uniqueColumnValues } from "./sortFilter";
import { colToLetters } from "./address";

export function FilterPopover({
  ctrl,
  col,
  onClose,
}: {
  ctrl: SheetController;
  col: number;
  onClose: () => void;
}) {
  const sheet = ctrl.getActiveSheet();
  const values = useMemo(() => uniqueColumnValues(sheet, col), [sheet, col]);
  const current = sheet.filters.get(col);
  const [checked, setChecked] = useState<Set<string>>(
    () => new Set(current ? [...current] : values),
  );
  const [search, setSearch] = useState("");

  const filtered = values.filter((v) =>
    v.toLowerCase().includes(search.toLowerCase()),
  );

  const allChecked = filtered.every((v) => checked.has(v));
  const toggle = (v: string) => {
    const next = new Set(checked);
    if (next.has(v)) next.delete(v);
    else next.add(v);
    setChecked(next);
  };

  const apply = () => {
    if (checked.size === values.length) ctrl.exec({ kind: "setFilter", col, allowed: null });
    else ctrl.exec({ kind: "setFilter", col, allowed: checked });
    onClose();
  };
  const clear = () => {
    ctrl.exec({ kind: "setFilter", col, allowed: null });
    onClose();
  };

  return (
    <>
      <div className="oo-popover-backdrop" onClick={onClose} />
      <div className="oo-popover" role="dialog" aria-label={`Filter column ${colToLetters(col)}`}>
        <div className="oo-popover-header">
          Filter — Column {colToLetters(col)}
        </div>
        <input
          className="oo-popover-search"
          placeholder="Search…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          autoFocus
        />
        <label className="oo-popover-row">
          <input
            type="checkbox"
            checked={allChecked}
            onChange={() => {
              const next = new Set(checked);
              if (allChecked) filtered.forEach((v) => next.delete(v));
              else filtered.forEach((v) => next.add(v));
              setChecked(next);
            }}
          />
          <strong>(Select all)</strong>
        </label>
        <div className="oo-popover-list">
          {filtered.map((v) => (
            <label key={v} className="oo-popover-row">
              <input
                type="checkbox"
                checked={checked.has(v)}
                onChange={() => toggle(v)}
              />
              <span>{v === "" ? "(Blanks)" : v}</span>
            </label>
          ))}
          {filtered.length === 0 && (
            <div className="oo-popover-empty">No values</div>
          )}
        </div>
        <div className="oo-popover-actions">
          <button className="oo-btn" onClick={clear}>Clear</button>
          <button className="oo-btn" onClick={onClose}>Cancel</button>
          <button className="oo-btn oo-btn-primary" onClick={apply}>Apply</button>
        </div>
      </div>
    </>
  );
}
