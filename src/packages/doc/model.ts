// @orbitoffice/doc — node model.

export type Mark =
  | "bold" | "italic" | "underline" | "strike" | "code" | "sub" | "sup"
  | { type: "color"; value: string }
  | { type: "highlight"; value: string }
  | { type: "link"; href: string };

export type Inline =
  | { type: "text"; text: string; marks?: Mark[] };

export type BlockType =
  | "paragraph" | "h1" | "h2" | "h3" | "h4" | "h5" | "h6"
  | "blockquote" | "code" | "ul" | "ol" | "checklist" | "hr";

export interface DocFragment {
  blocks: Block[];
}

export interface Block {
  type: BlockType;
  children?: Inline[];
  /** for ul/ol/checklist: list items as nested blocks (paragraph) */
  items?: { children: Inline[]; checked?: boolean }[];
  /** for code blocks */
  text?: string;
  lang?: string;
  /** for paragraphs/headings */
  align?: "l" | "c" | "r" | "j";
}
