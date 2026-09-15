import { Module } from '@nestjs/common';
import { InscriptionModule } from '@/inscription/inscription.module';
import { PersistenceModule } from '@/infrastructure/persistence/persistence.module';
import { TableDeMarqueController } from './table-de-marque.controller';
import { TableDeMarquePrismaService } from '../persistence/table-de-marque-prisma.service';
import { PrismaMatchLiveRepository } from '../persistence/prisma-match-live.repository';
import { PrismaMatchButRepository } from '../persistence/prisma-match-but.repository';
import { PrismaMatchPenaliteRepository } from '../persistence/prisma-match-penalite.repository';
import { PrismaMatchTypePenaliteRepository } from '../persistence/prisma-match-type-penalite.repository';
import { MATCH_LIVE_REPOSITORY } from '../../domain/repositories/match-live.repository';
import { MATCH_BUT_REPOSITORY } from '../../domain/repositories/match-but.repository';
import { MATCH_PENALITE_REPOSITORY } from '../../domain/repositories/match-penalite.repository';
import { MATCH_TYPE_PENALITE_REPOSITORY } from '../../domain/repositories/match-type-penalite.repository';
import { MatchLiveEtatService } from '../../application/services/match-live-etat.service';
import { AnnoncerMatchUseCase } from '../../application/use-cases/annoncer-match.usecase';
import { DemarrerMatchUseCase } from '../../application/use-cases/demarrer-match.usecase';
import { PauserMatchUseCase } from '../../application/use-cases/pauser-match.usecase';
import { TerminerMatchUseCase } from '../../application/use-cases/terminer-match.usecase';
import { EditerChronoUseCase } from '../../application/use-cases/editer-chrono.usecase';
import { AjouterButUseCase } from '../../application/use-cases/ajouter-but.usecase';
import { SupprimerButUseCase } from '../../application/use-cases/supprimer-but.usecase';
import { AjouterPenaliteUseCase } from '../../application/use-cases/ajouter-penalite.usecase';
import { SupprimerPenaliteUseCase } from '../../application/use-cases/supprimer-penalite.usecase';
import { GetEffectifsMatchUseCase } from '../../application/use-cases/get-effectifs-match.usecase';
import { GetMatchLiveUseCase } from '../../application/use-cases/get-match-live.usecase';

@Module({
  imports: [InscriptionModule, PersistenceModule],
  controllers: [TableDeMarqueController],
  providers: [
    TableDeMarquePrismaService,
    { provide: MATCH_LIVE_REPOSITORY, useClass: PrismaMatchLiveRepository },
    { provide: MATCH_BUT_REPOSITORY, useClass: PrismaMatchButRepository },
    {
      provide: MATCH_PENALITE_REPOSITORY,
      useClass: PrismaMatchPenaliteRepository,
    },
    {
      provide: MATCH_TYPE_PENALITE_REPOSITORY,
      useClass: PrismaMatchTypePenaliteRepository,
    },
    MatchLiveEtatService,
    AnnoncerMatchUseCase,
    DemarrerMatchUseCase,
    PauserMatchUseCase,
    TerminerMatchUseCase,
    EditerChronoUseCase,
    AjouterButUseCase,
    SupprimerButUseCase,
    AjouterPenaliteUseCase,
    SupprimerPenaliteUseCase,
    GetEffectifsMatchUseCase,
    GetMatchLiveUseCase,
  ],
  // MATCH_LIVE_REPOSITORY exporté pour le module planning (résolution
  // automatique des placeholders de bracket à partir des résultats live —
  // spec "lors-du-déroulement-live...").
  exports: [MATCH_LIVE_REPOSITORY],
})
export class TableDeMarqueModule {}
