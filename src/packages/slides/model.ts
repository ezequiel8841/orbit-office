// @orbitoffice/slides — model.
export const SLIDE_W = 1920;
export const SLIDE_H = 1080;

export type ElementType = "text" | "shape" | "image";
export type ShapeKind = "rect" | "ellipse" | "triangle" | "line" | "arrow" | "star" | "diamond" | "pentagon" | "hexagon";

export interface BaseElement {
  id: string;
  type: ElementType;
  x: number;
  y: number;
  w: number;
  h: number;
  rotation?: number;
  z?: number;
  opacity?: number;
  locked?: boolean;
}

export interface TextElement extends BaseElement {
  type: "text";
  html: string;
  color?: string;
  fontFamily?: string;
  fontSize?: number;
  align?: "left" | "center" | "right";
  bold?: boolean;
  italic?: boolean;
  underline?: boolean;
  lineHeight?: number;
  letterSpacing?: number;
  textShadow?: string;
  bgFill?: string;
}

export interface ShapeElement extends BaseElement {
  type: "shape";
  shape: ShapeKind;
  fill?: string;
  stroke?: string;
  strokeWidth?: number;
  borderRadius?: number;
  shadow?: string;
  shapeText?: string;
  shapeTextColor?: string;
  shapeTextSize?: number;
  shapeTextBold?: boolean;
  shapeTextAlign?: "left" | "center" | "right";
}

export interface ImageElement extends BaseElement {
  type: "image";
  src: string;
  alt?: string;
}

export type SlideElement = TextElement | ShapeElement | ImageElement;

export type LayoutId = "title" | "titleContent" | "twoContent" | "section" | "blank";

export interface Theme {
  id: string;
  name: string;
  bg: string;
  fg: string;
  accent: string;
  font: string;
}

export interface Slide {
  id: string;
  layout: LayoutId;
  background?: string;
  bgGradient?: { c1: string; c2: string; angle: number };
  bgImage?: string;
  elements: SlideElement[];
  notes?: string;
  transition?: "none" | "fade" | "slide" | "zoom";
}

export interface Deck {
  id: string;
  themeId: string;
  size: { w: number; h: number };
  slides: Slide[];
}

export const THEMES: Theme[] = /*#__PURE__*/ [
  { id: "light",   name: "Light",   bg: "#ffffff", fg: "#111111", accent: "#2563eb", font: "system-ui, sans-serif" },
  { id: "dark",    name: "Dark",    bg: "#0b0b0b", fg: "#f5f5f5", accent: "#60a5fa", font: "system-ui, sans-serif" },
  { id: "ocean",   name: "Ocean",   bg: "#0f172a", fg: "#e2e8f0", accent: "#22d3ee", font: "system-ui, sans-serif" },
  { id: "forest",  name: "Forest",  bg: "#0f1f10", fg: "#e7f5e8", accent: "#34d399", font: "Georgia, serif" },
  { id: "sunset",  name: "Sunset",  bg: "#1f0d1d", fg: "#fde7c1", accent: "#fb923c", font: "system-ui, sans-serif" },
  { id: "paper",   name: "Paper",   bg: "#f8f5ee", fg: "#2b2118", accent: "#b45309", font: "Georgia, serif" },
];

export function getTheme(id: string): Theme {
  return THEMES.find((t) => t.id === id) ?? THEMES[0];
}

const uid = () => "el_" + Math.random().toString(36).slice(2, 9);
const sid = () => "sl_" + Math.random().toString(36).slice(2, 9);

export function createTextElement(partial: Partial<TextElement> = {}): TextElement {
  return {
    id: uid(),
    type: "text",
    x: 200, y: 200, w: 1000, h: 200,
    html: "Click to edit",
    fontSize: 64,
    align: "left",
    ...partial,
  };
}

export function createShapeElement(shape: ShapeKind, partial: Partial<ShapeElement> = {}): ShapeElement {
  return {
    id: uid(),
    type: "shape",
    shape,
    x: 600, y: 400, w: 400, h: 280,
    fill: "#2563eb",
    stroke: "transparent",
    strokeWidth: 0,
    ...partial,
  };
}

export function createImageElement(src: string, partial: Partial<ImageElement> = {}): ImageElement {
  return {
    id: uid(),
    type: "image",
    src,
    x: 400, y: 200, w: 1120, h: 680,
    ...partial,
  };
}

export function createSlide(layout: LayoutId = "titleContent", theme?: Theme): Slide {
  const accent = theme?.accent ?? "#2563eb";
  const fg = theme?.fg ?? "#111";
  const els: SlideElement[] = [];
  switch (layout) {
    case "title":
      els.push(createTextElement({
        x: 160, y: 420, w: 1600, h: 200,
        html: "Presentation Title",
        fontSize: 96, align: "center", bold: true, color: fg,
      }));
      els.push(createTextElement({
        x: 160, y: 640, w: 1600, h: 100,
        html: "Subtitle goes here",
        fontSize: 40, align: "center", color: accent,
      }));
      break;
    case "titleContent":
      els.push(createTextElement({
        x: 120, y: 100, w: 1680, h: 140,
        html: "Slide Title", fontSize: 72, bold: true, color: fg,
      }));
      els.push(createTextElement({
        x: 120, y: 280, w: 1680, h: 700,
        html: "Add your content here.<br/>• Bullet one<br/>• Bullet two",
        fontSize: 40, color: fg,
      }));
      break;
    case "twoContent":
      els.push(createTextElement({
        x: 120, y: 100, w: 1680, h: 140,
        html: "Two Columns", fontSize: 72, bold: true, color: fg,
      }));
      els.push(createTextElement({
        x: 120, y: 280, w: 800, h: 700,
        html: "Left content", fontSize: 36, color: fg,
      }));
      els.push(createTextElement({
        x: 1000, y: 280, w: 800, h: 700,
        html: "Right content", fontSize: 36, color: fg,
      }));
      break;
    case "section":
      els.push(createShapeElement("rect", {
        x: 0, y: 460, w: 1920, h: 160, fill: accent,
      }));
      els.push(createTextElement({
        x: 120, y: 480, w: 1680, h: 120,
        html: "Section Header", fontSize: 80, bold: true, align: "center", color: "#fff",
      }));
      break;
    case "blank":
    default:
      break;
  }
  return {
    id: sid(),
    layout,
    elements: els,
    notes: "",
    transition: "fade",
  };
}

export function createDeck(themeId = "light"): Deck {
  const theme = getTheme(themeId);
  return {
    id: "deck_" + Math.random().toString(36).slice(2, 9),
    themeId,
    size: { w: SLIDE_W, h: SLIDE_H },
    slides: [createSlide("title", theme), createSlide("titleContent", theme)],
  };
}
