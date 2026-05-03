// @orbitoffice/core — minimal external store. Zero deps.
import { useSyncExternalStore } from "react";

export interface Store<T> {
  get: () => T;
  set: (next: T | ((s: T) => T)) => void;
  subscribe: (l: () => void) => () => void;
}

export function createStore<T>(initial: T): Store<T> {
  let state = initial;
  const listeners = new Set<() => void>();
  return {
    get: () => state,
    set: (next) => {
      const n = typeof next === "function" ? (next as (s: T) => T)(state) : next;
      if (n === state) return;
      state = n;
      listeners.forEach((l) => l());
    },
    subscribe: (l) => {
      listeners.add(l);
      return () => listeners.delete(l);
    },
  };
}

export function useStore<T, S = T>(store: Store<T>, selector?: (s: T) => S): S {
  return useSyncExternalStore(
    store.subscribe,
    () => (selector ? selector(store.get()) : (store.get() as unknown as S)),
    () => (selector ? selector(store.get()) : (store.get() as unknown as S)),
  );
}
