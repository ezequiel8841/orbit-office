# OrbitOffice — Integration Guide (SaaS hosts)

OrbitOffice is a self-contained office suite (Doc / Slides / Sheet) with a
**Smart Docs** adapter purpose-built for the CRM template editor. This guide
covers everything a host SaaS needs to embed it.

---

## 1. Single import surface

All public API lives in **`@/packages`**. Hosts should never import from
sub-paths like `@/packages/doc/Doc` — those are internal.

```ts
import {
  // High-level (recommended for CRM Smart Docs)
  SmartDocsEditor,
  type SmartDocsEditorChange,
  type SmartDocPlaceholder,

  // Low-level
  OrbitOffice,
  OrbitI18nProvider,

  // Smart Docs contract
  PLACEHOLDER_REGEX,
  buildMappingOptions,
  autoMapPlaceholder,
  serializeHtmlForGenerate,

  // Slides / Sheet models
  createDeck,
  serializeWorkbook,
  deserializeWorkbook,
  type Deck,
  type SerializedWorkbook,
} from "@/packages";
```

OOXML I/O is opt-in (lazy):

```ts
const { readDocxToHtml, writeDocxFromHtml } = await import("@/packages/io/docx");
const { detectPptxPlaceholders }            = await import("@/packages/io/pptx");
const { detectXlsxPlaceholders }            = await import("@/packages/io/xlsx");
```

---

## 2. The CRM Smart Docs flow

```tsx
import { SmartDocsEditor } from "@/packages";

<SmartDocsEditor
  docType="docx"                  // "docx" | "pptx" | "xlsx"
  editorMode="visual"             // "visual" | "placeholder"
  initialHtml={template.body_html}
  customFields={customFields}     // from useCRMCustomFields()
  detected={template.placeholders}
  readOnly={!canEdit}
  onChange={({ html, deck, workbook, placeholders }) => {
    // Persist your way; OrbitOffice never calls the network.
  }}
  onMappingChange={(placeholders) => {
    // Optional: persist mapping decisions only.
  }}
/>
```

What you get back in `onChange`:

| Field           | When                       | Shape                                |
| --------------- | -------------------------- | ------------------------------------ |
| `html`          | DOCX visual                | HTML string with `{{key}}` literals  |
| `deck`          | PPTX visual                | `Deck` (JSON)                        |
| `workbook`      | XLSX visual                | `SerializedWorkbook` (JSON)          |
| `placeholders`  | always                     | `SmartDocPlaceholder[]` (auto-mapped)|

`html` is already serialized for the generator — chips are collapsed to
`{{key}}` literals. No additional sanitization is needed before sending it
to `generate-smart-doc`.

---

## 3. i18n (PT / EN / ES)

Locale is auto-detected from the browser. To force it, wrap the editor (or
pass `locale` to `OrbitOffice` / `SmartDocsEditor` indirectly via the host):

```tsx
import { OrbitI18nProvider } from "@/packages";

<OrbitI18nProvider locale="pt">
  <SmartDocsEditor ... />
</OrbitI18nProvider>
```

Sheet formulas accept localized function names (`SOMA`, `SUMA`, `SE`,
`SI`, `PROCV`, `BUSCARV`, …) — they are resolved to canonical English
internally, so persisted formulas stay portable.

---

## 4. Contract guarantees

- **No network calls.** OrbitOffice never fetches; the host owns persistence.
- **No `localStorage` writes** when `value` (or `initialHtml/Deck/Workbook`)
  is set. Pure controlled mode.
- **Placeholder regex is the source of truth:** `PLACEHOLDER_REGEX` matches
  `{{key}}` with `[\w][\w.\-]{0,80}` keys.
- **Mapping types** match the CRM enum exactly:
  `"lead" | "custom_field" | "organization" | "owner" | "current_user" | "system"`.
- **Auto-mapping** runs on every `detected` change. Host can override via
  `onMappingChange`.

---

## 5. Versioning

`ORBIT_OFFICE_VERSION` is exported from `@/packages`. Bump it when the
public surface changes. Internal packages (`doc/`, `sheet/`, `slides/`,
`hub/`) may move freely.

---

## 6. File map

```
src/packages/
  index.ts              ← public barrel (host imports from here)
  io/                   ← lazy OOXML re-exports
  adapters/smartDocs.tsx
  hub/                  ← OrbitOffice
  core/                 ← shared (i18n, smartDocs contract, store)
  doc/  sheet/  slides/ ← editors (internal)
src/packages-optional/  ← OOXML readers/writers (loaded on demand)
```
