import { Module } from '@nestjs/common';

import { MatchController } from './match.controller';

import { CreateMatchUseCase } from '@/application/match/use-cases/create-match.usecase';
import { GetAllMatchesUseCase } from '@/application/match/use-cases/get-all-matches.usecase';
import { GetMatchByIdUseCase } from '@/application/match/use-cases/get-match-by-id.usecase';
import { UpdateMatchUseCase } from '@/application/match/use-cases/update-match.usecase';
import { DeleteMatchUseCase } from '@/application/match/use-cases/delete-match.usecase';

import { MATCH_REPOSITORY } from '@/domain/match/repositories/match.repository';
import { InMemoryMatchRepository } from '@/infrastructure/persistence/memory/in-memory-match.repository';

// ⚠️ ATTENTION : quand tu créeras l’implémentation Prisma,
// remplace le InMemoryMatchRepository par PrismaMatchRepository.
// Pour l’instant on laisse un placeholder.
class PrismaMatchRepository {} // à remplacer plus tard

@Module({
  controllers: [MatchController],
  providers: [
    // Use Cases (Application Layer)
    CreateMatchUseCase,
    GetAllMatchesUseCase,
    GetMatchByIdUseCase,
    UpdateMatchUseCase,
    DeleteMatchUseCase,   // <-- AJOUTER CECI

    // Repository Injection
    {
      provide: MATCH_REPOSITORY,
      useClass: InMemoryMatchRepository,// sera remplacé par l’impl réelle
    },
  ],
})
export class MatchModule {}
