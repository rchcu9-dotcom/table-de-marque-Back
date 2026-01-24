import { Inject, Injectable, Logger, Optional } from '@nestjs/common';
import { createHash } from 'node:crypto';

import { Atelier } from '@/domain/challenge/entities/atelier.entity';
import { ClassementEntry } from '@/domain/challenge/services/classement.service';
import { ChallengeStreamService } from '@/hooks/challenge-stream.service';
import {
  GetAteliersUseCase,
} from '@/application/challenge/use-cases/get-ateliers.usecase';
import {
  GetChallengeAllUseCase,
  ChallengeAllResponse,
} from '@/application/challenge/use-cases/get-challenge-all.usecase';
import {
  GetClassementAtelierUseCase,
} from '@/application/challenge/use-cases/get-classement-atelier.usecase';
import {
  GetClassementGlobalUseCase,
  ClassementGlobalEntry,
} from '@/application/challenge/use-cases/get-classement-global.usecase';
import {
  GetChallengeVitesseJ3UseCase,
  ChallengeVitesseJ3Response,
} from '@/application/challenge/use-cases/get-challenge-vitesse-j3.usecase';

export type ChallengeSnapshot = {
  all: ChallengeAllResponse;
  ateliers: Atelier[];
  classementGlobal: ClassementGlobalEntry[];
  classementByAtelier: Record<string, ClassementEntry[]>;
  vitesseJ3: ChallengeVitesseJ3Response;
};

type ChallengeDiff = {
  changed: boolean;
  added: string[];
  updated: string[];
  removed: string[];
  fetched: number;
  timestamp: number;
};

@Injectable()
export class ChallengeCacheService {
  private cache: ChallengeSnapshot | null = null;
  private lastHash?: string;
  private lastUpdated?: number;
  private readonly logger = new Logger(ChallengeCacheService.name);
  private refreshPromise?: Promise<ChallengeDiff>;

  constructor(
    private readonly getChallengeAll: GetChallengeAllUseCase,
    private readonly getAteliers: GetAteliersUseCase,
    private readonly getClassementAtelier: GetClassementAtelierUseCase,
    private readonly getClassementGlobal: GetClassementGlobalUseCase,
    private readonly getChallengeVitesseJ3: GetChallengeVitesseJ3UseCase,
    @Optional()
    private readonly stream?: ChallengeStreamService,
  ) {}

  async getSnapshot(): Promise<ChallengeSnapshot> {
    if (!this.cache) {
      await this.refresh(true);
    }
    return this.cache!;
  }

  async refresh(force = false): Promise<ChallengeDiff> {
    if (this.refreshPromise) {
      return this.refreshPromise;
    }
    this.refreshPromise = this.performRefresh(force).finally(() => {
      this.refreshPromise = undefined;
    });
    return this.refreshPromise;
  }

  private async performRefresh(force: boolean): Promise<ChallengeDiff> {
    const snapshot = await this.buildSnapshot();
    const hash = this.computeHash(snapshot);

    if (!force && this.lastHash && this.lastHash === hash) {
      return {
        changed: false,
        added: [],
        updated: [],
        removed: [],
        fetched: this.countAttempts(snapshot),
        timestamp: this.lastUpdated ?? Date.now(),
      };
    }

    const prev = this.cache;
    const diff = this.computeDiff(prev, snapshot);

    if (!diff.changed && prev && this.lastHash && this.lastHash !== hash) {
      diff.changed = true;
      diff.updated.push('snapshot');
    }

    this.cache = snapshot;
    this.lastHash = hash;
    this.lastUpdated = Date.now();

    if (diff.changed) {
      this.logger.log(
        `Challenge cache refreshed (+${diff.added.length}, ~${diff.updated.length}, -${diff.removed.length})`,
      );
    }

    if (this.stream && diff.changed) {
      this.stream.emit({
        type: 'challenge',
        diff,
        snapshot: this.cache,
        timestamp: this.lastUpdated,
      });
    }

    return {
      ...diff,
      fetched: this.countAttempts(snapshot),
      timestamp: this.lastUpdated,
    };
  }

  private async buildSnapshot(): Promise<ChallengeSnapshot> {
    const [all, ateliers, classementGlobal, vitesseJ3] = await Promise.all([
      this.getChallengeAll.execute(),
      this.getAteliers.execute(),
      this.getClassementGlobal.execute(),
      this.getChallengeVitesseJ3.execute(),
    ]);

    const classementByAtelierEntries = await Promise.all(
      ateliers.map(async (atelier) => [
        atelier.id,
        await this.getClassementAtelier.execute(atelier.id),
      ] as const),
    );

    return {
      all,
      ateliers,
      classementGlobal,
      classementByAtelier: Object.fromEntries(classementByAtelierEntries),
      vitesseJ3,
    };
  }

  private computeDiff(
    prev: ChallengeSnapshot | null,
    next: ChallengeSnapshot,
  ): Omit<ChallengeDiff, 'fetched' | 'timestamp'> {
    const prevMap = this.buildAttemptMap(prev?.all);
    const nextMap = this.buildAttemptMap(next.all);

    const added: string[] = [];
    const updated: string[] = [];
    const removed: string[] = [];

    nextMap.forEach((value, key) => {
      const existing = prevMap.get(key);
      if (!existing) {
        added.push(key);
        return;
      }
      if (existing !== value) {
        updated.push(key);
      }
    });

    prevMap.forEach((_value, key) => {
      if (!nextMap.has(key)) {
        removed.push(key);
      }
    });

    return {
      changed: added.length > 0 || updated.length > 0 || removed.length > 0,
      added,
      updated,
      removed,
    };
  }

  private buildAttemptMap(data?: ChallengeAllResponse | null) {
    const map = new Map<string, string>();
    if (!data) {
      return map;
    }
    const all = [...data.jour1, ...data.jour3, ...data.autres];
    all.forEach((attempt) => {
      const key = `${attempt.atelierId}:${attempt.joueurId}`;
      map.set(key, JSON.stringify(this.normalizeAttempt(attempt)));
    });
    return map;
  }

  private normalizeAttempt(attempt: ChallengeAllResponse['jour1'][number]) {
    return {
      joueurId: attempt.joueurId,
      joueurName: attempt.joueurName,
      equipeId: attempt.equipeId ?? null,
      equipeName: attempt.equipeName ?? null,
      atelierId: attempt.atelierId,
      atelierLabel: attempt.atelierLabel,
      atelierType: attempt.atelierType,
      phase: attempt.phase,
      metrics: attempt.metrics,
      attemptDate: attempt.attemptDate
        ? new Date(attempt.attemptDate).toISOString()
        : null,
    };
  }

  private countAttempts(snapshot: ChallengeSnapshot) {
    return (
      snapshot.all.jour1.length +
      snapshot.all.jour3.length +
      snapshot.all.autres.length
    );
  }

  private computeHash(snapshot: ChallengeSnapshot): string {
    const attempts = [
      ...snapshot.all.jour1,
      ...snapshot.all.jour3,
      ...snapshot.all.autres,
    ]
      .map((attempt) => this.normalizeAttempt(attempt))
      .sort((a, b) =>
        `${a.atelierId}:${a.joueurId}`.localeCompare(
          `${b.atelierId}:${b.joueurId}`,
        ),
      );

    const ateliers = [...snapshot.ateliers].sort((a, b) =>
      a.id.localeCompare(b.id),
    );

    const classementGlobal = [...snapshot.classementGlobal].sort((a, b) =>
      a.joueurId.localeCompare(b.joueurId),
    );

    const classementByAtelier = Object.fromEntries(
      Object.entries(snapshot.classementByAtelier)
        .sort(([a], [b]) => a.localeCompare(b))
        .map(([atelierId, entries]) => [
          atelierId,
          [...entries].sort(
            (a, b) =>
              a.ordre - b.ordre || a.joueurId.localeCompare(b.joueurId),
          ),
        ]),
    );

    const plain = {
      attempts,
      ateliers,
      classementGlobal,
      classementByAtelier,
      vitesseJ3: snapshot.vitesseJ3,
    };

    return createHash('sha256').update(JSON.stringify(plain)).digest('hex');
  }
}
