import { Inject, Injectable, Logger, Optional } from '@nestjs/common';
import { createHash } from 'node:crypto';

import { Match } from '@/domain/match/entities/match.entity';
import {
  MATCH_REPOSITORY_SOURCE,
  MatchRepository,
} from '@/domain/match/repositories/match.repository';
import { MatchStreamService } from '@/hooks/match-stream.service';

type RefreshDiff = {
  changed: boolean;
  added: string[];
  updated: string[];
  removed: string[];
  fetched: number;
  timestamp: number;
};

@Injectable()
export class MatchCacheService implements MatchRepository {
  private cache: Match[] = [];
  private lastHash?: string;
  private lastUpdated?: number;
  private readonly logger = new Logger(MatchCacheService.name);
  private refreshPromise?: Promise<RefreshDiff>;

  constructor(
    @Inject(MATCH_REPOSITORY_SOURCE)
    private readonly source: MatchRepository,
    @Optional()
    private readonly stream?: MatchStreamService,
  ) {}

  async findAll(): Promise<Match[]> {
    if (!this.cache.length) {
      await this.refresh(true);
    }
    return this.cloneMatches(this.cache);
  }

  async findById(id: string): Promise<Match | null> {
    if (!this.cache.length) {
      await this.refresh(true);
    }
    const found = this.cache.find((m) => m.id === id);
    return found ? { ...found, date: new Date(found.date) } : null;
  }

  async create(match: Match): Promise<Match> {
    const created = await this.source.create(match);
    await this.refresh(true);
    return created;
  }

  async update(match: Match): Promise<Match> {
    const updated = await this.source.update(match);
    await this.refresh(true);
    return updated;
  }

  async delete(id: string): Promise<void> {
    await this.source.delete(id);
    await this.refresh(true);
  }

  async refresh(force = false): Promise<RefreshDiff> {
    if (this.refreshPromise) {
      return this.refreshPromise;
    }
    this.refreshPromise = this.performRefresh(force).finally(() => {
      this.refreshPromise = undefined;
    });
    return this.refreshPromise;
  }

  getMetadata() {
    return {
      lastUpdated: this.lastUpdated ?? null,
      cacheSize: this.cache.length,
      lastHash: this.lastHash ?? null,
    };
  }

  private async performRefresh(force: boolean): Promise<RefreshDiff> {
    const next = await this.source.findAll();
    const normalizedNext = this.normalize(next);
    const hash = this.computeHash(normalizedNext);

    if (!force && this.lastHash && this.lastHash === hash) {
      return {
        changed: false,
        added: [],
        updated: [],
        removed: [],
        fetched: normalizedNext.length,
        timestamp: this.lastUpdated ?? Date.now(),
      };
    }

    const prev = this.cache;
    const diff = this.computeDiff(prev, normalizedNext);

    this.cache = normalizedNext;
    this.lastHash = hash;
    this.lastUpdated = Date.now();

    if (diff.changed) {
      this.logger.log(
        `Match cache refreshed (+${diff.added.length}, ~${diff.updated.length}, -${diff.removed.length})`,
      );
      this.logger.debug(`Hash=${hash}`);
      this.logDiffDetails(prev, normalizedNext, diff);
    }

    const shouldEmit = force || diff.changed;
    if (this.stream && shouldEmit) {
      this.stream.emit({
        type: 'matches',
        diff,
        matches: this.cloneMatches(this.cache),
        timestamp: this.lastUpdated,
      });
    }

    return {
      ...diff,
      fetched: normalizedNext.length,
      timestamp: this.lastUpdated,
    };
  }

  private logDiffDetails(prev: Match[], next: Match[], diff: Omit<RefreshDiff, 'fetched' | 'timestamp'>) {
    const prevMap = new Map(prev.map((m) => [m.id, m]));
    const nextMap = new Map(next.map((m) => [m.id, m]));

    const updatedSamples = diff.updated.slice(0, 3).map((id) => {
      const before = prevMap.get(id);
      const after = nextMap.get(id);
      return {
        id,
        before: before
          ? { scoreA: before.scoreA, scoreB: before.scoreB, status: before.status }
          : null,
        after: after
          ? { scoreA: after.scoreA, scoreB: after.scoreB, status: after.status }
          : null,
      };
    });

    const addedSamples = diff.added.slice(0, 3);
    const removedSamples = diff.removed.slice(0, 3);

    this.logger.debug(
      `Diff details: updated=${JSON.stringify(updatedSamples)}, added=${JSON.stringify(addedSamples)}, removed=${JSON.stringify(removedSamples)}`,
    );
  }

  private computeDiff(prev: Match[], next: Match[]): Omit<RefreshDiff, 'fetched' | 'timestamp'> {
    const prevMap = new Map(prev.map((m) => [m.id, m]));
    const nextMap = new Map(next.map((m) => [m.id, m]));

    const added: string[] = [];
    const updated: string[] = [];
    const removed: string[] = [];

    nextMap.forEach((match, id) => {
      const existing = prevMap.get(id);
      if (!existing) {
        added.push(id);
        return;
      }
      if (!this.matchesAreEqual(existing, match)) {
        updated.push(id);
      }
    });

    prevMap.forEach((_match, id) => {
      if (!nextMap.has(id)) {
        removed.push(id);
      }
    });

    return {
      changed: added.length > 0 || updated.length > 0 || removed.length > 0,
      added,
      updated,
      removed,
    };
  }

  private matchesAreEqual(a: Match, b: Match): boolean {
    return (
      a.id === b.id &&
      new Date(a.date).getTime() === new Date(b.date).getTime() &&
      a.teamA === b.teamA &&
      a.teamB === b.teamB &&
      a.status === b.status &&
      a.scoreA === b.scoreA &&
      a.scoreB === b.scoreB &&
      (a.teamALogo ?? null) === (b.teamALogo ?? null) &&
      (a.teamBLogo ?? null) === (b.teamBLogo ?? null) &&
      (a.pouleCode ?? null) === (b.pouleCode ?? null) &&
      (a.pouleName ?? null) === (b.pouleName ?? null)
    );
  }

  private normalize(matches: Match[]): Match[] {
    return matches.map(
      (m) =>
        new Match(
          m.id,
          new Date(m.date),
          m.teamA,
          m.teamB,
          m.status,
          m.scoreA ?? null,
          m.scoreB ?? null,
          m.teamALogo ?? null,
          m.teamBLogo ?? null,
          m.pouleCode ?? null,
          m.pouleName ?? null,
        ),
    );
  }

  private cloneMatches(matches: Match[]): Match[] {
    return matches.map(
      (m) =>
        new Match(
          m.id,
          new Date(m.date),
          m.teamA,
          m.teamB,
          m.status,
          m.scoreA ?? null,
          m.scoreB ?? null,
          m.teamALogo ?? null,
          m.teamBLogo ?? null,
          m.pouleCode ?? null,
          m.pouleName ?? null,
        ),
    );
  }

  private computeHash(matches: Match[]): string {
    const ordered = [...matches].sort((a, b) => a.id.localeCompare(b.id));
    const plain = ordered.map((m) => ({
      id: m.id,
      date: new Date(m.date).toISOString(),
      teamA: m.teamA,
      teamB: m.teamB,
      status: m.status,
      scoreA: m.scoreA,
      scoreB: m.scoreB,
      teamALogo: m.teamALogo ?? null,
      teamBLogo: m.teamBLogo ?? null,
      pouleCode: m.pouleCode ?? null,
      pouleName: m.pouleName ?? null,
    }));
    return createHash('sha256').update(JSON.stringify(plain)).digest('hex');
  }
}
