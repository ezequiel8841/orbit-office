// Tiny typed event bus.
export type EventMap = Record<string, unknown>;
export interface Bus<M extends EventMap> {
  on<K extends keyof M>(k: K, fn: (v: M[K]) => void): () => void;
  off<K extends keyof M>(k: K, fn: (v: M[K]) => void): void;
  emit<K extends keyof M>(k: K, v: M[K]): void;
  once<K extends keyof M>(k: K, fn: (v: M[K]) => void): void;
}
export function createBus<M extends EventMap>(): Bus<M> {
  const map = new Map<keyof M, Set<(v: unknown) => void>>();
  const get = (k: keyof M) => {
    let s = map.get(k);
    if (!s) map.set(k, (s = new Set()));
    return s;
  };
  return {
    on(k, fn) {
      const s = get(k);
      s.add(fn as (v: unknown) => void);
      return () => s.delete(fn as (v: unknown) => void);
    },
    off(k, fn) {
      get(k).delete(fn as (v: unknown) => void);
    },
    emit(k, v) {
      get(k).forEach((fn) => fn(v));
    },
    once(k, fn) {
      const off = this.on(k, (v) => {
        off();
        fn(v);
      });
    },
  };
}
