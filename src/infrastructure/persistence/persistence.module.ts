import { Module } from '@nestjs/common';

import { MATCH_REPOSITORY } from '@/domain/match/repositories/match.repository';
import {
  EQUIPE_REPOSITORY,
} from '@/domain/equipe/repositories/equipe.repository';
import { InMemoryMatchRepository } from './memory/in-memory-match.repository';
import { GoogleSheetsMatchRepository } from './google-sheets/google-sheets-match.repository';
import { GoogleSheetsPublicCsvMatchRepository } from './google-sheets/google-sheets-public-csv.repository';
import { GoogleSheetsPublicCsvEquipeRepository } from './google-sheets/google-sheets-public-csv-equipe.repository';

const persistenceProvider = {
  provide: MATCH_REPOSITORY,
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
  providers: [persistenceProvider, equipePersistenceProvider],
  exports: [MATCH_REPOSITORY, EQUIPE_REPOSITORY],
})
export class PersistenceModule {}
