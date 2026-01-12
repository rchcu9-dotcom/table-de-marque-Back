import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import fs from 'node:fs';
import path from 'node:path';
import { CacheStore } from './cache.store';
import { CacheEntry, CacheKey } from './cache.types';

@Injectable()
export class CacheSnapshotService implements OnModuleInit {
  private readonly ttlMs = Number(process.env.CACHE_TTL_MS ?? '60000');
  private readonly snapshotPath =
    process.env.CACHE_SNAPSHOT_PATH ?? './cache/snapshots.json';
  private readonly logger = new Logger(CacheSnapshotService.name);

  constructor(private readonly store: CacheStore) {}

  onModuleInit() {
    this.loadSnapshotsOnBoot();
  }

  loadSnapshotsOnBoot() {
    if (!fs.existsSync(this.snapshotPath)) return;
    try {
      const raw = JSON.parse(
        fs.readFileSync(this.snapshotPath, 'utf8'),
      ) as Record<string, CacheEntry<unknown>>;
      Object.keys(raw).forEach((key) =>
        this.store.setEntry(key as CacheKey, raw[key]),
      );
      this.logger.log('Cache snapshot loaded.');
    } catch (err) {
      this.logger.warn(`Failed to load cache snapshot: ${String(err)}`);
    }
  }

  getEntry<T>(key: CacheKey): CacheEntry<T> | null {
    return this.store.get<T>(key);
  }

  isStale(entry: CacheEntry<unknown> | null): boolean {
    if (!entry) return true;
    return Date.now() - entry.updatedAt > this.ttlMs;
  }

  async staleWhileRevalidate<T>(
    key: CacheKey,
    loader: () => Promise<T>,
  ): Promise<T> {
    const entry = this.store.get<T>(key);
    if (entry) {
      const isStale = Date.now() - entry.updatedAt > this.ttlMs;
      if (isStale) {
        loader()
          .then((fresh) => this.refresh(key, fresh))
          .catch((err) => this.logger.warn(err));
      }
      return entry.data;
    }
    const fresh = await loader();
    this.refresh(key, fresh);
    return fresh;
  }

  setEntry<T>(key: CacheKey, data: T) {
    this.store.set(key, data);
    this.persist();
  }

  private refresh<T>(key: CacheKey, data: T) {
    this.store.set(key, data);
    this.persist();
  }

  private persist() {
    const obj: Record<string, CacheEntry<unknown>> = {};
    for (const [k, v] of this.store.entries()) obj[k] = v;
    fs.mkdirSync(path.dirname(this.snapshotPath), { recursive: true });
    fs.writeFileSync(this.snapshotPath, JSON.stringify(obj));
  }
}
