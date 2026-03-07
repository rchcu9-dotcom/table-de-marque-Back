import { CacheStore } from '@/infrastructure/cache/cache.store';

describe('CacheStore', () => {
  it('returns null for a missing key', () => {
    const store = new CacheStore();
    expect(store.get('matches')).toBeNull();
  });

  it('stores and retrieves a value via set()', () => {
    const store = new CacheStore();
    const data = [{ id: '1' }];
    store.set('matches', data);
    const entry = store.get<typeof data>('matches');
    expect(entry).not.toBeNull();
    expect(entry!.data).toEqual(data);
    expect(entry!.updatedAt).toBeGreaterThan(0);
  });

  it('stores and retrieves a value via setEntry()', () => {
    const store = new CacheStore();
    const entry = { data: { name: 'test' }, updatedAt: 1234567890 };
    store.setEntry('equipes', entry);
    const retrieved = store.get<typeof entry.data>('equipes');
    expect(retrieved).toEqual(entry);
  });

  it('overwrites an existing entry on set()', () => {
    const store = new CacheStore();
    store.set('matches', [1, 2, 3]);
    store.set('matches', [4, 5, 6]);
    expect(store.get<number[]>('matches')!.data).toEqual([4, 5, 6]);
  });

  it('sets updatedAt to approximately Date.now() on set()', () => {
    const store = new CacheStore();
    const before = Date.now();
    store.set('matches', { foo: 'bar' });
    const after = Date.now();
    const entry = store.get('matches');
    expect(entry!.updatedAt).toBeGreaterThanOrEqual(before);
    expect(entry!.updatedAt).toBeLessThanOrEqual(after);
  });

  it('returns all entries via entries()', () => {
    const store = new CacheStore();
    store.set('matches', ['a']);
    store.set('equipes', ['b']);
    const keys = Array.from(store.entries()).map(([k]) => k);
    expect(keys).toContain('matches');
    expect(keys).toContain('equipes');
  });

  it('handles multiple independent keys without interference', () => {
    const store = new CacheStore();
    store.set('matches', 'matches-data');
    store.set('equipes', 'equipes-data');
    expect(store.get<string>('matches')!.data).toBe('matches-data');
    expect(store.get<string>('equipes')!.data).toBe('equipes-data');
  });
});
