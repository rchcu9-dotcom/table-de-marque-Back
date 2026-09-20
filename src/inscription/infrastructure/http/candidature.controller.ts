import {
  Body,
  Controller,
  Get,
  Param,
  ParseIntPipe,
  Patch,
  Post,
} from '@nestjs/common';
import { Roles } from '../../../auth/decorators/roles.decorator';
import { RequireAuth } from '../../../auth/decorators/require-auth.decorator';
import {
  CurrentUser,
  type CurrentUserPayload,
} from '../../../auth/decorators/current-user.decorator';
import { SoumettreCanditatureUseCase } from '../../application/candidature/soumettre-candidature.usecase';
import { GetMaCandidatureUseCase } from '../../application/candidature/get-ma-candidature.usecase';
import { GetToutesCandidaturesUseCase } from '../../application/candidature/get-toutes-candidatures.usecase';
import { ChangerStatutTriageUseCase } from '../../application/candidature/changer-statut-triage.usecase';
import { ValiderPaiementUseCase } from '../../application/candidature/valider-paiement.usecase';
import { MarquerPaiementRepasUseCase } from '../../application/candidature/marquer-paiement-repas.usecase';
import { DefinirCommentaireOrganisateurUseCase } from '../../application/candidature/definir-commentaire-organisateur.usecase';
import { ValiderDossierUseCase } from '../../application/candidature/valider-dossier.usecase';
import { RouvrirDossierUseCase } from '../../application/candidature/rouvrir-dossier.usecase';
import { SoumettreCanditatureDto } from '../../application/candidature/dto/soumettre-candidature.dto';
import { ValiderPaiementDto } from '../../application/candidature/dto/valider-paiement.dto';
import { MarquerPaiementRepasDto } from '../../application/candidature/dto/marquer-paiement-repas.dto';
import { DefinirCommentaireOrganisateurDto } from '../../application/candidature/dto/definir-commentaire-organisateur.dto';
import { ChangerStatutTriageDto } from '../../application/candidature/dto/changer-statut-triage.dto';

@Controller('inscription/candidatures')
export class CandidatureController {
  constructor(
    private readonly soumettreUseCase: SoumettreCanditatureUseCase,
    private readonly getMaCandidatureUseCase: GetMaCandidatureUseCase,
    private readonly getToutesCandidaturesUseCase: GetToutesCandidaturesUseCase,
    private readonly changerStatutTriageUseCase: ChangerStatutTriageUseCase,
    private readonly validerPaiementUseCase: ValiderPaiementUseCase,
    private readonly marquerPaiementRepasUseCase: MarquerPaiementRepasUseCase,
    private readonly definirCommentaireOrganisateurUseCase: DefinirCommentaireOrganisateurUseCase,
    private readonly validerDossierUseCase: ValiderDossierUseCase,
    private readonly rouvrirDossierUseCase: RouvrirDossierUseCase,
  ) {}

  // US-002 — Responsable : soumettre candidature
  @Post()
  @Roles('RESPONSABLE_EQUIPE')
  async soumettre(
    @CurrentUser() currentUser: CurrentUserPayload,
    @Body() dto: SoumettreCanditatureDto,
  ) {
    return this.soumettreUseCase.execute(currentUser.providerUid, dto);
  }

  // US-002 — Responsable : consulter sa candidature
  @Get('ma-candidature')
  @RequireAuth()
  async getMaCandidature(@CurrentUser() currentUser: CurrentUserPayload) {
    return this.getMaCandidatureUseCase.execute(currentUser.providerUid);
  }

  // US-003 — Organisateur : lister toutes les candidatures
  @Get()
  @Roles('ORGANISATEUR')
  async getToutes() {
    return this.getToutesCandidaturesUseCase.execute();
  }

  // Organisateur : changer le statut de triage (candidate/paiement attendu/liste
  // d'attente/refusée) — mécanisme unique et réversible, remplace les anciennes
  // routes accepter/liste-attente/promouvoir/refuser.
  @Patch(':id/statut-triage')
  @Roles('ORGANISATEUR')
  async changerStatutTriage(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: ChangerStatutTriageDto,
  ) {
    return this.changerStatutTriageUseCase.execute(id, dto);
  }

  // US-004 — Organisateur : valider paiement → VALIDEE
  @Patch(':id/valider-paiement')
  @Roles('ORGANISATEUR')
  async validerPaiement(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: ValiderPaiementDto,
  ) {
    return this.validerPaiementUseCase.execute(id, dto);
  }

  // Organisateur : marquer le paiement du repas comme reçu (ou revenir en arrière)
  @Patch(':id/repas-paiement')
  @Roles('ORGANISATEUR')
  async marquerPaiementRepas(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: MarquerPaiementRepasDto,
  ) {
    return this.marquerPaiementRepasUseCase.execute(id, dto);
  }

  // Organisateur : commentaire libre par équipe (jamais exposé au responsable)
  @Patch(':id/commentaire-organisateur')
  @Roles('ORGANISATEUR')
  async definirCommentaireOrganisateur(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: DefinirCommentaireOrganisateurDto,
  ) {
    return this.definirCommentaireOrganisateurUseCase.execute(id, dto);
  }

  // Organisateur : valider le dossier → DOSSIER_COMPLET
  @Patch(':id/valider-dossier')
  @Roles('ORGANISATEUR')
  async validerDossier(@Param('id', ParseIntPipe) id: number) {
    return this.validerDossierUseCase.execute(id);
  }

  // Organisateur : rouvrir le dossier → DOSSIER_EN_COURS
  @Patch(':id/rouvrir-dossier')
  @Roles('ORGANISATEUR')
  async rouvrirDossier(@Param('id', ParseIntPipe) id: number) {
    return this.rouvrirDossierUseCase.execute(id);
  }
}
