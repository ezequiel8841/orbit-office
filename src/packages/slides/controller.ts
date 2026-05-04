// @orbitoffice/slides — controller (store + history + commands).
import { createStore } from "../core/store";
import { deepClone } from "../core/utils";
import {
  createImageElement,
  createShapeElement,
  createSlide,
  type Deck,
  type LayoutId,
  type ShapeKind,
  type Slide,
  type SlideElement,
  type TextElement,
  getTheme,
} from "./model";
import { align as alignEls, distribute as distributeEls, type AlignKind, type DistributeKind } from "./snap";

export interface SlidesState {
  deck: Deck;
  activeSlideId: string;
  selectedIds: string[];
  rev: number;
}

export interface SlidesController {
  store: ReturnType<typeof createStore<SlidesState>>;
  // slide ops
  addSlide: (layout?: LayoutId) => void;
  duplicateSlide: (id: string) => void;
  deleteSlide: (id: string) => void;
  moveSlide: (id: string, dir: -1 | 1) => void;
  reorderSlide: (id: string, toIndex: number) => void;
  setActive: (id: string) => void;
  setNotes: (id: string, notes: string) => void;
  setSlideBackground: (id: string, bg: string | undefined) => void;
  setSlideBgGradient: (id: string, gradient: { c1: string; c2: string; angle: number } | undefined) => void;
  setSlideBgImage: (id: string, url: string | undefined) => void;
  setSlideTransition: (id: string, transition: Slide["transition"]) => void;
  setLayout: (id: string, layout: LayoutId) => void;
  setTheme: (themeId: string) => void;
  // element ops
  addText: () => void;
  addShape: (shape: ShapeKind) => void;
  addImage: (src: string) => void;
  /** Insert a Smart Docs placeholder. Appends `{{key}}` to the selected text
   *  element, or creates a new text element when none is selected. */
  insertPlaceholder: (key: string) => void;
  updateElement: (slideId: string, elId: string, patch: Partial<SlideElement>) => void;
  deleteSelected: () => void;
  bringForward: () => void;
  sendBackward: () => void;
  bringToFront: () => void;
  sendToBack: () => void;
  setSelection: (ids: string[]) => void;
  alignSelected: (kind: AlignKind) => void;
  distributeSelected: (kind: DistributeKind) => void;
  copySelected: () => void;
  pasteElements: () => void;
  // history
  undo: () => void;
  redo: () => void;
  canUndo: () => boolean;
  canRedo: () => boolean;
  // io
  loadDeck: (deck: Deck) => void;
  toJSON: () => string;
  snapshot: () => void;
}

export function createSlidesController(initial?: Deck, persistKey?: string): SlidesController {
  const initDeck: Deck =
    initial ??
    (() => {
      try {
        if (persistKey) {
          const raw = localStorage.getItem(persistKey);
          if (raw) {
            const parsed = JSON.parse(raw) as Deck;
            if (parsed && Array.isArray(parsed.slides) && parsed.slides.length > 0) {
              return parsed;
            }
          }
        }
      } catch { /* ignore */ }
      return null as unknown as Deck;
    })() ??
    {
      id: "deck_init",
      themeId: "light",
      size: { w: 1920, h: 1080 },
      slides: [createSlide("title"), createSlide("titleContent")],
    };

  const store = createStore<SlidesState>({
    deck: initDeck,
    activeSlideId: initDeck.slides[0]?.id ?? "",
    selectedIds: [],
    rev: 0,
  });

  const past: Deck[] = [];
  const future: Deck[] = [];
  let clipboard: SlideElement[] | null = null;

  function bump() {
    store.set((s) => ({ ...s, rev: s.rev + 1 }));
    if (persistKey) {
      try { localStorage.setItem(persistKey, JSON.stringify(store.get().deck)); } catch { /* ignore */ }
    }
  }

  function snapshot() {
    past.push(deepClone(store.get().deck));
    if (past.length > 100) past.shift();
    future.length = 0;
  }

  function mutate(fn: (deck: Deck, st: SlidesState) => void) {
    snapshot();
    const st = store.get();
    const deck = deepClone(st.deck);
    fn(deck, st);
    store.set((s) => ({ ...s, deck }));
    bump();
  }

  function activeSlide(): Slide | undefined {
    const st = store.get();
    return st.deck.slides.find((s) => s.id === st.activeSlideId);
  }

  return {
    store,
    addSlide(layout = "titleContent") {
      mutate((deck, st) => {
        const theme = getTheme(deck.themeId);
        const sl = createSlide(layout, theme);
        const idx = deck.slides.findIndex((s) => s.id === st.activeSlideId);
        deck.slides.splice(idx + 1, 0, sl);
        store.set((s) => ({ ...s, activeSlideId: sl.id, selectedIds: [] }));
      });
    },
    duplicateSlide(id) {
      mutate((deck) => {
        const i = deck.slides.findIndex((s) => s.id === id);
        if (i < 0) return;
        const clone: Slide = deepClone(deck.slides[i]);
        clone.id = "sl_" + Math.random().toString(36).slice(2, 9);
        clone.elements = clone.elements.map((e) => ({
          ...e, id: "el_" + Math.random().toString(36).slice(2, 9),
        }));
        deck.slides.splice(i + 1, 0, clone);
        store.set((s) => ({ ...s, activeSlideId: clone.id, selectedIds: [] }));
      });
    },
    deleteSlide(id) {
      mutate((deck, st) => {
        if (deck.slides.length <= 1) return;
        const i = deck.slides.findIndex((s) => s.id === id);
        if (i < 0) return;
        deck.slides.splice(i, 1);
        const next = deck.slides[Math.max(0, i - 1)];
        if (st.activeSlideId === id) {
          store.set((s) => ({ ...s, activeSlideId: next.id, selectedIds: [] }));
        }
      });
    },
    moveSlide(id, dir) {
      mutate((deck) => {
        const i = deck.slides.findIndex((s) => s.id === id);
        const j = i + dir;
        if (i < 0 || j < 0 || j >= deck.slides.length) return;
        const [s] = deck.slides.splice(i, 1);
        deck.slides.splice(j, 0, s);
      });
    },
    reorderSlide(id, toIndex) {
      mutate((deck) => {
        const i = deck.slides.findIndex((s) => s.id === id);
        if (i < 0) return;
        const [s] = deck.slides.splice(i, 1);
        const clamp = Math.max(0, Math.min(deck.slides.length, toIndex));
        deck.slides.splice(clamp, 0, s);
      });
    },
    setActive(id) {
      store.set((s) => ({ ...s, activeSlideId: id, selectedIds: [] }));
    },
    setNotes(id, notes) {
      mutate((deck) => {
        const sl = deck.slides.find((s) => s.id === id);
        if (sl) sl.notes = notes;
      });
    },
    setSlideBackground(id, bg) {
      mutate((deck) => {
        const sl = deck.slides.find((s) => s.id === id);
        if (sl) { sl.background = bg; sl.bgGradient = undefined; sl.bgImage = undefined; }
      });
    },
    setSlideBgGradient(id, gradient) {
      mutate((deck) => {
        const sl = deck.slides.find((s) => s.id === id);
        if (sl) { sl.bgGradient = gradient; sl.background = undefined; sl.bgImage = undefined; }
      });
    },
    setSlideBgImage(id, url) {
      mutate((deck) => {
        const sl = deck.slides.find((s) => s.id === id);
        if (sl) { sl.bgImage = url || undefined; if (url) { sl.background = undefined; sl.bgGradient = undefined; } }
      });
    },
    setSlideTransition(id, transition) {
      mutate((deck) => {
        const sl = deck.slides.find((s) => s.id === id);
        if (sl) sl.transition = transition;
      });
    },
    setLayout(id, layout) {
      mutate((deck) => {
        const sl = deck.slides.find((s) => s.id === id);
        if (!sl) return;
        const theme = getTheme(deck.themeId);
        const fresh = createSlide(layout, theme);
        sl.layout = layout;
        sl.elements = fresh.elements;
      });
    },
    setTheme(themeId) {
      mutate((deck) => { deck.themeId = themeId; });
    },
    addText() {
      mutate((deck, st) => {
        const sl = deck.slides.find((s) => s.id === st.activeSlideId);
        if (!sl) return;
        const t: TextElement = {
          id: "el_" + Math.random().toString(36).slice(2, 9),
          type: "text",
          x: 400, y: 400, w: 1120, h: 200,
          html: "New text",
          fontSize: 48,
          color: getTheme(deck.themeId).fg,
        };
        sl.elements.push(t);
        store.set((s) => ({ ...s, selectedIds: [t.id] }));
      });
    },
    addShape(shape) {
      mutate((deck, st) => {
        const sl = deck.slides.find((s) => s.id === st.activeSlideId);
        if (!sl) return;
        const el = createShapeElement(shape, { fill: getTheme(deck.themeId).accent });
        sl.elements.push(el);
        store.set((s) => ({ ...s, selectedIds: [el.id] }));
      });
    },
    addImage(src) {
      mutate((deck, st) => {
        const sl = deck.slides.find((s) => s.id === st.activeSlideId);
        if (!sl) return;
        const el = createImageElement(src);
        sl.elements.push(el);
        store.set((s) => ({ ...s, selectedIds: [el.id] }));
      });
    },
    insertPlaceholder(key) {
      const token = `{{${key}}}`;
      mutate((deck, st) => {
        const sl = deck.slides.find((s) => s.id === st.activeSlideId);
        if (!sl) return;
        const sel = sl.elements.find((e) => st.selectedIds.includes(e.id) && e.type === "text") as TextElement | undefined;
        if (sel) {
          sel.html = (sel.html ?? "") + token;
        } else {
          const t: TextElement = {
            id: "el_" + Math.random().toString(36).slice(2, 9),
            type: "text",
            x: 400, y: 400, w: 1120, h: 200,
            html: token,
            fontSize: 48,
            color: getTheme(deck.themeId).fg,
          };
          sl.elements.push(t);
          store.set((s) => ({ ...s, selectedIds: [t.id] }));
        }
      });
    },
    updateElement(slideId, elId, patch) {
      mutate((deck) => {
        const sl = deck.slides.find((s) => s.id === slideId);
        if (!sl) return;
        const e = sl.elements.find((x) => x.id === elId);
        if (!e) return;
        Object.assign(e, patch);
      });
    },
    deleteSelected() {
      mutate((deck, st) => {
        const sl = deck.slides.find((s) => s.id === st.activeSlideId);
        if (!sl) return;
        sl.elements = sl.elements.filter((e) => !st.selectedIds.includes(e.id));
        store.set((s) => ({ ...s, selectedIds: [] }));
      });
    },
    bringForward() {
      mutate((deck, st) => {
        const sl = deck.slides.find((s) => s.id === st.activeSlideId);
        if (!sl) return;
        for (const id of st.selectedIds) {
          const i = sl.elements.findIndex((e) => e.id === id);
          if (i >= 0 && i < sl.elements.length - 1) {
            const [el] = sl.elements.splice(i, 1);
            sl.elements.splice(i + 1, 0, el);
          }
        }
      });
    },
    sendBackward() {
      mutate((deck, st) => {
        const sl = deck.slides.find((s) => s.id === st.activeSlideId);
        if (!sl) return;
        for (const id of st.selectedIds) {
          const i = sl.elements.findIndex((e) => e.id === id);
          if (i > 0) {
            const [el] = sl.elements.splice(i, 1);
            sl.elements.splice(i - 1, 0, el);
          }
        }
      });
    },
    bringToFront() {
      mutate((deck, st) => {
        const sl = deck.slides.find((s) => s.id === st.activeSlideId);
        if (!sl) return;
        const sel = sl.elements.filter((e) => st.selectedIds.includes(e.id));
        const rest = sl.elements.filter((e) => !st.selectedIds.includes(e.id));
        sl.elements = [...rest, ...sel];
      });
    },
    sendToBack() {
      mutate((deck, st) => {
        const sl = deck.slides.find((s) => s.id === st.activeSlideId);
        if (!sl) return;
        const sel = sl.elements.filter((e) => st.selectedIds.includes(e.id));
        const rest = sl.elements.filter((e) => !st.selectedIds.includes(e.id));
        sl.elements = [...sel, ...rest];
      });
    },
    setSelection(ids) {
      store.set((s) => ({ ...s, selectedIds: ids }));
    },
    alignSelected(kind) {
      mutate((deck, st) => {
        const sl = deck.slides.find((s) => s.id === st.activeSlideId);
        if (!sl) return;
        const els = sl.elements.filter((e) => st.selectedIds.includes(e.id));
        const patches = alignEls(els, kind);
        for (const e of sl.elements) {
          const p = patches.get(e.id);
          if (p) Object.assign(e, p);
        }
      });
    },
    distributeSelected(kind) {
      mutate((deck, st) => {
        const sl = deck.slides.find((s) => s.id === st.activeSlideId);
        if (!sl) return;
        const els = sl.elements.filter((e) => st.selectedIds.includes(e.id));
        const patches = distributeEls(els, kind);
        for (const e of sl.elements) {
          const p = patches.get(e.id);
          if (p) Object.assign(e, p);
        }
      });
    },
    copySelected() {
      const st = store.get();
      const sl = st.deck.slides.find((s) => s.id === st.activeSlideId);
      if (!sl) return;
      clipboard = sl.elements
        .filter((e) => st.selectedIds.includes(e.id))
        .map((e) => deepClone(e));
    },
    pasteElements() {
      if (!clipboard || clipboard.length === 0) return;
      const OFFSET = 40;
      mutate((deck, st) => {
        const sl = deck.slides.find((s) => s.id === st.activeSlideId);
        if (!sl) return;
        const newIds: string[] = [];
        for (const el of clipboard!) {
          const clone = deepClone(el);
          clone.id = "el_" + Math.random().toString(36).slice(2, 9);
          clone.x += OFFSET;
          clone.y += OFFSET;
          sl.elements.push(clone);
          newIds.push(clone.id);
        }
        store.set((s) => ({ ...s, selectedIds: newIds }));
      });
    },
    undo() {
      if (past.length === 0) return;
      const cur = deepClone(store.get().deck);
      const prev = past.pop()!;
      future.push(cur);
      store.set((s) => ({ ...s, deck: prev }));
      bump();
    },
    redo() {
      if (future.length === 0) return;
      const cur = deepClone(store.get().deck);
      const next = future.pop()!;
      past.push(cur);
      store.set((s) => ({ ...s, deck: next }));
      bump();
    },
    canUndo: () => past.length > 0,
    canRedo: () => future.length > 0,
    loadDeck(deck) {
      snapshot();
      store.set((s) => ({
        ...s,
        deck,
        activeSlideId: deck.slides[0]?.id ?? "",
        selectedIds: [],
      }));
      bump();
    },
    toJSON: () => JSON.stringify(store.get().deck, null, 2),
    snapshot,
  };
}
