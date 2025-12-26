import { Module } from '@nestjs/common';
import { ChallengeController } from './challenge.controller';
import { PersistenceModule } from '@/infrastructure/persistence/persistence.module';
import { GetAteliersUseCase } from '@/application/challenge/use-cases/get-ateliers.usecase';
import { GetClassementAtelierUseCase } from '@/application/challenge/use-cases/get-classement-atelier.usecase';
import { GetClassementGlobalUseCase } from '@/application/challenge/use-cases/get-classement-global.usecase';
import { RecordTentativeUseCase } from '@/application/challenge/use-cases/record-tentative.usecase';
import { ClassementService } from '@/domain/challenge/services/classement.service';
import { GetChallengeByEquipeUseCase } from '@/application/challenge/use-cases/get-challenge-by-equipe.usecase';
import { GetChallengeAllUseCase } from '@/application/challenge/use-cases/get-challenge-all.usecase';

@Module({
  imports: [PersistenceModule],
  controllers: [ChallengeController],
  providers: [
    GetAteliersUseCase,
    GetClassementAtelierUseCase,
    GetClassementGlobalUseCase,
    RecordTentativeUseCase,
    GetChallengeByEquipeUseCase,
    GetChallengeAllUseCase,
    ClassementService,
  ],
})
export class ChallengeModule {}
