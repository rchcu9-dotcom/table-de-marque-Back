import { Module } from '@nestjs/common';
import { PersistenceModule } from '../infrastructure/persistence/persistence.module';
import { InscriptionPrismaService } from './infrastructure/persistence/inscription-prisma.service';
import { EditionVerrouService } from './application/shared/edition-verrou.service';
import { GetEditionCouranteUseCase } from './application/edition/get-edition-courante.usecase';
import { GetEditionEnPreparationUseCase } from './application/edition/get-edition-en-preparation.usecase';
import { CreateEditionUseCase } from './application/edition/create-edition.usecase';
import { UpdateEditionUseCase } from './application/edition/update-edition.usecase';
import { DemarrerTournoiUseCase } from './application/edition/demarrer-tournoi.usecase';
import { ChangerEtapeEditionService } from './application/edition/changer-etape-edition.service';
import { OuvrirInscriptionsUseCase } from './application/edition/ouvrir-inscriptions.usecase';
import { CloturerInscriptionsUseCase } from './application/edition/cloturer-inscriptions.usecase';
import { RevenirEnPreparationUseCase } from './application/edition/revenir-en-preparation.usecase';
import { ExportTaUseCase } from './application/edition/export-ta.usecase';
import { AjouterAnneeAgeUseCase } from './application/edition/ajouter-annee-age.usecase';
import { RetirerAnneeAgeUseCase } from './application/edition/retirer-annee-age.usecase';
import { UploadImageRibUseCase } from './application/edition/upload-image-rib.usecase';
import { GetImageRibUseCase } from './application/edition/get-image-rib.usecase';
import { DeleteImageRibUseCase } from './application/edition/delete-image-rib.usecase';
import { GetEquipesReferentielUseCase } from './application/equipe/get-equipes-referentiel.usecase';
import { CreateEquipeReferentielUseCase } from './application/equipe/create-equipe-referentiel.usecase';
import { ValidateEquipeReferentielUseCase } from './application/equipe/validate-equipe-referentiel.usecase';
import { UpdateEquipeReferentielUseCase } from './application/equipe/update-equipe-referentiel.usecase';
import { UpsertUtilisateurUseCase } from './application/auth/upsert-utilisateur.usecase';
import { UpdatePseudoUseCase } from './application/auth/update-pseudo.usecase';
import { SoumettreCanditatureUseCase } from './application/candidature/soumettre-candidature.usecase';
import { GetMaCandidatureUseCase } from './application/candidature/get-ma-candidature.usecase';
import { GetToutesCandidaturesUseCase } from './application/candidature/get-toutes-candidatures.usecase';
import { ChangerStatutTriageUseCase } from './application/candidature/changer-statut-triage.usecase';
import { ValiderPaiementUseCase } from './application/candidature/valider-paiement.usecase';
import { MarquerPaiementRepasUseCase } from './application/candidature/marquer-paiement-repas.usecase';
import { DefinirCommentaireOrganisateurUseCase } from './application/candidature/definir-commentaire-organisateur.usecase';
import { ValiderDossierUseCase } from './application/candidature/valider-dossier.usecase';
import { RouvrirDossierUseCase } from './application/candidature/rouvrir-dossier.usecase';
import { QuotaInscriptionService } from './application/shared/quota-inscription.service';
import { EditionResolverService } from './application/shared/edition-resolver.service';
import { DossierAccessService } from './application/dossier/dossier-access.service';
import { AnneeAgeValidationService } from './application/dossier/annee-age-validation.service';
import { GetMonDossierUseCase } from './application/dossier/get-mon-dossier.usecase';
import { GetDossierParInscriptionUseCase } from './application/dossier/get-dossier-par-inscription.usecase';
import { AjouterJoueurUseCase } from './application/dossier/ajouter-joueur.usecase';
import { ModifierJoueurUseCase } from './application/dossier/modifier-joueur.usecase';
import { SupprimerJoueurUseCase } from './application/dossier/supprimer-joueur.usecase';
import { AjouterCoachUseCase } from './application/dossier/ajouter-coach.usecase';
import { ModifierCoachUseCase } from './application/dossier/modifier-coach.usecase';
import { SupprimerCoachUseCase } from './application/dossier/supprimer-coach.usecase';
import { AccepterDroitsImageUseCase } from './application/dossier/accepter-droits-image.usecase';
import { EditionController } from './infrastructure/http/edition.controller';
import { EquipeReferentielController } from './infrastructure/http/equipe-referentiel.controller';
import { AuthInscriptionController } from './infrastructure/http/auth-inscription.controller';
import { CandidatureController } from './infrastructure/http/candidature.controller';
import { DossierController } from './infrastructure/http/dossier.controller';

@Module({
  imports: [PersistenceModule],
  controllers: [
    EditionController,
    EquipeReferentielController,
    AuthInscriptionController,
    CandidatureController,
    DossierController,
  ],
  providers: [
    InscriptionPrismaService,
    GetEditionCouranteUseCase,
    GetEditionEnPreparationUseCase,
    CreateEditionUseCase,
    UpdateEditionUseCase,
    DemarrerTournoiUseCase,
    ChangerEtapeEditionService,
    OuvrirInscriptionsUseCase,
    CloturerInscriptionsUseCase,
    RevenirEnPreparationUseCase,
    ExportTaUseCase,
    AjouterAnneeAgeUseCase,
    RetirerAnneeAgeUseCase,
    UploadImageRibUseCase,
    GetImageRibUseCase,
    DeleteImageRibUseCase,
    GetEquipesReferentielUseCase,
    CreateEquipeReferentielUseCase,
    ValidateEquipeReferentielUseCase,
    UpdateEquipeReferentielUseCase,
    UpsertUtilisateurUseCase,
    UpdatePseudoUseCase,
    SoumettreCanditatureUseCase,
    GetMaCandidatureUseCase,
    GetToutesCandidaturesUseCase,
    ChangerStatutTriageUseCase,
    ValiderPaiementUseCase,
    MarquerPaiementRepasUseCase,
    DefinirCommentaireOrganisateurUseCase,
    ValiderDossierUseCase,
    RouvrirDossierUseCase,
    QuotaInscriptionService,
    EditionResolverService,
    EditionVerrouService,
    DossierAccessService,
    AnneeAgeValidationService,
    GetMonDossierUseCase,
    GetDossierParInscriptionUseCase,
    AjouterJoueurUseCase,
    ModifierJoueurUseCase,
    SupprimerJoueurUseCase,
    AjouterCoachUseCase,
    ModifierCoachUseCase,
    SupprimerCoachUseCase,
    AccepterDroitsImageUseCase,
  ],
  exports: [
    InscriptionPrismaService,
    EditionResolverService,
    EditionVerrouService,
  ],
})
export class InscriptionModule {}
