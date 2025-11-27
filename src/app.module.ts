import { Module } from '@nestjs/common';
import { MatchModule } from './infrastructure/http/match/match.module';
import { PersistenceModule } from './infrastructure/persistence/persistence.module';

@Module({
  imports: [
    PersistenceModule,  // 👈 active l’in-memory
    MatchModule,        // 👈 ton module HTTP existant
  ],
})
export class AppModule {}
