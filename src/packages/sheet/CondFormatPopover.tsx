// Conditional Formatting popover.
import { useState } from "react";
import type { SheetController } from "./controller";
import type { CondRule } from "./model";
import { normalizeRange } from "./address";

export function CondFormatPopover({
  ctrl,
  onClose,
}: {
  ctrl: SheetController;
  onClose: () => void;
}) {
  const sh = ctrl.getActiveSheet();
  const sel = normalizeRange(ctrl.store.get().selection);
  const [kind, setKind] = useState<CondRule["kind"]>("greater");
  const [num, setNum] = useState("0");
  const [num2, setNum2] = useState("100");
  const [text, setText] = useState("");
  const [bg, setBg] = useState("#fff7b3");
  const [color, setColor] = useState("#7a5d00");

  const apply = () => {
    let rule: CondRule;
    switch (kind) {
      case "greater": rule = { kind, value: parseFloat(num) || 0 }; break;
      case "less": rule = { kind, value: parseFloat(num) || 0 }; break;
      case "between": rule = { kind, min: parseFloat(num) || 0, max: parseFloat(num2) || 0 }; break;
      case "equal": rule = { kind, value: isNaN(Number(num)) ? num : Number(num) }; break;
      case "contains": rule = { kind, text }; break;
      case "duplicates": rule = { kind }; break;
      case "topN": rule = { kind, n: Math.max(1, parseInt(num, 10) || 3) }; break;
      case "colorScale":
        rule = { kind, min: "#f8696b", mid: "#ffeb84", max: "#63be7b" }; break;
    }
    ctrl.exec({
      kind: "addCondFormat",
      cf: {
        r1: sel.r1, c1: sel.c1, r2: sel.r2, c2: sel.c2,
        rule,
        style: kind === "colorScale" ? undefined : { bg, color },
      },
    });
    onClose();
  };

  return (
    <div
      role="dialog"
      style={{
        position: "absolute", top: 64, right: 8, zIndex: 60,
        background: "var(--oo-color-bg)", border: "1px solid var(--oo-color-border)",
        borderRadius: 6, padding: 10, width: 280, fontSize: 12,
        boxShadow: "0 6px 24px rgba(0,0,0,.15)",
        display: "flex", flexDirection: "column", gap: 8,
      }}
      onKeyDown={(e) => { if (e.key === "Escape") onClose(); }}
    >
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <strong>Conditional formatting</strong>
        <button className="oo-btn" onClick={onClose} aria-label="Close">×</button>
      </div>
      <label>Rule
        <select className="oo-select" style={{ width: "100%" }}
          value={kind} onChange={(e) => setKind(e.target.value as CondRule["kind"])}>
          <option value="greater">Greater than</option>
          <option value="less">Less than</option>
          <option value="between">Between</option>
          <option value="equal">Equal to</option>
          <option value="contains">Text contains</option>
          <option value="duplicates">Duplicate values</option>
          <option value="topN">Top N</option>
          <option value="colorScale">Color scale</option>
        </select>
      </label>
      {(kind === "greater" || kind === "less" || kind === "equal" || kind === "topN") && (
        <input className="oo-input" value={num} onChange={(e) => setNum(e.target.value)}
          placeholder={kind === "topN" ? "N (e.g. 3)" : "Value"} style={inp} />
      )}
      {kind === "between" && (
        <div style={{ display: "flex", gap: 6 }}>
          <input className="oo-input" value={num} onChange={(e) => setNum(e.target.value)} style={inp} placeholder="min" />
          <input className="oo-input" value={num2} onChange={(e) => setNum2(e.target.value)} style={inp} placeholder="max" />
        </div>
      )}
      {kind === "contains" && (
        <input className="oo-input" value={text} onChange={(e) => setText(e.target.value)}
          placeholder="contains…" style={inp} />
      )}
      {kind !== "colorScale" && (
        <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
          <label style={{ display: "flex", gap: 4, alignItems: "center" }}>
            BG <input type="color" value={bg} onChange={(e) => setBg(e.target.value)} />
          </label>
          <label style={{ display: "flex", gap: 4, alignItems: "center" }}>
            Text <input type="color" value={color} onChange={(e) => setColor(e.target.value)} />
          </label>
        </div>
      )}
      <div style={{ color: "var(--oo-color-fg-muted)", fontSize: 11 }}>
        Range: {sh.name}!{sel.r1 + 1}:{sel.r2 + 1}
      </div>
      <div style={{ display: "flex", gap: 6 }}>
        <button className="oo-btn" onClick={apply}>Apply</button>
        {sh.condFormats.length > 0 && (
          <button
            className="oo-btn"
            onClick={() => {
              for (let i = sh.condFormats.length - 1; i >= 0; i--) {
                ctrl.exec({ kind: "removeCondFormat", index: i });
              }
              onClose();
            }}
          >Clear all</button>
        )}
      </div>
      {sh.condFormats.length > 0 && (
        <div style={{ borderTop: "1px solid var(--oo-color-border)", paddingTop: 6, fontSize: 11 }}>
          <div style={{ color: "var(--oo-color-fg-muted)", marginBottom: 4 }}>Active rules:</div>
          {sh.condFormats.map((cf, i) => (
            <div key={i} style={{ display: "flex", justifyContent: "space-between", padding: "2px 0" }}>
              <span>{cf.rule.kind} @ R{cf.r1 + 1}:R{cf.r2 + 1}</span>
              <button className="oo-btn" style={{ padding: "0 6px" }}
                onClick={() => ctrl.exec({ kind: "removeCondFormat", index: i })}>×</button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

const inp: React.CSSProperties = {
  width: "100%", padding: "4px 6px",
  border: "1px solid var(--oo-color-border)", borderRadius: 4,
  background: "var(--oo-color-bg)", color: "var(--oo-color-fg)",
  fontSize: 12, outline: "none",
};
