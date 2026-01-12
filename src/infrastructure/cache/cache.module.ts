import {
  Inject,
  Injectable,
  Module,
  OnModuleDestroy,
  OnModuleInit,
} from '@nestjs/common';
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
import {
  MealRepository,
  MEAL_REPOSITORY,
} from '@/domain/meal/repositories/meal.repository';
import { buildMealsPayload } from '@/application/meal/meal.utils';

@Injectable()
export class CacheWarmupService implements OnModuleInit, OnModuleDestroy {
  private timer?: NodeJS.Timeout;

  constructor(
    private readonly cache: CacheSnapshotService,
    @Inject(MATCH_REPOSITORY) private readonly matchRepo: MatchRepository,
    @Inject(EQUIPE_REPOSITORY) private readonly equipeRepo: EquipeRepository,
    @Inject(MEAL_REPOSITORY) private readonly mealRepo: MealRepository,
  ) {}

  onModuleInit() {
    const enabled =
      (process.env.CACHE_WARMUP_ENABLED ?? '').trim().toLowerCase() === 'true';
    if (!enabled) return;
    const intervalMs = Number(process.env.CACHE_WARMUP_INTERVAL_MS ?? '300000');
    void this.runWarmup();
    this.timer = setInterval(() => {
      void this.runWarmup();
    }, intervalMs);
  }

  onModuleDestroy() {
    if (this.timer) clearInterval(this.timer);
  }

  private async runWarmup() {
    const matches = await this.cache.staleWhileRevalidate('matches', () =>
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

    const mealsSource = await this.mealRepo.findMeals();
    this.cache.setEntry(
      'meals',
      buildMealsPayload(mealsSource, matches, new Date()),
    );
  }
}

@Module({
  imports: [PersistenceModule],
  providers: [CacheStore, CacheSnapshotService, CacheWarmupService],
  exports: [CacheSnapshotService],
})
export class CacheModule {}
