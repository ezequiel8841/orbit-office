// @orbitoffice/core — i18n (zero deps).
// Detect locale from navigator, allow override via <OrbitI18nProvider locale=... />,
// and expose a flat dictionary covering every visible UI string in the suite.
// pt/es dictionaries are lazy-loaded on first use to keep the initial bundle lean.

import { createContext, createElement, useContext, useEffect, useMemo, useState, type ReactNode } from "react";

export type OrbitLocale = "en" | "pt" | "es";
export const SUPPORTED_LOCALES: OrbitLocale[] = ["en", "pt", "es"];

/** Pick a supported locale from a BCP-47 tag (e.g. "pt-BR" → "pt"). */
export function normalizeLocale(tag: string | undefined | null): OrbitLocale | null {
  if (!tag) return null;
  const base = tag.toLowerCase().split(/[-_]/)[0];
  return (SUPPORTED_LOCALES as string[]).includes(base) ? (base as OrbitLocale) : null;
}

/** Auto-detect locale: navigator.languages → navigator.language → "en". */
export function detectLocale(): OrbitLocale {
  if (typeof navigator === "undefined") return "en";
  const list = (navigator.languages && navigator.languages.length ? navigator.languages : [navigator.language]) ?? [];
  for (const tag of list) {
    const n = normalizeLocale(tag);
    if (n) return n;
  }
  return "en";
}

// ---------------------------------------------------------------------------
// Dictionary — English only (default locale, always bundled)

export const DICT_EN = {
  /* generic */
  "common.loading": "Loading…",
  "common.cancel": "Cancel",
  "common.confirm": "OK",
  "common.close": "Close",
  "common.import": "Import",
  "common.export": "Export",
  "common.undo": "Undo (Ctrl+Z)",
  "common.redo": "Redo (Ctrl+Shift+Z)",
  "common.find": "Find",
  "common.replace": "Replace",
  "common.replaceAll": "Replace all",
  "common.replaceWith": "Replace with",
  "common.findShortcut": "Find/Replace (Ctrl+F)",
  "common.search": "Search…",
  "common.placeholder": "Placeholder",
  "common.placeholderInsert": "Insert placeholder",
  "common.placeholderInsertCell": "Insert placeholder into active cell",
  /* doc */
  "doc.blockStyle": "Block style",
  "doc.fontSize": "Font size",
  "doc.bold": "Bold (Ctrl+B)",
  "doc.italic": "Italic (Ctrl+I)",
  "doc.underline": "Underline (Ctrl+U)",
  "doc.strike": "Strikethrough",
  "doc.code": "Inline code",
  "doc.alignLeft": "Align left",
  "doc.alignCenter": "Align center",
  "doc.alignRight": "Align right",
  "doc.alignJustify": "Justify",
  "doc.bulletList": "Bullet list",
  "doc.numberedList": "Numbered list",
  "doc.checklist": "Checklist",
  "doc.divider": "Divider",
  "doc.link": "Link (Ctrl+K)",
  "doc.table": "Insert table",
  "doc.image": "Insert image",
  "doc.textColor": "Text color",
  "doc.highlight": "Highlight",
  "doc.importMd": "Import Markdown",
  "doc.exportMd": "Export Markdown",
  "doc.exportHtml": "Export HTML",
  /* sheet */
  "sheet.formatGeneral": "General",
  "sheet.formatNumber": "Number",
  "sheet.formatInteger": "Integer",
  "sheet.formatPercent": "Percent",
  "sheet.formatCurrency": "Currency",
  "sheet.formatDate": "Date",
  "sheet.sortAsc": "Sort A→Z by primary column",
  "sheet.sortDesc": "Sort Z→A by primary column",
  "sheet.filter": "Filter the active column",
  "sheet.merge": "Merge selected cells",
  "sheet.unmerge": "Unmerge selected cells",
  "sheet.bordersAll": "All borders",
  "sheet.bordersOutside": "Outside border",
  "sheet.bordersNone": "No borders",
  "sheet.freeze": "Freeze up to active cell",
  "sheet.validation": "Add data validation to selection",
  "sheet.condFormat": "Conditional formatting",
  "sheet.chart": "Insert chart from selection",
  "sheet.activeCell": "Active cell",
  "sheet.formulaBar": "Formula bar",
  "sheet.statusSelection": "Selection",
  "sheet.statusCells": "cells",
  "sheet.statusCell": "cell",
  "sheet.statusSum": "Sum",
  "sheet.statusAvg": "Avg",
  "sheet.statusCount": "Count",
  /* slides */
  "slides.theme": "Theme",
  "slides.newSlideLayout": "New slide layout",
  "slides.addText": "Add text",
  "slides.shapeRect": "Rectangle",
  "slides.shapeEllipse": "Ellipse",
  "slides.shapeTriangle": "Triangle",
  "slides.shapeLine": "Line",
  "slides.shapeArrow": "Arrow",
  "slides.shapeStar": "Star",
  "slides.shapeImage": "Image",
  "slides.bringForward": "Bring forward",
  "slides.sendBackward": "Send backward",
  "slides.gridView": "Grid view (G)",
  "slides.editorView": "Editor",
  "slides.toggleNotes": "Toggle notes",
  "slides.present": "▶ Present",
  "slides.presentTitle": "Present (F5)",
  "slides.importDeck": "Import deck",
  "slides.exportDeck": "Export deck",
  "slides.notesHeader": "SPEAKER NOTES",
  "slides.notesPlaceholder": "Add notes for this slide…",
  "slides.layoutTitle": "Title",
  "slides.layoutTitleContent": "Title + Content",
  "slides.layoutTwoContent": "Two Content",
  "slides.layoutSection": "Section header",
  "slides.layoutBlank": "Blank",
  "slides.confirmReplaceLayout": "Replace slide content with chosen layout?",
  "slides.newSlide": "+ Slide",
  /* ribbon tab labels */
  "tab.home": "Home",
  "tab.insert": "Insert",
  "tab.view": "View",
  "tab.export": "Export",
  "tab.arrange": "Arrange",
  "tab.data": "Data",
  "tab.tools": "Tools",
  "tab.file": "File",
  /* ribbon group labels */
  "grp.history": "History",
  "grp.style": "Style",
  "grp.font": "Font",
  "grp.paragraph": "Paragraph",
  "grp.insert": "Insert",
  "grp.content": "Content",
  "grp.page": "Page",
  "grp.view": "View",
  "grp.export": "Export / File",
  "grp.presentation": "Presentation",
  "grp.arrange": "Arrange",
  "grp.data": "Data",
  "grp.cells": "Cells",
  "grp.tools": "Tools",
  "grp.format": "Format",
  "grp.alignment": "Alignment",
  /* short toolbar labels */
  "lbl.undo": "Undo",
  "lbl.redo": "Redo",
  "lbl.strike": "Strikeout",
  "lbl.code": "Code",
  "lbl.sub": "Sub",
  "lbl.sup": "Sup",
  "lbl.list": "List",
  "lbl.orderedList": "Numbered",
  "lbl.checklist": "Checklist",
  "lbl.divider": "Divider",
  "lbl.link": "Link",
  "lbl.table": "Table",
  "lbl.image": "Image",
  "lbl.math": "Equation",
  "lbl.toc": "TOC",
  "lbl.pageBreak": "Page break",
  "lbl.clearFormat": "Clear",
  "lbl.dateField": "Date",
  "lbl.footnote": "Footnote",
  "lbl.comment": "Comment",
  "lbl.commentVerb": "Comment",
  "lbl.pageSettings": "Page",
  "lbl.header": "Header",
  "lbl.footer": "Footer",
  "lbl.pageBg": "Background",
  "lbl.find": "Find",
  "lbl.stats": "Statistics",
  "lbl.navigator": "Navigator",
  "lbl.comments": "Comments",
  "lbl.print": "Print",
  "lbl.tableRowAbove": "Row above",
  "lbl.tableRowBelow": "Row below",
  "lbl.tableDeleteRow": "Delete row",
  "lbl.tableColLeft": "Col left",
  "lbl.tableColRight": "Col right",
  "lbl.tableDeleteCol": "Delete col",
  "lbl.text": "Text",
  "lbl.imageUrl": "Image URL",
  "lbl.bringFront": "Front",
  "lbl.bringForward": "Forward",
  "lbl.sendBackward": "Backward",
  "lbl.sendBack": "Back",
  "lbl.gridView": "Grid",
  "lbl.notes": "Notes",
  "lbl.present": "Present",
  "lbl.duplicate": "Duplicate",
  "lbl.lock": "Lock",
  "lbl.locked": "Locked",
  "lbl.delete": "Delete",
  "lbl.wrapText": "Wrap",
  "lbl.filter": "Filter",
  "lbl.merge": "Merge",
  "lbl.unmerge": "Unmerge",
  "lbl.allBorders": "All borders",
  "lbl.outerBorder": "Outer",
  "lbl.noBorder": "No border",
  "lbl.freeze": "Freeze",
  "lbl.validate": "Validate",
  "lbl.condFormat": "Cond. format",
  "lbl.chart": "Chart",
  "lbl.importFile": "Import",
  "lbl.exportTxt": "TXT",
  "lbl.exportMd": "Markdown",
  "lbl.exportHtml": "HTML",
  "lbl.exportWord": "Word",
  /* placeholders palette */
  "ph.searchPlaceholder": "Search field…",
  "ph.empty": "No placeholders detected.",
  /* smartdocs adapter */
  "sd.modelTitle": "Template",
  "sd.editInOrigin": "Edit the file content in the source application. Here you only map the detected placeholders to CRM fields.",
  "sd.mapping": "Mapping",
  "sd.groupLead": "Lead",
  "sd.groupCustomField": "Custom fields",
  "sd.groupOrganization": "Organization",
  "sd.groupOwner": "Owner",
  "sd.groupCurrentUser": "Current user",
  "sd.groupSystem": "System",
} as const;

// ---------------------------------------------------------------------------
// Lazy locale cache — populated on first OrbitI18nProvider mount per locale

const LOCALE_CACHE: Partial<Record<OrbitLocale, Record<string, string>>> = {
  en: DICT_EN as Record<string, string>,
};

function loadLocale(loc: OrbitLocale): Promise<Record<string, string>> {
  if (LOCALE_CACHE[loc]) return Promise.resolve(LOCALE_CACHE[loc]!);
  const p = loc === "pt"
    ? import("./i18n-pt").then((m) => m.DICT_PT)
    : import("./i18n-es").then((m) => m.DICT_ES);
  return p.then((dict) => { LOCALE_CACHE[loc] = dict; return dict; });
}

// ---------------------------------------------------------------------------
// Context + hook

export type OrbitTKey = keyof typeof DICT_EN;

interface OrbitI18nCtx {
  locale: OrbitLocale;
  t: (key: OrbitTKey) => string;
}

const Ctx = createContext<OrbitI18nCtx | null>(null);

export interface OrbitI18nProviderProps {
  /** Force a locale; when omitted, auto-detects from the browser. */
  locale?: OrbitLocale;
  children?: ReactNode;
}

export function OrbitI18nProvider({ locale, children }: OrbitI18nProviderProps) {
  const resolvedLocale = useMemo<OrbitLocale>(() => locale ?? detectLocale(), [locale]);

  const [dict, setDict] = useState<Record<string, string>>(
    () => LOCALE_CACHE[resolvedLocale] ?? (DICT_EN as Record<string, string>),
  );

  useEffect(() => {
    if (resolvedLocale === "en") {
      setDict(DICT_EN as Record<string, string>);
      return;
    }
    loadLocale(resolvedLocale).then(setDict);
  }, [resolvedLocale]);

  const value = useMemo<OrbitI18nCtx>(
    () => ({
      locale: resolvedLocale,
      t: (key) => dict[key] ?? (DICT_EN as Record<string, string>)[key] ?? key,
    }),
    [resolvedLocale, dict],
  );

  return createElement(Ctx.Provider, { value }, children);
}

/** Get the translator. Falls back to detected locale when no provider is mounted. */
export function useOrbitI18n(): OrbitI18nCtx {
  const ctx = useContext(Ctx);
  if (ctx) return ctx;
  const loc = detectLocale();
  const dict = LOCALE_CACHE[loc] ?? (DICT_EN as Record<string, string>);
  return { locale: loc, t: (k) => dict[k] ?? (DICT_EN as Record<string, string>)[k] ?? k };
}

/** Convenience hook returning just the translator. */
export function useT(): (key: OrbitTKey) => string {
  return useOrbitI18n().t;
}
