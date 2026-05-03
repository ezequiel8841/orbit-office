// @orbitoffice/doc — placeholder palette panel.
import { useMemo, useState } from "react";
import type { MappingOption, SmartDocPlaceholder } from "../core/smartDocs";
import { useT, type OrbitTKey } from "../core/i18n";

export interface PlaceholderPaletteProps {
  options: MappingOption[];
  detected?: SmartDocPlaceholder[];
  onInsert: (ph: SmartDocPlaceholder) => void;
  className?: string;
  style?: React.CSSProperties;
}

const GROUP_KEY: Record<string, OrbitTKey> = {
  lead: "sd.groupLead",
  custom_field: "sd.groupCustomField",
  organization: "sd.groupOrganization",
  owner: "sd.groupOwner",
  current_user: "sd.groupCurrentUser",
  system: "sd.groupSystem",
};

export function PlaceholderPalette({ options, detected, onInsert, className, style }: PlaceholderPaletteProps) {
  const t = useT();
  const [q, setQ] = useState("");
  const grouped = useMemo(() => {
    const filt = options.filter((o) => {
      if (!q) return true;
      const s = q.toLowerCase();
      return o.label.toLowerCase().includes(s) || o.key.toLowerCase().includes(s);
    });
    const map = new Map<string, MappingOption[]>();
    for (const o of filt) {
      const list = map.get(o.group) ?? [];
      list.push(o);
      map.set(o.group, list);
    }
    return [...map.entries()];
  }, [options, q]);

  return (
    <div
      className={`oo-doc-palette ${className ?? ""}`}
      style={{
        width: 260,
        borderLeft: "1px solid var(--oo-color-border)",
        background: "var(--oo-color-bg-alt, var(--oo-color-bg))",
        display: "flex",
        flexDirection: "column",
        ...style,
      }}
    >
      <div style={{ padding: 8, borderBottom: "1px solid var(--oo-color-border)" }}>
        <input
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder={t("ph.searchPlaceholder")}
          className="oo-btn"
          style={{ width: "100%" }}
        />
      </div>
      <div style={{ flex: 1, overflow: "auto", padding: 8 }}>
        {grouped.map(([group, items]) => (
          <div key={group} style={{ marginBottom: 12 }}>
            <div style={{ fontSize: 11, opacity: 0.7, marginBottom: 4, textTransform: "uppercase", letterSpacing: 0.4 }}>
              {t(GROUP_KEY[group]) ?? group}
            </div>
            {items.map((opt) => (
              <button
                key={`${opt.group}.${opt.mapping_key}.${opt.key}`}
                className="oo-btn"
                style={{ display: "block", width: "100%", textAlign: "left", marginBottom: 2 }}
                onClick={() =>
                  onInsert({
                    key: opt.key,
                    mapping_type: opt.mapping_type,
                    mapping_key: opt.mapping_key,
                  })
                }
                title={`${opt.mapping_type}.${opt.mapping_key}`}
              >
                {opt.label}
              </button>
            ))}
          </div>
        ))}
      </div>
      {detected && detected.length > 0 && (
        <div style={{ padding: 8, borderTop: "1px solid var(--oo-color-border)", maxHeight: 160, overflow: "auto" }}>
          <div style={{ fontSize: 11, opacity: 0.7, marginBottom: 4, textTransform: "uppercase", letterSpacing: 0.4 }}>
            Detectados ({detected.length})
          </div>
          {detected.map((ph) => (
            <div key={`${ph.mapping_type}.${ph.mapping_key}.${ph.key}`} style={{ fontSize: 12, padding: "2px 0" }}>
              <code>{`{{${ph.key}}}`}</code>{" "}
              <span style={{ opacity: 0.6 }}>→ {ph.mapping_type}.{ph.mapping_key}</span>
              {ph.occurrences && ph.occurrences > 1 ? <span style={{ opacity: 0.5 }}> ×{ph.occurrences}</span> : null}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
