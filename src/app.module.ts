import { Module } from '@nestjs/common';
import { APP_GUARD } from '@nestjs/core';
import { InscriptionModule } from './inscription/inscription.module';
import { MatchModule } from './infrastructure/http/match/match.module';
import { PersistenceModule } from './infrastructure/persistence/persistence.module';
import { ClassementModule } from './infrastructure/http/classement/classement.module';
import { ChallengeModule } from './infrastructure/http/challenge/challenge.module';
import { EquipeModule } from './infrastructure/http/equipe/equipe.module';
import { JoueurModule } from './infrastructure/http/joueur/joueur.module';
import { MealsModule } from './infrastructure/http/meals/meals.module';
import { ChallengeMockSeeder } from './hooks/challenge-mock.seeder';
import { MockScheduleSeeder } from './hooks/mock-schedule.seeder';
import { MockEquipeSeeder } from './hooks/mock-equipe.seeder';
import { CacheModule } from './infrastructure/cache/cache.module';
import { LiveModule } from './infrastructure/http/live/live.module';
import { HealthModule } from './health/health.module';
import { PartenaireModule } from './infrastructure/http/partenaire/partenaire.module';
import { PresentationModule } from './infrastructure/http/presentation/presentation.module';
import { TableDeMarqueModule } from './table-de-marque/infrastructure/http/table-de-marque.module';
import { PlanningModule } from './planning/infrastructure/http/planning.module';
import { AuthModule } from './auth/auth.module';
import { AuthGuard } from './auth/auth.guard';

@Module({
  imports: [
    AuthModule,
    InscriptionModule,
    CacheModule,
    PersistenceModule,
    MatchModule,
    ClassementModule,
    ChallengeModule,
    EquipeModule,
    JoueurModule,
    MealsModule,
    LiveModule,
    HealthModule,
    PartenaireModule,
    PresentationModule,
    TableDeMarqueModule,
    PlanningModule,
  ],
  providers: [
    // useExisting (pas useClass) : réutilise l'instance d'AuthGuard déjà construite
    // et exportée par AuthModule (@Global) — une nouvelle instance via useClass ne
    // pourrait pas résoudre JwtService, privé au scope d'AuthModule.
    { provide: APP_GUARD, useExisting: AuthGuard },
    ChallengeMockSeeder,
    MockScheduleSeeder,
    MockEquipeSeeder,
  ],
})
export class AppModule {}
