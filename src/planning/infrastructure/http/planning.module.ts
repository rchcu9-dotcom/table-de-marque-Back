import { Module } from '@nestjs/common';
import { InscriptionModule } from '@/inscription/inscription.module';
import { PersistenceModule } from '@/infrastructure/persistence/persistence.module';
import { TableDeMarqueModule } from '@/table-de-marque/infrastructure/http/table-de-marque.module';
import { ParametresSportifsController } from './parametres-sportifs.controller';
import { PlanningController } from './planning.controller';
import { PlaceholdersController } from './placeholders.controller';
import { FormatGrapheController } from './format-graphe.controller';
import { PlanningPrismaService } from '../persistence/planning-prisma.service';
import { PrismaInscriptionEditionJourRepository } from '../persistence/prisma-inscription-edition-jour.repository';
import { PrismaActiviteCatalogueRepository } from '../persistence/prisma-activite-catalogue.repository';
import { PrismaCreneauActiviteRepository } from '../persistence/prisma-creneau-activite.repository';
import { PrismaPlanningConfirmationRepository } from '../persistence/prisma-planning-confirmation.repository';
import { PrismaPlanningMatchWriter } from '../persistence/prisma-planning-match-writer.repository';
import { PrismaPlanningMatchSlotRepository } from '../persistence/prisma-planning-match-slot.repository';
import { PrismaFormatGrapheRepository } from '../persistence/prisma-format-graphe.repository';
import { INSCRIPTION_EDITION_JOUR_REPOSITORY } from '../../domain/repositories/inscription-edition-jour.repository';
import { ACTIVITE_CATALOGUE_REPOSITORY } from '../../domain/repositories/activite-catalogue.repository';
import { CRENEAU_ACTIVITE_REPOSITORY } from '../../domain/repositories/creneau-activite.repository';
import { PLANNING_CONFIRMATION_REPOSITORY } from '../../domain/repositories/planning-confirmation.repository';
import { PLANNING_MATCH_WRITER } from '../../domain/repositories/planning-match-writer.repository';
import { PLANNING_MATCH_SLOT_REPOSITORY } from '../../domain/repositories/planning-match-slot.repository';
import { FORMAT_GRAPHE_REPOSITORY } from '../../domain/repositories/format-graphe.repository';
import { EquipesSimulationService } from '../../application/services/equipes-simulation.service';
import { GenerationMatchsService } from '../../application/services/generation-matchs.service';
import { GenerationMatchsGrapheService } from '../../application/services/generation-matchs-graphe.service';
import { FormatGrapheValidationService } from '../../application/services/format-graphe-validation.service';
import { FormatPresetGeneratorService } from '../../application/services/format-preset-generator.service';
import { PlacementActivitesService } from '../../application/services/placement-activites.service';
import { VerificationPlanningService } from '../../application/services/verification-planning.service';
import { PlanningSimulationCacheService } from '../../application/services/planning-simulation-cache.service';
import { PlanningPlaceholderResolverService } from '../../application/services/planning-placeholder-resolver.service';
import { PlanningPlaceholderResolverListener } from '../../application/listeners/planning-placeholder-resolver.listener';
import { GetParametresSportifsUseCase } from '../../application/use-cases/get-parametres-sportifs.usecase';
import { UpdateParametresSportifsUseCase } from '../../application/use-cases/update-parametres-sportifs.usecase';
import { ListJoursUseCase } from '../../application/use-cases/list-jours.usecase';
import { UpsertJourUseCase } from '../../application/use-cases/upsert-jour.usecase';
import { DeleteJourUseCase } from '../../application/use-cases/delete-jour.usecase';
import { GetActivitesCatalogueUseCase } from '../../application/use-cases/activite-catalogue/get-activites-catalogue.usecase';
import { CreerActiviteCatalogueUseCase } from '../../application/use-cases/activite-catalogue/creer-activite-catalogue.usecase';
import { ModifierActiviteCatalogueUseCase } from '../../application/use-cases/activite-catalogue/modifier-activite-catalogue.usecase';
import { SupprimerActiviteCatalogueUseCase } from '../../application/use-cases/activite-catalogue/supprimer-activite-catalogue.usecase';
import { GetCreneauxActiviteUseCase } from '../../application/use-cases/creneau-activite/get-creneaux-activite.usecase';
import { CreerCreneauActiviteUseCase } from '../../application/use-cases/creneau-activite/creer-creneau-activite.usecase';
import { ModifierCreneauActiviteUseCase } from '../../application/use-cases/creneau-activite/modifier-creneau-activite.usecase';
import { SupprimerCreneauActiviteUseCase } from '../../application/use-cases/creneau-activite/supprimer-creneau-activite.usecase';
import { SimulerPlanningUseCase } from '../../application/use-cases/simuler-planning.usecase';
import { ExporterSimulationUseCase } from '../../application/use-cases/exporter-simulation.usecase';
import { AjusterSimulationUseCase } from '../../application/use-cases/ajuster-simulation.usecase';
import { ConfirmerPlanningUseCase } from '../../application/use-cases/confirmer-planning.usecase';
import { GetVerificationPlanningUseCase } from '../../application/use-cases/get-verification-planning.usecase';
import { GetPlaceholdersUseCase } from '../../application/use-cases/get-placeholders.usecase';
import { RevaliderPlaceholdersUseCase } from '../../application/use-cases/revalider-placeholders.usecase';
import { ResoudrePlaceholderManuelUseCase } from '../../application/use-cases/resoudre-placeholder-manuel.usecase';
import { GetFormatGrapheUseCase } from '../../application/use-cases/format-graphe/get-format-graphe.usecase';
import { CreerPhaseUseCase } from '../../application/use-cases/format-graphe/creer-phase.usecase';
import { ModifierPhaseUseCase } from '../../application/use-cases/format-graphe/modifier-phase.usecase';
import { SupprimerPhaseUseCase } from '../../application/use-cases/format-graphe/supprimer-phase.usecase';
import { ReordonnerPhasesUseCase } from '../../application/use-cases/format-graphe/reordonner-phases.usecase';
import { CreerGroupeUseCase } from '../../application/use-cases/format-graphe/creer-groupe.usecase';
import { ModifierGroupeUseCase } from '../../application/use-cases/format-graphe/modifier-groupe.usecase';
import { SupprimerGroupeUseCase } from '../../application/use-cases/format-graphe/supprimer-groupe.usecase';
import { AjouterPlaceAliasUseCase } from '../../application/use-cases/format-graphe/ajouter-place-alias.usecase';
import { SupprimerPlaceUseCase } from '../../application/use-cases/format-graphe/supprimer-place.usecase';
import { DefinirLienUseCase } from '../../application/use-cases/format-graphe/definir-lien.usecase';
import { MarquerEliminieUseCase } from '../../application/use-cases/format-graphe/marquer-elimine.usecase';
import { ReinitialiserLienUseCase } from '../../application/use-cases/format-graphe/reinitialiser-lien.usecase';
import { AssocierPhaseJourUseCase } from '../../application/use-cases/format-graphe/associer-phase-jour.usecase';
import { DissocierPhaseJourUseCase } from '../../application/use-cases/format-graphe/dissocier-phase-jour.usecase';
import { GenererPresetUseCase } from '../../application/use-cases/format-graphe/generer-preset.usecase';

@Module({
  imports: [InscriptionModule, PersistenceModule, TableDeMarqueModule],
  controllers: [
    ParametresSportifsController,
    PlanningController,
    PlaceholdersController,
    FormatGrapheController,
  ],
  providers: [
    PlanningPrismaService,
    {
      provide: INSCRIPTION_EDITION_JOUR_REPOSITORY,
      useClass: PrismaInscriptionEditionJourRepository,
    },
    {
      provide: ACTIVITE_CATALOGUE_REPOSITORY,
      useClass: PrismaActiviteCatalogueRepository,
    },
    {
      provide: CRENEAU_ACTIVITE_REPOSITORY,
      useClass: PrismaCreneauActiviteRepository,
    },
    {
      provide: PLANNING_CONFIRMATION_REPOSITORY,
      useClass: PrismaPlanningConfirmationRepository,
    },
    { provide: PLANNING_MATCH_WRITER, useClass: PrismaPlanningMatchWriter },
    {
      provide: PLANNING_MATCH_SLOT_REPOSITORY,
      useClass: PrismaPlanningMatchSlotRepository,
    },
    {
      provide: FORMAT_GRAPHE_REPOSITORY,
      useClass: PrismaFormatGrapheRepository,
    },
    EquipesSimulationService,
    GenerationMatchsService,
    GenerationMatchsGrapheService,
    FormatGrapheValidationService,
    FormatPresetGeneratorService,
    PlacementActivitesService,
    VerificationPlanningService,
    PlanningSimulationCacheService,
    PlanningPlaceholderResolverService,
    PlanningPlaceholderResolverListener,
    GetParametresSportifsUseCase,
    UpdateParametresSportifsUseCase,
    ListJoursUseCase,
    UpsertJourUseCase,
    DeleteJourUseCase,
    GetActivitesCatalogueUseCase,
    CreerActiviteCatalogueUseCase,
    ModifierActiviteCatalogueUseCase,
    SupprimerActiviteCatalogueUseCase,
    GetCreneauxActiviteUseCase,
    CreerCreneauActiviteUseCase,
    ModifierCreneauActiviteUseCase,
    SupprimerCreneauActiviteUseCase,
    SimulerPlanningUseCase,
    ExporterSimulationUseCase,
    AjusterSimulationUseCase,
    ConfirmerPlanningUseCase,
    GetVerificationPlanningUseCase,
    GetPlaceholdersUseCase,
    RevaliderPlaceholdersUseCase,
    ResoudrePlaceholderManuelUseCase,
    GetFormatGrapheUseCase,
    CreerPhaseUseCase,
    ModifierPhaseUseCase,
    SupprimerPhaseUseCase,
    ReordonnerPhasesUseCase,
    CreerGroupeUseCase,
    ModifierGroupeUseCase,
    SupprimerGroupeUseCase,
    AjouterPlaceAliasUseCase,
    SupprimerPlaceUseCase,
    DefinirLienUseCase,
    MarquerEliminieUseCase,
    ReinitialiserLienUseCase,
    AssocierPhaseJourUseCase,
    DissocierPhaseJourUseCase,
    GenererPresetUseCase,
  ],
})
export class PlanningModule {}
