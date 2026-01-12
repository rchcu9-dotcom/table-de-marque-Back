import { Module } from '@nestjs/common';
import { MealsController } from './meals.controller';
import { GetMealsUseCase } from '@/application/meal/use-cases/get-meals.usecase';
import { PersistenceModule } from '@/infrastructure/persistence/persistence.module';
import { CacheModule } from '@/infrastructure/cache/cache.module';

@Module({
  imports: [PersistenceModule, CacheModule],
  controllers: [MealsController],
  providers: [GetMealsUseCase],
})
export class MealsModule {}
