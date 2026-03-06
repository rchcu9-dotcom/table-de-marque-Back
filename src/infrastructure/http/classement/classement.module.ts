import { Module } from '@nestjs/common';

import { PersistenceModule } from '@/infrastructure/persistence/persistence.module';
import { ClassementController } from './classement.controller';
import { GetClassementByPouleUseCase } from '@/application/equipe/use-cases/get-classement-by-poule.usecase';
import { GetClassementByMatchUseCase } from '@/application/equipe/use-cases/get-classement-by-match.usecase';
import { GetJ3FinalSquaresUseCase } from '@/application/equipe/use-cases/get-j3-final-squares.usecase';
import { CacheModule } from '@/infrastructure/cache/cache.module';

@Module({
  imports: [PersistenceModule, CacheModule],
  controllers: [ClassementController],
  providers: [
    GetClassementByPouleUseCase,
    GetClassementByMatchUseCase,
    GetJ3FinalSquaresUseCase,
  ],
})
export class ClassementModule {}
