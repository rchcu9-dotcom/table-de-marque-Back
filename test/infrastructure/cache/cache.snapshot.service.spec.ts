import { CacheStore } from '@/infrastructure/cache/cache.store';
import { CacheSnapshotService } from '@/infrastructure/cache/cache.snapshot.service';

jest.mock('node:fs', () => ({
  existsSync: jest.fn(() => false),
  readFileSync: jest.fn(() => '{}'),
  mkdirSync: jest.fn(),
  writeFileSync: jest.fn(),
}));

describe('CacheSnapshotService.readThrough', () => {
  const envBackup = { ...process.env };

  beforeEach(() => {
    jest.clearAllMocks();
    process.env = {
      ...envBackup,
      CACHE_TTL_MS: '1000',
      CACHE_SNAPSHOT_PATH: './cache/test-snapshots.json',
    };
  });

  afterAll(() => {
    process.env = envBackup;
  });

  it('calls loader on miss and returns fresh data', async () => {
    const service = new CacheSnapshotService(new CacheStore());
    const loader = jest.fn().mockResolvedValue({ value: 'fresh' });

    const result = await service.readThrough('j3carres', loader);

    expect(loader).toHaveBeenCalledTimes(1);
    expect(result).toEqual({ value: 'fresh' });
    expect(service.getEntry<{ value: string }>('j3carres')?.data).toEqual({
      value: 'fresh',
    });
  });

  it('does not call loader on fresh hit', async () => {
    const store = new CacheStore();
    store.setEntry('j3carres', { data: { value: 'cached' }, updatedAt: Date.now() });
    const service = new CacheSnapshotService(store);
    const loader = jest.fn().mockResolvedValue({ value: 'fresh' });

    const result = await service.readThrough('j3carres', loader);

    expect(loader).not.toHaveBeenCalled();
    expect(result).toEqual({ value: 'cached' });
  });

  it('calls loader on stale hit and returns fresh data (not stale-first)', async () => {
    const store = new CacheStore();
    store.setEntry('j3carres', {
      data: { value: 'stale' },
      updatedAt: Date.now() - 5000,
    });
    const service = new CacheSnapshotService(store);
    const loader = jest.fn().mockResolvedValue({ value: 'fresh' });

    const result = await service.readThrough('j3carres', loader);

    expect(loader).toHaveBeenCalledTimes(1);
    expect(result).toEqual({ value: 'fresh' });
    expect(service.getEntry<{ value: string }>('j3carres')?.data).toEqual({
      value: 'fresh',
    });
  });
});
