import { CacheStore } from '@/infrastructure/cache/cache.store';
import { CacheSnapshotService } from '@/infrastructure/cache/cache.snapshot.service';
import type { PrismaService } from '@/infrastructure/persistence/mysql/prisma.service';

jest.mock('node:fs', () => ({
  existsSync: jest.fn(() => false),
  readFileSync: jest.fn(() => '{}'),
  mkdirSync: jest.fn(),
  writeFileSync: jest.fn(),
}));

function makePrismaMock(): PrismaService {
  return {
    taCacheSnapshot: {
      upsert: jest.fn().mockResolvedValue({}),
      findUnique: jest.fn().mockResolvedValue(null),
    },
  } as unknown as PrismaService;
}

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
    const service = new CacheSnapshotService(new CacheStore(), makePrismaMock());
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
    const service = new CacheSnapshotService(store, makePrismaMock());
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
    const service = new CacheSnapshotService(store, makePrismaMock());
    const loader = jest.fn().mockResolvedValue({ value: 'fresh' });

    const result = await service.readThrough('j3carres', loader);

    expect(loader).toHaveBeenCalledTimes(1);
    expect(result).toEqual({ value: 'fresh' });
    expect(service.getEntry<{ value: string }>('j3carres')?.data).toEqual({
      value: 'fresh',
    });
  });
});
