import { Module } from '@nestjs/common';

import { MatchController } from './match.controller';

import { CreateMatchUseCase } from '@/application/match/use-cases/create-match.usecase.ts';
import { GetAllMatchesUseCase } from '@/application/match/use-cases/get-all-matches.usecase.ts';
import { GetMatchByIdUseCase } from '@/application/match/use-cases/get-match-by-id.usecase.ts';
import { UpdateMatchUseCase } from '@/application/match/use-cases/update-match.usecase.ts';
import { DeleteMatchUseCase } from '@/application/match/use-cases/delete-match.usecase.ts';

import { MATCH_REPOSITORY } from '@/domain/match/repositories/match.repository';

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
      useClass: PrismaMatchRepository, // sera remplacé par l’impl réelle
    },
  ],
})
export class MatchModule {}
