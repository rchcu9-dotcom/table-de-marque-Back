import { Controller, Get } from '@nestjs/common';
import { Public } from '@/auth/decorators/public.decorator';
import { GetMealsUseCase } from '@/application/meal/use-cases/get-meals.usecase';
import { CacheSnapshotService } from '@/infrastructure/cache/cache.snapshot.service';

@Controller('meals')
@Public()
export class MealsController {
  constructor(
    private readonly getMeals: GetMealsUseCase,
    private readonly cache: CacheSnapshotService,
  ) {}

  @Get()
  async list() {
    return this.cache.staleWhileRevalidate('meals', () =>
      this.getMeals.execute(),
    );
  }
}
