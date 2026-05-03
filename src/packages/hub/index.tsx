// @orbitoffice/hub — lazy orchestrator.
import { lazy, Suspense, type ReactNode } from "react";
import type { MappingOption, SmartDocPlaceholder } from "../core/smartDocs";
import { OrbitI18nProvider, type OrbitLocale } from "../core/i18n";
import type { Deck } from "../slides/model";
import type { SerializedWorkbook } from "../sheet/persist";

const Sheet = lazy(() => import("../sheet/Sheet"));
const Doc = lazy(() => import("../doc/Doc"));
const Slides = lazy(() => import("../slides/Slides"));

export type OrbitMode = "sheet" | "doc" | "slides";

export type OrbitValue =
  | { mode: "doc"; html: string }
  | { mode: "slides"; deck: Deck }
  | { mode: "sheet"; workbook: SerializedWorkbook };

export interface OrbitOfficeProps {
  mode: OrbitMode;
  fallback?: ReactNode;
  className?: string;
  style?: React.CSSProperties;
  /** Persist to localStorage under this key. Ignored when `value` is set. */
  persistKey?: string;
  /** Controlled value (mode-specific). */
  value?: string | Deck | SerializedWorkbook;
  /** Emits the current value. Mode-specific shape. */
  onChange?: (value: any) => void;
  /** Smart Docs vocabulary; enables placeholder UI. */
  placeholderOptions?: MappingOption[];
  /** Server-detected placeholders (Doc renders palette footer). */
  detectedPlaceholders?: SmartDocPlaceholder[];
  /** Emits placeholders extracted from the editor on every change. */
  onPlaceholdersChange?: (list: SmartDocPlaceholder[]) => void;
  readOnly?: boolean;
  hideExport?: boolean;
  hideImport?: boolean;
  /** Force a UI locale ("en" | "pt" | "es"). When omitted, auto-detects from the browser. */
  locale?: OrbitLocale;
}

export function OrbitOffice({
  mode,
  fallback,
  persistKey,
  value,
  onChange,
  placeholderOptions,
  detectedPlaceholders,
  onPlaceholdersChange,
  readOnly,
  hideExport,
  hideImport,
  locale,
  ...rest
}: OrbitOfficeProps) {
  return (
    <OrbitI18nProvider locale={locale}>
      <Suspense fallback={fallback ?? <div className="oo-root">Loading…</div>}>
        {mode === "sheet" ? (
          <Sheet
            {...rest}
            persistKey={persistKey}
            value={value as SerializedWorkbook | undefined}
            onChange={onChange}
            placeholderOptions={placeholderOptions}
            onPlaceholdersChange={onPlaceholdersChange}
            readOnly={readOnly}
            hideExport={hideExport}
            hideImport={hideImport}
          />
        ) : mode === "doc" ? (
          <Doc
            {...rest}
            persistKey={persistKey ? `${persistKey}:doc` : undefined}
            value={value as string | undefined}
            onChange={onChange}
            placeholderOptions={placeholderOptions}
            detectedPlaceholders={detectedPlaceholders}
            onPlaceholdersChange={onPlaceholdersChange}
            readOnly={readOnly}
            hideExport={hideExport}
            hideImport={hideImport}
          />
        ) : (
          <Slides
            {...rest}
            persistKey={persistKey ? `${persistKey}:slides` : undefined}
            value={value as Deck | undefined}
            onChange={onChange}
            placeholderOptions={placeholderOptions}
            onPlaceholdersChange={onPlaceholdersChange}
            readOnly={readOnly}
            hideExport={hideExport}
            hideImport={hideImport}
          />
        )}
      </Suspense>
    </OrbitI18nProvider>
  );
}

export default OrbitOffice;
