import { CacheEntry, CacheKey } from './cache.types';

export class CacheStore {
  private store = new Map<CacheKey, CacheEntry<any>>();

  get<T>(key: CacheKey): CacheEntry<T> | null {
    return this.store.get(key) ?? null;
  }

  set<T>(key: CacheKey, data: T) {
    this.store.set(key, { data, updatedAt: Date.now() });
  }

  setEntry<T>(key: CacheKey, entry: CacheEntry<T>) {
    this.store.set(key, entry);
  }

  entries() {
    return this.store.entries();
  }
}
