import { Module } from '@nestjs/common';
import { MatchModule } from './infrastructure/http/match/match.module';
import { PersistenceModule } from './infrastructure/persistence/persistence.module';
import { ClassementModule } from './infrastructure/http/classement/classement.module';
import { ChallengeModule } from './infrastructure/http/challenge/challenge.module';
import { EquipeModule } from './infrastructure/http/equipe/equipe.module';
import { JoueurModule } from './infrastructure/http/joueur/joueur.module';
import { ChallengeMockSeeder } from './hooks/challenge-mock.seeder';
import { MockScheduleSeeder } from './hooks/mock-schedule.seeder';
import { MockEquipeSeeder } from './hooks/mock-equipe.seeder';
import { CacheModule } from './infrastructure/cache/cache.module';

@Module({
  imports: [
    CacheModule,
    PersistenceModule,
    MatchModule,
    ClassementModule,
    ChallengeModule,
    EquipeModule,
    JoueurModule,
  ],
  providers: [ChallengeMockSeeder, MockScheduleSeeder, MockEquipeSeeder],
})
export class AppModule {}
