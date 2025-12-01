import { Module } from '@nestjs/common';
import { MatchModule } from './infrastructure/http/match/match.module';
import { PersistenceModule } from './infrastructure/persistence/persistence.module';
import { ClassementModule } from './infrastructure/http/classement/classement.module';

@Module({
  imports: [
    PersistenceModule,
    MatchModule,
    ClassementModule,
  ],
})
export class AppModule {}
