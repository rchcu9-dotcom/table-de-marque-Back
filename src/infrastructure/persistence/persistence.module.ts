import { Module } from '@nestjs/common';

import {
  MATCH_REPOSITORY,
  MATCH_REPOSITORY_SOURCE,
} from '@/domain/match/repositories/match.repository';
import { EQUIPE_REPOSITORY } from '@/domain/equipe/repositories/equipe.repository';
import { MEAL_REPOSITORY } from '@/domain/meal/repositories/meal.repository';
import { JOUEUR_REPOSITORY } from '@/domain/joueur/repositories/joueur.repository';
import { ATELIER_REPOSITORY } from '@/domain/challenge/repositories/atelier.repository';
import { TENTATIVE_ATELIER_REPOSITORY } from '@/domain/challenge/repositories/tentative-atelier.repository';
import { InMemoryMatchRepository } from './memory/in-memory-match.repository';
import { GoogleSheetsMatchRepository } from './google-sheets/google-sheets-match.repository';
import { GoogleSheetsPublicCsvMatchRepository } from './google-sheets/google-sheets-public-csv.repository';
import { GoogleSheetsPublicCsvEquipeRepository } from './google-sheets/google-sheets-public-csv-equipe.repository';
import { InMemoryEquipeRepository } from './memory/in-memory-equipe.repository';
import { InMemoryJoueurRepository } from './memory/in-memory-joueur.repository';
import { InMemoryMealRepository } from './memory/in-memory-meal.repository';
import { InMemoryAtelierRepository } from './memory/in-memory-atelier.repository';
import { InMemoryTentativeAtelierRepository } from './memory/in-memory-tentative-atelier.repository';
import { MatchCacheService } from './match-cache.service';
import { MatchPollingService } from '@/hooks/match-polling.service';
import { MatchStreamService } from '@/hooks/match-stream.service';
import { PrismaService } from './mysql/prisma.service';
import { MySqlMatchRepository } from './mysql/mysql-match.repository';
import { MySqlEquipeRepository } from './mysql/mysql-equipe.repository';
import { MySqlJoueurRepository } from './mysql/mysql-joueur.repository';
import { MySqlMealRepository } from './mysql/mysql-meal.repository';
import { MySqlAtelierRepository } from './mysql/mysql-atelier.repository';
import { MySqlTentativeAtelierRepository } from './mysql/mysql-tentative-atelier.repository';

type MatchRepoDriver =
  | 'google-sheets-public'
  | 'google-sheets'
  | 'memory'
  | 'prisma';

const baseMatchRepositoryProvider = {
  provide: MATCH_REPOSITORY_SOURCE,
  useFactory: (prisma: PrismaService) => {
    const raw = (process.env.MATCH_REPOSITORY_DRIVER ?? '')
      .trim()
      .toLowerCase();
    const driver: MatchRepoDriver =
      (raw as MatchRepoDriver) ||
      (process.env.GOOGLE_SHEETS_CSV_URL ? 'google-sheets-public' : 'memory');

    switch (driver) {
      case 'google-sheets-public':
        return new GoogleSheetsPublicCsvMatchRepository();
      case 'google-sheets':
        return new GoogleSheetsMatchRepository();
      case 'prisma':
        return new MySqlMatchRepository(prisma);
      case 'memory':
        return new InMemoryMatchRepository();
      default:
        return new InMemoryMatchRepository();
    }
  },
  inject: [PrismaService],
};

const cachedMatchRepositoryProvider = {
  provide: MATCH_REPOSITORY,
  useExisting: MatchCacheService,
};

const equipePersistenceProvider = {
  provide: EQUIPE_REPOSITORY,
  useFactory: (prisma: PrismaService) => {
    const driver =
      (process.env.EQUIPE_REPOSITORY_DRIVER ?? '').trim().toLowerCase() ||
      'google-sheets-public';

    if (driver === 'google-sheets-public') {
      return new GoogleSheetsPublicCsvEquipeRepository();
    }

    if (driver === 'memory') {
      return new InMemoryEquipeRepository();
    }

    if (driver === 'prisma') {
      return new MySqlEquipeRepository(prisma);
    }

    throw new Error(`Unsupported EQUIPE_REPOSITORY_DRIVER: ${driver}`);
  },
  inject: [PrismaService],
};

const mealPersistenceProvider = {
  provide: MEAL_REPOSITORY,
  useFactory: (prisma: PrismaService) => {
    const driver =
      (process.env.MEALS_REPOSITORY_DRIVER ??
        process.env.EQUIPE_REPOSITORY_DRIVER ??
        '')
        .trim()
        .toLowerCase() || 'memory';
    if (driver === 'prisma') {
      return new MySqlMealRepository(prisma);
    }
    return new InMemoryMealRepository();
  },
  inject: [PrismaService],
};

const joueurPersistenceProvider = {
  provide: JOUEUR_REPOSITORY,
  useFactory: (prisma: PrismaService) => {
    const driver =
      (process.env.JOUEUR_REPOSITORY_DRIVER ?? '').trim().toLowerCase() ||
      'memory';
    if (driver === 'prisma') {
      return new MySqlJoueurRepository(prisma);
    }
    return new InMemoryJoueurRepository();
  },
  inject: [PrismaService],
};

const atelierPersistenceProvider = {
  provide: ATELIER_REPOSITORY,
  useFactory: () => {
    const driver =
      (process.env.ATELIER_REPOSITORY_DRIVER ?? '').trim().toLowerCase() ||
      'memory';
    if (driver === 'prisma') {
      return new MySqlAtelierRepository();
    }
    return new InMemoryAtelierRepository();
  },
};

const tentativeAtelierPersistenceProvider = {
  provide: TENTATIVE_ATELIER_REPOSITORY,
  useFactory: (prisma: PrismaService) => {
    const driver =
      (process.env.TENTATIVE_ATELIER_REPOSITORY_DRIVER ?? '')
        .trim()
        .toLowerCase() || 'memory';
    if (driver === 'prisma') {
      return new MySqlTentativeAtelierRepository(prisma);
    }
    return new InMemoryTentativeAtelierRepository();
  },
  inject: [PrismaService],
};

@Module({
  providers: [
    PrismaService,
    baseMatchRepositoryProvider,
    MatchStreamService,
    MatchCacheService,
    cachedMatchRepositoryProvider,
    MatchPollingService,
    equipePersistenceProvider,
    mealPersistenceProvider,
    joueurPersistenceProvider,
    atelierPersistenceProvider,
    tentativeAtelierPersistenceProvider,
  ],
  exports: [
    MATCH_REPOSITORY,
    EQUIPE_REPOSITORY,
    MEAL_REPOSITORY,
    JOUEUR_REPOSITORY,
    ATELIER_REPOSITORY,
    TENTATIVE_ATELIER_REPOSITORY,
    MatchStreamService,
  ],
})
export class PersistenceModule {}
