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
import { ChallengeStreamController } from './challenge.stream.controller';
import { ChallengeCacheService } from '@/infrastructure/persistence/challenge-cache.service';
import { ChallengeStreamService } from '@/hooks/challenge-stream.service';
import { ChallengePollingService } from '@/hooks/challenge-polling.service';

@Module({
  imports: [PersistenceModule],
  controllers: [ChallengeController, ChallengeStreamController],
  providers: [
    GetAteliersUseCase,
    GetClassementAtelierUseCase,
    GetClassementGlobalUseCase,
    RecordTentativeUseCase,
    GetChallengeByEquipeUseCase,
    GetChallengeAllUseCase,
    ClassementService,
    ChallengeStreamService,
    ChallengeCacheService,
    ChallengePollingService,
  ],
})
export class ChallengeModule {}
