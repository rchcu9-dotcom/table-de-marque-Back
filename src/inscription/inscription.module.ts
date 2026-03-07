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
import { EditionController } from './infrastructure/http/edition.controller';
import { EquipeReferentielController } from './infrastructure/http/equipe-referentiel.controller';
import { AuthInscriptionController } from './infrastructure/http/auth-inscription.controller';

@Module({
  imports: [AuthModule],
  controllers: [
    EditionController,
    EquipeReferentielController,
    AuthInscriptionController,
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
  ],
})
export class InscriptionModule {}
