import { Module } from '@nestjs/common';

import { MATCH_REPOSITORY, MATCH_REPOSITORY_SOURCE } from '@/domain/match/repositories/match.repository';
import {
  EQUIPE_REPOSITORY,
} from '@/domain/equipe/repositories/equipe.repository';
import { JOUEUR_REPOSITORY } from '@/domain/joueur/repositories/joueur.repository';
import { ATELIER_REPOSITORY } from '@/domain/challenge/repositories/atelier.repository';
import { TENTATIVE_ATELIER_REPOSITORY } from '@/domain/challenge/repositories/tentative-atelier.repository';
import { InMemoryMatchRepository } from './memory/in-memory-match.repository';
import { GoogleSheetsMatchRepository } from './google-sheets/google-sheets-match.repository';
import { GoogleSheetsPublicCsvMatchRepository } from './google-sheets/google-sheets-public-csv.repository';
import { GoogleSheetsPublicCsvEquipeRepository } from './google-sheets/google-sheets-public-csv-equipe.repository';
import { InMemoryEquipeRepository } from './memory/in-memory-equipe.repository';
import { InMemoryJoueurRepository } from './memory/in-memory-joueur.repository';
import { InMemoryAtelierRepository } from './memory/in-memory-atelier.repository';
import { InMemoryTentativeAtelierRepository } from './memory/in-memory-tentative-atelier.repository';
import { MatchCacheService } from './match-cache.service';
import { MatchPollingService } from '@/hooks/match-polling.service';
import { MatchStreamService } from '@/hooks/match-stream.service';

const baseMatchRepositoryProvider = {
  provide: MATCH_REPOSITORY_SOURCE,
  useFactory: () => {
    const envDriver = (process.env.MATCH_REPOSITORY_DRIVER ?? '')
      .trim()
      .toLowerCase();

    const driver =
      envDriver ||
      (process.env.GOOGLE_SHEETS_CSV_URL ? 'google-sheets-public' : 'memory');

    if (driver === 'google-sheets-public') {
      return new GoogleSheetsPublicCsvMatchRepository();
    }

    if (driver === 'google-sheets') {
      return new GoogleSheetsMatchRepository();
    }

    return new InMemoryMatchRepository();
  },
};

const cachedMatchRepositoryProvider = {
  provide: MATCH_REPOSITORY,
  useExisting: MatchCacheService,
};

const equipePersistenceProvider = {
  provide: EQUIPE_REPOSITORY,
  useFactory: () => {
    const driver =
      (process.env.EQUIPE_REPOSITORY_DRIVER ?? '').trim().toLowerCase() ||
      'google-sheets-public';

    if (driver === 'google-sheets-public') {
      return new GoogleSheetsPublicCsvEquipeRepository();
    }

    if (driver === 'memory') {
      return new InMemoryEquipeRepository();
    }

    throw new Error(`Unsupported EQUIPE_REPOSITORY_DRIVER: ${driver}`);
  },
};

const joueurPersistenceProvider = {
  provide: JOUEUR_REPOSITORY,
  useFactory: () => new InMemoryJoueurRepository(),
};

const atelierPersistenceProvider = {
  provide: ATELIER_REPOSITORY,
  useFactory: () => new InMemoryAtelierRepository(),
};

const tentativeAtelierPersistenceProvider = {
  provide: TENTATIVE_ATELIER_REPOSITORY,
  useFactory: () => new InMemoryTentativeAtelierRepository(),
};

@Module({
  providers: [
    baseMatchRepositoryProvider,
    MatchStreamService,
    MatchCacheService,
    cachedMatchRepositoryProvider,
    MatchPollingService,
    equipePersistenceProvider,
    joueurPersistenceProvider,
    atelierPersistenceProvider,
    tentativeAtelierPersistenceProvider,
  ],
  exports: [
    MATCH_REPOSITORY,
    EQUIPE_REPOSITORY,
    JOUEUR_REPOSITORY,
    ATELIER_REPOSITORY,
    TENTATIVE_ATELIER_REPOSITORY,
    MatchStreamService,
  ],
})
export class PersistenceModule {}
