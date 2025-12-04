import { Module } from '@nestjs/common';

import { MatchController } from './match.controller';

import { CreateMatchUseCase } from '@/application/match/use-cases/create-match.usecase';
import { GetAllMatchesUseCase } from '@/application/match/use-cases/get-all-matches.usecase';
import { GetMatchByIdUseCase } from '@/application/match/use-cases/get-match-by-id.usecase';
import { UpdateMatchUseCase } from '@/application/match/use-cases/update-match.usecase';
import { DeleteMatchUseCase } from '@/application/match/use-cases/delete-match.usecase';
import { GetMomentumMatchesUseCase } from '@/application/match/use-cases/get-momentum-matches.usecase';
import { PersistenceModule } from '@/infrastructure/persistence/persistence.module';

@Module({
  imports: [PersistenceModule],
  controllers: [MatchController],
  providers: [
    CreateMatchUseCase,
    GetAllMatchesUseCase,
    GetMatchByIdUseCase,
    UpdateMatchUseCase,
    DeleteMatchUseCase,
    GetMomentumMatchesUseCase,
  ],
})
export class MatchModule {}
