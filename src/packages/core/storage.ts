// @orbitoffice/core — StorageAdapter contract + memory + localStorage impls.

export interface StorageEntry { id: string; updatedAt: number }

export interface StorageAdapter<T = unknown> {
  load(id: string): Promise<T | null>;
  save(id: string, data: T): Promise<void>;
  delete(id: string): Promise<void>;
  list(): Promise<StorageEntry[]>;
}

export function memoryAdapter<T = unknown>(): StorageAdapter<T> {
  const map = new Map<string, { data: T; updatedAt: number }>();
  return {
    async load(id) { return map.get(id)?.data ?? null; },
    async save(id, data) { map.set(id, { data, updatedAt: Date.now() }); },
    async delete(id) { map.delete(id); },
    async list() {
      return [...map.entries()].map(([id, v]) => ({ id, updatedAt: v.updatedAt }));
    },
  };
}

export function localStorageAdapter<T = unknown>(prefix = "orbitoffice:"): StorageAdapter<T> {
  const k = (id: string) => prefix + id;
  const meta = prefix + "__meta__";
  const readMeta = (): Record<string, number> => {
    try { return JSON.parse(localStorage.getItem(meta) ?? "{}"); } catch { return {}; }
  };
  const writeMeta = (m: Record<string, number>) => {
    try { localStorage.setItem(meta, JSON.stringify(m)); } catch { /* ignore quota */ }
  };
  return {
    async load(id) {
      const raw = localStorage.getItem(k(id));
      if (raw == null) return null;
      try { return JSON.parse(raw) as T; } catch { return null; }
    },
    async save(id, data) {
      try {
        localStorage.setItem(k(id), JSON.stringify(data));
        const m = readMeta(); m[id] = Date.now(); writeMeta(m);
      } catch { /* quota / private mode — silent */ }
    },
    async delete(id) {
      localStorage.removeItem(k(id));
      const m = readMeta(); delete m[id]; writeMeta(m);
    },
    async list() {
      const m = readMeta();
      return Object.entries(m).map(([id, updatedAt]) => ({ id, updatedAt }));
    },
  };
}
