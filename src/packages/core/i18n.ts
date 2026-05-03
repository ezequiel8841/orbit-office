// @orbitoffice/core — i18n (zero deps).
// Detect locale from navigator, allow override via <OrbitI18nProvider locale=... />,
// and expose a flat dictionary covering every visible UI string in the suite.

import { createContext, createElement, useContext, useMemo, type ReactNode } from "react";

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
// Dictionary

export const DICT = {
  en: {
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
  },
  pt: {
    "common.loading": "Carregando…",
    "common.cancel": "Cancelar",
    "common.confirm": "OK",
    "common.close": "Fechar",
    "common.import": "Importar",
    "common.export": "Exportar",
    "common.undo": "Desfazer (Ctrl+Z)",
    "common.redo": "Refazer (Ctrl+Shift+Z)",
    "common.find": "Localizar",
    "common.replace": "Substituir",
    "common.replaceAll": "Substituir tudo",
    "common.replaceWith": "Substituir por",
    "common.findShortcut": "Localizar/Substituir (Ctrl+F)",
    "common.search": "Buscar…",
    "common.placeholder": "Placeholder",
    "common.placeholderInsert": "Inserir placeholder",
    "common.placeholderInsertCell": "Inserir placeholder na célula ativa",
    "doc.blockStyle": "Estilo de bloco",
    "doc.fontSize": "Tamanho da fonte",
    "doc.bold": "Negrito (Ctrl+B)",
    "doc.italic": "Itálico (Ctrl+I)",
    "doc.underline": "Sublinhado (Ctrl+U)",
    "doc.strike": "Tachado",
    "doc.code": "Código inline",
    "doc.alignLeft": "Alinhar à esquerda",
    "doc.alignCenter": "Centralizar",
    "doc.alignRight": "Alinhar à direita",
    "doc.alignJustify": "Justificar",
    "doc.bulletList": "Lista com marcadores",
    "doc.numberedList": "Lista numerada",
    "doc.checklist": "Lista de tarefas",
    "doc.divider": "Divisor",
    "doc.link": "Link (Ctrl+K)",
    "doc.table": "Inserir tabela",
    "doc.image": "Inserir imagem",
    "doc.textColor": "Cor do texto",
    "doc.highlight": "Realce",
    "doc.importMd": "Importar Markdown",
    "doc.exportMd": "Exportar Markdown",
    "doc.exportHtml": "Exportar HTML",
    "sheet.formatGeneral": "Geral",
    "sheet.formatNumber": "Número",
    "sheet.formatInteger": "Inteiro",
    "sheet.formatPercent": "Porcentagem",
    "sheet.formatCurrency": "Moeda",
    "sheet.formatDate": "Data",
    "sheet.sortAsc": "Ordenar A→Z pela coluna principal",
    "sheet.sortDesc": "Ordenar Z→A pela coluna principal",
    "sheet.filter": "Filtrar a coluna ativa",
    "sheet.merge": "Mesclar células selecionadas",
    "sheet.unmerge": "Desmesclar células selecionadas",
    "sheet.bordersAll": "Todas as bordas",
    "sheet.bordersOutside": "Borda externa",
    "sheet.bordersNone": "Sem bordas",
    "sheet.freeze": "Congelar até a célula ativa",
    "sheet.validation": "Adicionar validação à seleção",
    "sheet.condFormat": "Formatação condicional",
    "sheet.chart": "Inserir gráfico da seleção",
    "sheet.activeCell": "Célula ativa",
    "sheet.formulaBar": "Barra de fórmulas",
    "sheet.statusSelection": "Seleção",
    "sheet.statusCells": "células",
    "sheet.statusCell": "célula",
    "sheet.statusSum": "Soma",
    "sheet.statusAvg": "Média",
    "sheet.statusCount": "Contagem",
    "slides.theme": "Tema",
    "slides.newSlideLayout": "Layout do novo slide",
    "slides.addText": "Adicionar texto",
    "slides.shapeRect": "Retângulo",
    "slides.shapeEllipse": "Elipse",
    "slides.shapeTriangle": "Triângulo",
    "slides.shapeLine": "Linha",
    "slides.shapeArrow": "Seta",
    "slides.shapeStar": "Estrela",
    "slides.shapeImage": "Imagem",
    "slides.bringForward": "Trazer para frente",
    "slides.sendBackward": "Enviar para trás",
    "slides.gridView": "Visão em grade (G)",
    "slides.editorView": "Editor",
    "slides.toggleNotes": "Alternar notas",
    "slides.present": "▶ Apresentar",
    "slides.presentTitle": "Apresentar (F5)",
    "slides.importDeck": "Importar apresentação",
    "slides.exportDeck": "Exportar apresentação",
    "slides.notesHeader": "NOTAS DO APRESENTADOR",
    "slides.notesPlaceholder": "Adicione notas para este slide…",
    "slides.layoutTitle": "Título",
    "slides.layoutTitleContent": "Título + Conteúdo",
    "slides.layoutTwoContent": "Dois conteúdos",
    "slides.layoutSection": "Cabeçalho de seção",
    "slides.layoutBlank": "Em branco",
    "slides.confirmReplaceLayout": "Substituir o conteúdo do slide pelo layout escolhido?",
    "slides.newSlide": "+ Slide",
    "ph.searchPlaceholder": "Buscar campo…",
    "ph.empty": "Nenhum placeholder detectado.",
    "sd.modelTitle": "Modelo",
    "sd.editInOrigin": "Edite o conteúdo do arquivo no aplicativo de origem. Aqui você apenas mapeia os placeholders detectados aos campos do CRM.",
    "sd.mapping": "Mapeamento",
    "sd.groupLead": "Lead",
    "sd.groupCustomField": "Campos personalizados",
    "sd.groupOrganization": "Organização",
    "sd.groupOwner": "Responsável",
    "sd.groupCurrentUser": "Usuário atual",
    "sd.groupSystem": "Sistema",
  },
  es: {
    "common.loading": "Cargando…",
    "common.cancel": "Cancelar",
    "common.confirm": "OK",
    "common.close": "Cerrar",
    "common.import": "Importar",
    "common.export": "Exportar",
    "common.undo": "Deshacer (Ctrl+Z)",
    "common.redo": "Rehacer (Ctrl+Shift+Z)",
    "common.find": "Buscar",
    "common.replace": "Reemplazar",
    "common.replaceAll": "Reemplazar todo",
    "common.replaceWith": "Reemplazar con",
    "common.findShortcut": "Buscar/Reemplazar (Ctrl+F)",
    "common.search": "Buscar…",
    "common.placeholder": "Marcador",
    "common.placeholderInsert": "Insertar marcador",
    "common.placeholderInsertCell": "Insertar marcador en la celda activa",
    "doc.blockStyle": "Estilo de bloque",
    "doc.fontSize": "Tamaño de fuente",
    "doc.bold": "Negrita (Ctrl+B)",
    "doc.italic": "Cursiva (Ctrl+I)",
    "doc.underline": "Subrayado (Ctrl+U)",
    "doc.strike": "Tachado",
    "doc.code": "Código en línea",
    "doc.alignLeft": "Alinear a la izquierda",
    "doc.alignCenter": "Centrar",
    "doc.alignRight": "Alinear a la derecha",
    "doc.alignJustify": "Justificar",
    "doc.bulletList": "Lista con viñetas",
    "doc.numberedList": "Lista numerada",
    "doc.checklist": "Lista de tareas",
    "doc.divider": "Divisor",
    "doc.link": "Enlace (Ctrl+K)",
    "doc.table": "Insertar tabla",
    "doc.image": "Insertar imagen",
    "doc.textColor": "Color de texto",
    "doc.highlight": "Resaltado",
    "doc.importMd": "Importar Markdown",
    "doc.exportMd": "Exportar Markdown",
    "doc.exportHtml": "Exportar HTML",
    "sheet.formatGeneral": "General",
    "sheet.formatNumber": "Número",
    "sheet.formatInteger": "Entero",
    "sheet.formatPercent": "Porcentaje",
    "sheet.formatCurrency": "Moneda",
    "sheet.formatDate": "Fecha",
    "sheet.sortAsc": "Ordenar A→Z por columna principal",
    "sheet.sortDesc": "Ordenar Z→A por columna principal",
    "sheet.filter": "Filtrar la columna activa",
    "sheet.merge": "Combinar celdas seleccionadas",
    "sheet.unmerge": "Separar celdas seleccionadas",
    "sheet.bordersAll": "Todos los bordes",
    "sheet.bordersOutside": "Borde exterior",
    "sheet.bordersNone": "Sin bordes",
    "sheet.freeze": "Inmovilizar hasta la celda activa",
    "sheet.validation": "Agregar validación a la selección",
    "sheet.condFormat": "Formato condicional",
    "sheet.chart": "Insertar gráfico desde la selección",
    "sheet.activeCell": "Celda activa",
    "sheet.formulaBar": "Barra de fórmulas",
    "sheet.statusSelection": "Selección",
    "sheet.statusCells": "celdas",
    "sheet.statusCell": "celda",
    "sheet.statusSum": "Suma",
    "sheet.statusAvg": "Promedio",
    "sheet.statusCount": "Recuento",
    "slides.theme": "Tema",
    "slides.newSlideLayout": "Diseño de nueva diapositiva",
    "slides.addText": "Agregar texto",
    "slides.shapeRect": "Rectángulo",
    "slides.shapeEllipse": "Elipse",
    "slides.shapeTriangle": "Triángulo",
    "slides.shapeLine": "Línea",
    "slides.shapeArrow": "Flecha",
    "slides.shapeStar": "Estrella",
    "slides.shapeImage": "Imagen",
    "slides.bringForward": "Traer al frente",
    "slides.sendBackward": "Enviar atrás",
    "slides.gridView": "Vista de cuadrícula (G)",
    "slides.editorView": "Editor",
    "slides.toggleNotes": "Alternar notas",
    "slides.present": "▶ Presentar",
    "slides.presentTitle": "Presentar (F5)",
    "slides.importDeck": "Importar presentación",
    "slides.exportDeck": "Exportar presentación",
    "slides.notesHeader": "NOTAS DEL PRESENTADOR",
    "slides.notesPlaceholder": "Agregar notas para esta diapositiva…",
    "slides.layoutTitle": "Título",
    "slides.layoutTitleContent": "Título + Contenido",
    "slides.layoutTwoContent": "Dos contenidos",
    "slides.layoutSection": "Encabezado de sección",
    "slides.layoutBlank": "En blanco",
    "slides.confirmReplaceLayout": "¿Reemplazar el contenido de la diapositiva con el diseño elegido?",
    "slides.newSlide": "+ Diapositiva",
    "ph.searchPlaceholder": "Buscar campo…",
    "ph.empty": "No se detectaron marcadores.",
    "sd.modelTitle": "Plantilla",
    "sd.editInOrigin": "Edita el contenido del archivo en la aplicación de origen. Aquí solo asignas los marcadores detectados a los campos del CRM.",
    "sd.mapping": "Asignación",
    "sd.groupLead": "Lead",
    "sd.groupCustomField": "Campos personalizados",
    "sd.groupOrganization": "Organización",
    "sd.groupOwner": "Responsable",
    "sd.groupCurrentUser": "Usuario actual",
    "sd.groupSystem": "Sistema",
  },
};

// ---------------------------------------------------------------------------
// Context + hook

export type OrbitTKey = keyof (typeof DICT)["en"];

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
  const value = useMemo<OrbitI18nCtx>(() => {
    const loc: OrbitLocale = locale ?? detectLocale();
    return {
      locale: loc,
      t: (key) => DICT[loc][key] ?? DICT.en[key] ?? key,
    };
  }, [locale]);
  return createElement(Ctx.Provider, { value }, children);
}

/** Get the translator. Falls back to detected locale when no provider is mounted. */
export function useOrbitI18n(): OrbitI18nCtx {
  const ctx = useContext(Ctx);
  if (ctx) return ctx;
  // Lazy fallback (no provider): detect once per render.
  const loc = detectLocale();
  return { locale: loc, t: (k) => DICT[loc][k] ?? DICT.en[k] ?? k };
}

/** Convenience hook returning just the translator. */
export function useT(): (key: OrbitTKey) => string {
  return useOrbitI18n().t;
}
