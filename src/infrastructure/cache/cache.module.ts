import { Inject, Injectable, Module, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { CacheStore } from './cache.store';
import { CacheSnapshotService } from './cache.snapshot.service';
import { PersistenceModule } from '@/infrastructure/persistence/persistence.module';
import {
  MatchRepository,
  MATCH_REPOSITORY,
} from '@/domain/match/repositories/match.repository';
import {
  EquipeRepository,
  EQUIPE_REPOSITORY,
} from '@/domain/equipe/repositories/equipe.repository';

@Injectable()
export class CacheWarmupService implements OnModuleInit, OnModuleDestroy {
  private timer?: NodeJS.Timeout;

  constructor(
    private readonly cache: CacheSnapshotService,
    @Inject(MATCH_REPOSITORY) private readonly matchRepo: MatchRepository,
    @Inject(EQUIPE_REPOSITORY) private readonly equipeRepo: EquipeRepository,
  ) {}

  onModuleInit() {
    const enabled =
      (process.env.CACHE_WARMUP_ENABLED ?? '').trim().toLowerCase() === 'true';
    if (!enabled) return;
    const intervalMs = Number(
      process.env.CACHE_WARMUP_INTERVAL_MS ?? '300000',
    );
    this.runWarmup();
    this.timer = setInterval(() => this.runWarmup(), intervalMs);
  }

  onModuleDestroy() {
    if (this.timer) clearInterval(this.timer);
  }

  private async runWarmup() {
    await this.cache.staleWhileRevalidate('matches', () =>
      this.matchRepo.findAll(),
    );
    const equipes = await this.cache.staleWhileRevalidate('equipes', () =>
      this.equipeRepo.findAllEquipes(),
    );
    const byCode: Record<string, any> = {};
    equipes.forEach((eq) => {
      const code = eq.pouleCode ?? '';
      if (code) byCode[code] = null;
    });
    for (const code of Object.keys(byCode)) {
      const classement = await this.equipeRepo.findClassementByPoule(code);
      if (classement) byCode[code] = classement;
    }
    if (Object.keys(byCode).length > 0) {
      this.cache.setEntry('classement', byCode);
    }
  }
}

@Module({
  imports: [PersistenceModule],
  providers: [CacheStore, CacheSnapshotService, CacheWarmupService],
  exports: [CacheSnapshotService],
})
export class CacheModule {}
