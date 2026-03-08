import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { InscriptionPrismaService } from './infrastructure/persistence/inscription-prisma.service';
import { GetEditionCouranteUseCase } from './application/edition/get-edition-courante.usecase';
import { CreateEditionUseCase } from './application/edition/create-edition.usecase';
import { UpdateEditionUseCase } from './application/edition/update-edition.usecase';
import { GetEquipesReferentielUseCase } from './application/equipe/get-equipes-referentiel.usecase';
import { CreateEquipeReferentielUseCase } from './application/equipe/create-equipe-referentiel.usecase';
import { ValidateEquipeReferentielUseCase } from './application/equipe/validate-equipe-referentiel.usecase';
import { UpsertUtilisateurUseCase } from './application/auth/upsert-utilisateur.usecase';
import { SoumettreCanditatureUseCase } from './application/candidature/soumettre-candidature.usecase';
import { GetMaCandidatureUseCase } from './application/candidature/get-ma-candidature.usecase';
import { GetToutesCandidaturesUseCase } from './application/candidature/get-toutes-candidatures.usecase';
import { AccepterCandidatureUseCase } from './application/candidature/accepter-candidature.usecase';
import { MettreListeAttenteUseCase } from './application/candidature/mettre-liste-attente.usecase';
import { RefuserCandidatureUseCase } from './application/candidature/refuser-candidature.usecase';
import { ValiderPaiementUseCase } from './application/candidature/valider-paiement.usecase';
import { EditionController } from './infrastructure/http/edition.controller';
import { EquipeReferentielController } from './infrastructure/http/equipe-referentiel.controller';
import { AuthInscriptionController } from './infrastructure/http/auth-inscription.controller';
import { CandidatureController } from './infrastructure/http/candidature.controller';
import { InscriptionRoleGuard } from './infrastructure/http/inscription-role.guard';

@Module({
  imports: [AuthModule],
  controllers: [
    EditionController,
    EquipeReferentielController,
    AuthInscriptionController,
    CandidatureController,
  ],
  providers: [
    InscriptionPrismaService,
    GetEditionCouranteUseCase,
    CreateEditionUseCase,
    UpdateEditionUseCase,
    GetEquipesReferentielUseCase,
    CreateEquipeReferentielUseCase,
    ValidateEquipeReferentielUseCase,
    UpsertUtilisateurUseCase,
    SoumettreCanditatureUseCase,
    GetMaCandidatureUseCase,
    GetToutesCandidaturesUseCase,
    AccepterCandidatureUseCase,
    MettreListeAttenteUseCase,
    RefuserCandidatureUseCase,
    ValiderPaiementUseCase,
    InscriptionRoleGuard,
  ],
})
export class InscriptionModule {}
