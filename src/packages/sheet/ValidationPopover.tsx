// Picker para Data Validation: List, Number, Text.
import { useState } from "react";
import type { SheetController } from "./controller";
import type { DataValidation } from "./model";
import { normalizeRange } from "./address";

export function ValidationPopover({
  ctrl,
  onClose,
}: {
  ctrl: SheetController;
  onClose: () => void;
}) {
  const sel = normalizeRange(ctrl.store.get().selection);
  const [kind, setKind] = useState<"list" | "number" | "text">("list");
  const [values, setValues] = useState("Yes,No,Maybe");
  const [min, setMin] = useState("");
  const [max, setMax] = useState("");
  const [strict, setStrict] = useState(true);

  const apply = () => {
    let rule: DataValidation["rule"];
    if (kind === "list") {
      rule = { kind: "list", values: values.split(",").map((v) => v.trim()).filter(Boolean) };
    } else if (kind === "number") {
      rule = {
        kind: "number",
        min: min === "" ? undefined : Number(min),
        max: max === "" ? undefined : Number(max),
      };
    } else {
      rule = {
        kind: "text",
        minLen: min === "" ? undefined : Number(min),
        maxLen: max === "" ? undefined : Number(max),
      };
    }
    ctrl.exec({
      kind: "addValidation",
      v: { ...sel, rule, strict },
    });
    onClose();
  };

  return (
    <>
      <div className="oo-popover-backdrop" onClick={onClose} />
      <div className="oo-popover" role="dialog" aria-label="Data validation">
        <div className="oo-popover-header">Data validation</div>
        <label style={{ fontSize: 12, display: "flex", flexDirection: "column", gap: 4 }}>
          Type
          <select
            className="oo-select"
            value={kind}
            onChange={(e) => setKind(e.target.value as typeof kind)}
          >
            <option value="list">List</option>
            <option value="number">Number range</option>
            <option value="text">Text length</option>
          </select>
        </label>
        {kind === "list" && (
          <label style={{ fontSize: 12, display: "flex", flexDirection: "column", gap: 4, marginTop: 8 }}>
            Values (comma-separated)
            <input
              className="oo-popover-search"
              value={values}
              onChange={(e) => setValues(e.target.value)}
            />
          </label>
        )}
        {kind !== "list" && (
          <div style={{ display: "flex", gap: 6, marginTop: 8 }}>
            <label style={{ fontSize: 12, flex: 1, display: "flex", flexDirection: "column", gap: 4 }}>
              Min
              <input className="oo-popover-search" value={min} onChange={(e) => setMin(e.target.value)} />
            </label>
            <label style={{ fontSize: 12, flex: 1, display: "flex", flexDirection: "column", gap: 4 }}>
              Max
              <input className="oo-popover-search" value={max} onChange={(e) => setMax(e.target.value)} />
            </label>
          </div>
        )}
        <label style={{ fontSize: 12, display: "flex", alignItems: "center", gap: 6, marginTop: 8 }}>
          <input type="checkbox" checked={strict} onChange={(e) => setStrict(e.target.checked)} />
          Reject invalid input
        </label>
        <div className="oo-popover-actions">
          <button className="oo-btn" onClick={onClose}>Cancel</button>
          <button className="oo-btn oo-btn-primary" onClick={apply}>Apply</button>
        </div>
      </div>
    </>
  );
}
