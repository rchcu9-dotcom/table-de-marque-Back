import { Module } from '@nestjs/common';

import { PersistenceModule } from '@/infrastructure/persistence/persistence.module';
import { ClassementController } from './classement.controller';
import { GetClassementByPouleUseCase } from '@/application/equipe/use-cases/get-classement-by-poule.usecase';
import { GetClassementByMatchUseCase } from '@/application/equipe/use-cases/get-classement-by-match.usecase';

@Module({
  imports: [PersistenceModule],
  controllers: [ClassementController],
  providers: [GetClassementByPouleUseCase, GetClassementByMatchUseCase],
})
export class ClassementModule {}
