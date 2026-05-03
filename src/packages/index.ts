// @orbitoffice — public entry point for SaaS hosts.
import "./style.css";
//
// Quick start (CRM Smart Docs):
//   import { SmartDocsEditor } from "@/packages";
//
// Lower-level surface:
//   import { OrbitOffice, OrbitI18nProvider } from "@/packages";
//
// OOXML I/O (lazy, optional):
//   const { readDocxToHtml } = await import("@/packages/io/docx");

// ---- High-level adapter (what the CRM uses) ----
export {
  SmartDocsEditor,
  type SmartDocsEditorProps,
  type SmartDocsEditorChange,
  type SmartDocType,
  type SmartDocEditorMode,
} from "./adapters/smartDocs";

// ---- Hub (raw editor host) ----
export {
  OrbitOffice,
  type OrbitOfficeProps,
  type OrbitMode,
  type OrbitValue,
} from "./hub";

// ---- Smart Docs contract (placeholders, mapping) ----
export {
  PLACEHOLDER_REGEX,
  isValidPlaceholderKey,
  buildMappingOptions,
  autoMapPlaceholder,
  suggestMapping,
  formatPlaceholderValue,
  type SmartDocPlaceholder,
  type SmartDocMappingType,
  type SmartDocFormat,
  type MappingOption,
  type BuildMappingOptionsInput,
} from "./core/smartDocs";

// ---- DOM helpers for placeholders (chips, serialization) ----
export {
  wrapLiteralPlaceholders,
  extractPlaceholders,
  serializeHtmlForGenerate,
  buildChipHtml,
} from "./doc/placeholders";

// ---- Workbook (sheet) serialization ----
export {
  serializeWorkbook,
  deserializeWorkbook,
  workbookToJson,
  workbookFromJson,
  type SerializedWorkbook,
} from "./sheet/persist";

// ---- Slides model ----
export {
  createDeck,
  createSlide,
  createTextElement,
  type Deck,
  type Slide,
  type SlideElement,
  type Theme,
} from "./slides/model";

// ---- i18n (locale="en"|"pt"|"es", auto-detected when omitted) ----
export {
  OrbitI18nProvider,
  useOrbitI18n,
  useT,
  detectLocale,
  SUPPORTED_LOCALES,
  type OrbitLocale,
} from "./core/i18n";

// ---- License ----
export { validateLicenseKey } from "./license";

// ---- Version ----
export const ORBIT_OFFICE_VERSION = "1.0.0";
