// @orbitoffice/adapters/smartDocs — drop-in editor for CRM Smart Docs.
// Maps the CRM template editor surface (DOCX visual / PPTX cockpit /
// XLSX cockpit) onto the OrbitOffice components without leaking storage
// concerns or external network calls.

import { useEffect, useMemo, useState } from "react";
import { OrbitOffice } from "../hub";
import { LicenseGate } from "../useLicense";
import {
  buildMappingOptions,
  suggestMapping,
  type MappingOption,
  type SmartDocPlaceholder,
} from "../core/smartDocs";
import type { Deck } from "../slides/model";
import type { SerializedWorkbook } from "../sheet/persist";
import { useT, type OrbitTKey } from "../core/i18n";

const GROUP_KEY: Record<string, OrbitTKey> = {
  lead: "sd.groupLead",
  custom_field: "sd.groupCustomField",
  organization: "sd.groupOrganization",
  owner: "sd.groupOwner",
  current_user: "sd.groupCurrentUser",
  system: "sd.groupSystem",
};

export type SmartDocType = "docx" | "pptx" | "xlsx";
export type SmartDocEditorMode = "visual" | "placeholder";

export interface SmartDocsEditorChange {
  /** DOCX visual: HTML with `{{key}}` literals (chips collapsed). */
  html?: string;
  /** PPTX visual: deck (JSON). */
  deck?: Deck;
  /** XLSX visual: workbook (serialized JSON). */
  workbook?: SerializedWorkbook;
  /** Detected placeholders (auto-mapped). */
  placeholders: SmartDocPlaceholder[];
}

export interface SmartDocsEditorProps {
  docType: SmartDocType;
  /** License key required to unlock the editor. */
  licenseKey: string;
  editorMode?: SmartDocEditorMode;
  /** Initial HTML (DOCX visual). */
  initialHtml?: string | null;
  /** Initial deck (PPTX visual). */
  initialDeck?: Deck | null;
  /** Initial workbook (XLSX visual). */
  initialWorkbook?: SerializedWorkbook | null;
  /** Vocabulary: pass `customFields` from your CRM hook (`useCRMCustomFields`). */
  customFields?: { field_key: string; label?: string; is_active?: boolean }[];
  /** Server-detected placeholders to seed the mapping panel. */
  detected?: SmartDocPlaceholder[];
  readOnly?: boolean;
  onChange?: (change: SmartDocsEditorChange) => void;
  /** Mapping persistence: emits whenever the user re-maps a placeholder. */
  onMappingChange?: (mapping: SmartDocPlaceholder[]) => void;
  className?: string;
  style?: React.CSSProperties;
}


export function SmartDocsEditor({
  docType,
  licenseKey,
  editorMode,
  initialHtml,
  initialDeck,
  initialWorkbook,
  customFields,
  detected,
  readOnly,
  onChange,
  onMappingChange,
  className,
  style,
}: SmartDocsEditorProps) {
  const t = useT();
  const options = useMemo(() => buildMappingOptions({ customFields }), [customFields]);
  const mode: SmartDocEditorMode = editorMode ?? "visual";

  const [html, setHtml] = useState<string>(initialHtml ?? "");
  const [deck, setDeck] = useState<Deck | undefined>(initialDeck ?? undefined);
  const [workbook, setWorkbook] = useState<SerializedWorkbook | undefined>(initialWorkbook ?? undefined);
  const [placeholders, setPlaceholders] = useState<SmartDocPlaceholder[]>(detected ?? []);

  // Re-seed when host pushes a new value
  useEffect(() => { if (initialHtml != null) setHtml(initialHtml); }, [initialHtml]);
  useEffect(() => { if (initialDeck) setDeck(initialDeck); }, [initialDeck]);
  useEffect(() => { if (initialWorkbook) setWorkbook(initialWorkbook); }, [initialWorkbook]);
  useEffect(() => { if (detected) setPlaceholders(seedAutoMap(detected, options)); }, [detected, options]);

  function emit(patch: Partial<SmartDocsEditorChange>) {
    onChange?.({ html, deck, workbook, placeholders, ...patch });
  }

  if (docType === "docx" && mode === "visual") {
    return (
      <div className={className} style={{ height: "100%", display: "flex", flexDirection: "column", ...style }}>
        <OrbitOffice
          licenseKey={licenseKey}
          mode="doc"
          value={html}
          onChange={(next) => { setHtml(next); emit({ html: next }); }}
          placeholderOptions={options}
          detectedPlaceholders={placeholders}
          onPlaceholdersChange={(list) => { setPlaceholders(list); emit({ placeholders: list }); }}
          readOnly={readOnly}
          hideExport
          hideImport
        />
      </div>
    );
  }

  if (docType === "pptx" && mode === "visual" && deck) {
    return (
      <div className={className} style={{ height: "100%", display: "flex", flexDirection: "column", ...style }}>
        <OrbitOffice
          licenseKey={licenseKey}
          mode="slides"
          value={deck}
          onChange={(next: Deck) => { setDeck(next); emit({ deck: next }); }}
          placeholderOptions={options}
          onPlaceholdersChange={(list) => { setPlaceholders(list); emit({ placeholders: list }); }}
          readOnly={readOnly}
          hideExport
          hideImport
        />
      </div>
    );
  }

  if (docType === "xlsx" && mode === "visual" && workbook) {
    return (
      <div className={className} style={{ height: "100%", display: "flex", flexDirection: "column", ...style }}>
        <OrbitOffice
          licenseKey={licenseKey}
          mode="sheet"
          value={workbook}
          onChange={(next: SerializedWorkbook) => { setWorkbook(next); emit({ workbook: next }); }}
          placeholderOptions={options}
          onPlaceholdersChange={(list) => { setPlaceholders(list); emit({ placeholders: list }); }}
          readOnly={readOnly}
          hideExport
          hideImport
        />
      </div>
    );
  }

  // Placeholder cockpit: read-only viewer + mapping panel
  return (
    <LicenseGate licenseKey={licenseKey}>
    <div className={className} style={{ height: "100%", display: "flex", ...style }}>
      <div style={{ flex: 1, overflow: "auto", padding: 16, background: "var(--oo-color-bg)" }}>
        <h3 style={{ marginTop: 0 }}>{t("sd.modelTitle")} {docType.toUpperCase()}</h3>
        <p style={{ opacity: 0.7 }}>{t("sd.editInOrigin")}</p>
        <ul>
          {placeholders.map((ph) => (
            <li key={`${ph.mapping_type}.${ph.mapping_key}.${ph.key}`}>
              <code>{`{{${ph.key}}}`}</code>
              {ph.occurrences && ph.occurrences > 1 ? <span style={{ opacity: 0.6 }}> ×{ph.occurrences}</span> : null}
              {ph.slide_indices?.length ? <span style={{ opacity: 0.6 }}> (slides {ph.slide_indices.join(", ")})</span> : null}
            </li>
          ))}
        </ul>
      </div>
      <MappingPanel
        placeholders={placeholders}
        options={options}
        onChange={(next) => { setPlaceholders(next); onMappingChange?.(next); emit({ placeholders: next }); }}
      />
    </div>
    </LicenseGate>
  );
}

// ---------------------------------------------------------------------------
function seedAutoMap(list: SmartDocPlaceholder[], options: MappingOption[]): SmartDocPlaceholder[] {
  return list.map((ph) => {
    if (ph.mapping_type !== "custom_field" || ph.mapping_key === ph.key) {
      const guess = suggestMapping(ph.key, options);
      if (guess) return { ...ph, mapping_type: guess.mapping_type, mapping_key: guess.mapping_key };
    }
    return ph;
  });
}

interface MappingPanelProps {
  placeholders: SmartDocPlaceholder[];
  options: MappingOption[];
  onChange: (next: SmartDocPlaceholder[]) => void;
}

function MappingPanel({ placeholders, options, onChange }: MappingPanelProps) {
  const t = useT();
  return (
    <div
      style={{
        width: 320,
        borderLeft: "1px solid var(--oo-color-border)",
        background: "var(--oo-color-bg-alt, var(--oo-color-bg))",
        padding: 12,
        overflow: "auto",
      }}
    >
      <h4 style={{ marginTop: 0 }}>{t("sd.mapping")}</h4>
      {placeholders.length === 0 && <p style={{ opacity: 0.6 }}>{t("ph.empty")}</p>}
      {placeholders.map((ph, idx) => (
        <div key={`${ph.key}-${idx}`} style={{ marginBottom: 12 }}>
          <div style={{ fontFamily: "var(--oo-font-mono)", fontSize: 12 }}>{`{{${ph.key}}}`}</div>
          <select
            style={{ width: "100%", height: 28, border: "1px solid var(--oo-color-border)", borderRadius: "var(--oo-radius-sm)", background: "var(--oo-color-bg)", color: "var(--oo-color-fg)", padding: "0 6px", font: "inherit" }}
            value={`${ph.mapping_type}.${ph.mapping_key}`}
            onChange={(e) => {
              const [type, ...rest] = e.target.value.split(".");
              const next = placeholders.slice();
              next[idx] = { ...ph, mapping_type: type as SmartDocPlaceholder["mapping_type"], mapping_key: rest.join(".") };
              onChange(next);
            }}
            style={{ width: "100%" }}
          >
            {options.map((o) => (
              <option key={`${o.mapping_type}.${o.mapping_key}`} value={`${o.mapping_type}.${o.mapping_key}`}>
                {t(GROUP_KEY[o.group] ?? "sd.groupSystem")} — {o.label}
              </option>
            ))}
          </select>
        </div>
      ))}
    </div>
  );
}

export default SmartDocsEditor;
