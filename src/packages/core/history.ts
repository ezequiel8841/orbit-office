// Patch-based undo/redo with coalescing.
export interface Patch {
  redo: () => void;
  undo: () => void;
  tag?: string;
  ts: number;
}

export interface History {
  push: (p: Omit<Patch, "ts">) => void;
  undo: () => boolean;
  redo: () => boolean;
  canUndo: () => boolean;
  canRedo: () => boolean;
  clear: () => void;
}

export function createHistory(opts: { coalesceMs?: number; limit?: number } = {}): History {
  const coalesceMs = opts.coalesceMs ?? 500;
  const limit = opts.limit ?? 500;
  const past: Patch[] = [];
  const future: Patch[] = [];
  return {
    push(p) {
      const ts = Date.now();
      const last = past[past.length - 1];
      if (last && last.tag && last.tag === p.tag && ts - last.ts < coalesceMs) {
        // coalesce: keep original undo, replace redo
        const merged: Patch = { undo: last.undo, redo: p.redo, tag: p.tag, ts };
        past[past.length - 1] = merged;
      } else {
        past.push({ ...p, ts });
        if (past.length > limit) past.shift();
      }
      future.length = 0;
    },
    undo() {
      const p = past.pop();
      if (!p) return false;
      p.undo();
      future.push(p);
      return true;
    },
    redo() {
      const p = future.pop();
      if (!p) return false;
      p.redo();
      past.push(p);
      return true;
    },
    canUndo: () => past.length > 0,
    canRedo: () => future.length > 0,
    clear() {
      past.length = 0;
      future.length = 0;
    },
  };
}
