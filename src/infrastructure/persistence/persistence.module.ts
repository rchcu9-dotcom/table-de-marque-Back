import { Module } from '@nestjs/common';

import { MATCH_REPOSITORY } from '@/domain/match/repositories/match.repository';
import { InMemoryMatchRepository } from './memory/in-memory-match.repository';
import { GoogleSheetsMatchRepository } from './google-sheets/google-sheets-match.repository';
import { GoogleSheetsPublicCsvMatchRepository } from './google-sheets/google-sheets-public-csv.repository';

const persistenceProvider = {
  provide: MATCH_REPOSITORY,
  useFactory: () => {
    const driver = (process.env.MATCH_REPOSITORY_DRIVER ?? 'memory')
      .trim()
      .toLowerCase();

    if (driver === 'google-sheets-public') {
      return new GoogleSheetsPublicCsvMatchRepository();
    }

    if (driver === 'google-sheets') {
      return new GoogleSheetsMatchRepository();
    }

    return new InMemoryMatchRepository();
  },
};

@Module({
  providers: [persistenceProvider],
  exports: [MATCH_REPOSITORY],
})
export class PersistenceModule {}
