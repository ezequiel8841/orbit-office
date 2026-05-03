import { useState } from "react";
import { useStore } from "../core/store";
import type { SheetController } from "./controller";

export function Tabs({ ctrl }: { ctrl: SheetController }) {
  const state = useStore(ctrl.store);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [draft, setDraft] = useState("");

  const startRename = (id: string, name: string) => {
    setEditingId(id);
    setDraft(name);
  };
  const commit = () => {
    if (editingId && draft.trim()) ctrl.renameSheet(editingId, draft.trim());
    setEditingId(null);
  };

  return (
    <div className="oo-tabs" role="tablist" aria-label="Sheet tabs">
      {state.workbook.sheets.map((s) => {
        const active = s.id === state.workbook.activeSheetId;
        return (
          <div
            key={s.id}
            className={"oo-tab" + (active ? " is-active" : "")}
            role="tab"
            aria-selected={active}
            onClick={() => !active && ctrl.setActiveSheet(s.id)}
            onDoubleClick={() => startRename(s.id, s.name)}
          >
            {editingId === s.id ? (
              <input
                autoFocus
                className="oo-tab-input"
                value={draft}
                onChange={(e) => setDraft(e.target.value)}
                onBlur={commit}
                onKeyDown={(e) => {
                  if (e.key === "Enter") commit();
                  else if (e.key === "Escape") setEditingId(null);
                }}
              />
            ) : (
              <span className="oo-tab-name">{s.name}</span>
            )}
            {state.workbook.sheets.length > 1 && active && (
              <button
                className="oo-tab-close"
                aria-label={`Delete ${s.name}`}
                onClick={(e) => {
                  e.stopPropagation();
                  if (confirm(`Delete sheet "${s.name}"?`)) ctrl.removeSheet(s.id);
                }}
              >
                ×
              </button>
            )}
          </div>
        );
      })}
      <button
        className="oo-tab-add"
        aria-label="Add sheet"
        onClick={() => ctrl.addSheet()}
      >
        +
      </button>
    </div>
  );
}
