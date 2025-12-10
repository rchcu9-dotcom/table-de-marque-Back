import { Module } from '@nestjs/common';

import { MATCH_REPOSITORY, MATCH_REPOSITORY_SOURCE } from '@/domain/match/repositories/match.repository';
import {
  EQUIPE_REPOSITORY,
} from '@/domain/equipe/repositories/equipe.repository';
import { InMemoryMatchRepository } from './memory/in-memory-match.repository';
import { GoogleSheetsMatchRepository } from './google-sheets/google-sheets-match.repository';
import { GoogleSheetsPublicCsvMatchRepository } from './google-sheets/google-sheets-public-csv.repository';
import { GoogleSheetsPublicCsvEquipeRepository } from './google-sheets/google-sheets-public-csv-equipe.repository';
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

    throw new Error(`Unsupported EQUIPE_REPOSITORY_DRIVER: ${driver}`);
  },
};

@Module({
  providers: [
    baseMatchRepositoryProvider,
    MatchStreamService,
    MatchCacheService,
    cachedMatchRepositoryProvider,
    MatchPollingService,
    equipePersistenceProvider,
  ],
  exports: [MATCH_REPOSITORY, EQUIPE_REPOSITORY, MatchStreamService],
})
export class PersistenceModule {}
