import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import fs from 'node:fs';
import path from 'node:path';
import { CacheStore } from './cache.store';
import { CacheEntry, CacheKey } from './cache.types';
import { PrismaService } from '@/infrastructure/persistence/mysql/prisma.service';

const SNAPSHOT_KEY = 'main';

@Injectable()
export class CacheSnapshotService implements OnModuleInit {
  private readonly ttlMs = Number(process.env.CACHE_TTL_MS ?? '60000');
  private readonly snapshotPath =
    process.env.CACHE_SNAPSHOT_PATH ?? './cache/snapshots.json';
  private readonly logger = new Logger(CacheSnapshotService.name);

  constructor(
    private readonly store: CacheStore,
    private readonly prisma: PrismaService,
  ) {}

  async onModuleInit() {
    await this.loadSnapshotsOnBoot();
  }

  async loadSnapshotsOnBoot() {
    // Try MySQL first
    try {
      const row = await this.prisma.taCacheSnapshot.findUnique({
        where: { snapshotKey: SNAPSHOT_KEY },
      });
      if (row) {
        const raw = JSON.parse(row.data) as Record<string, CacheEntry<unknown>>;
        Object.keys(raw).forEach((key) =>
          this.store.setEntry(key as CacheKey, raw[key]),
        );
        this.logger.log('Cache snapshot loaded from DB.');
        return;
      }
    } catch (err) {
      this.logger.warn(`DB snapshot load failed, trying file: ${String(err)}`);
    }

    // Fallback: file
    if (!fs.existsSync(this.snapshotPath)) return;
    try {
      const raw = JSON.parse(
        fs.readFileSync(this.snapshotPath, 'utf8'),
      ) as Record<string, CacheEntry<unknown>>;
      Object.keys(raw).forEach((key) =>
        this.store.setEntry(key as CacheKey, raw[key]),
      );
      this.logger.log('Cache snapshot loaded from file.');
    } catch (err) {
      this.logger.warn(`Failed to load cache snapshot from file: ${String(err)}`);
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

  async readThrough<T>(key: CacheKey, loader: () => Promise<T>): Promise<T> {
    const entry = this.store.get<T>(key);
    if (!entry) {
      this.logger.debug(`${key} cache miss`);
      const fresh = await loader();
      this.refresh(key, fresh);
      return fresh;
    }

    const isStale = Date.now() - entry.updatedAt > this.ttlMs;
    if (!isStale) {
      this.logger.debug(`${key} cache hit fresh`);
      return entry.data;
    }

    this.logger.debug(`${key} cache stale refresh`);
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
    const json = JSON.stringify(obj);

    // Async DB persist (fire-and-forget)
    this.prisma.taCacheSnapshot
      .upsert({
        where: { snapshotKey: SNAPSHOT_KEY },
        create: { snapshotKey: SNAPSHOT_KEY, data: json },
        update: { data: json },
      })
      .catch((err) => this.logger.warn(`DB snapshot persist failed: ${String(err)}`));

    // File persist (local dev fallback)
    try {
      fs.mkdirSync(path.dirname(this.snapshotPath), { recursive: true });
      fs.writeFileSync(this.snapshotPath, json);
    } catch {
      // Non-critical in container environments
    }
  }
}
