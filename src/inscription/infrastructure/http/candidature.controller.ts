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
import { AccepterCandidatureUseCase } from '../../application/candidature/accepter-candidature.usecase';
import { MettreListeAttenteUseCase } from '../../application/candidature/mettre-liste-attente.usecase';
import { RefuserCandidatureUseCase } from '../../application/candidature/refuser-candidature.usecase';
import { ValiderPaiementUseCase } from '../../application/candidature/valider-paiement.usecase';
import { PromouvoCandidatureUseCase } from '../../application/candidature/promouvoir-candidature.usecase';
import { ValiderDossierUseCase } from '../../application/candidature/valider-dossier.usecase';
import { RouvrirDossierUseCase } from '../../application/candidature/rouvrir-dossier.usecase';
import { SoumettreCanditatureDto } from '../../application/candidature/dto/soumettre-candidature.dto';
import { ValiderPaiementDto } from '../../application/candidature/dto/valider-paiement.dto';

@Controller('inscription/candidatures')
export class CandidatureController {
  constructor(
    private readonly soumettreUseCase: SoumettreCanditatureUseCase,
    private readonly getMaCandidatureUseCase: GetMaCandidatureUseCase,
    private readonly getToutesCandidaturesUseCase: GetToutesCandidaturesUseCase,
    private readonly accepterUseCase: AccepterCandidatureUseCase,
    private readonly listeAttenteUseCase: MettreListeAttenteUseCase,
    private readonly refuserUseCase: RefuserCandidatureUseCase,
    private readonly validerPaiementUseCase: ValiderPaiementUseCase,
    private readonly promouvoirUseCase: PromouvoCandidatureUseCase,
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

  // US-003 — Organisateur : accepter → PAIEMENT_ATTENDU
  @Patch(':id/accepter')
  @Roles('ORGANISATEUR')
  async accepter(@Param('id', ParseIntPipe) id: number) {
    return this.accepterUseCase.execute(id);
  }

  // US-003 — Organisateur : mettre en liste d'attente
  @Patch(':id/liste-attente')
  @Roles('ORGANISATEUR')
  async listeAttente(@Param('id', ParseIntPipe) id: number) {
    return this.listeAttenteUseCase.execute(id);
  }

  // US-003 — Organisateur : promouvoir liste d'attente → PAIEMENT_ATTENDU
  @Patch(':id/promouvoir')
  @Roles('ORGANISATEUR')
  async promouvoir(@Param('id', ParseIntPipe) id: number) {
    return this.promouvoirUseCase.execute(id);
  }

  // US-003 — Organisateur : refuser
  @Patch(':id/refuser')
  @Roles('ORGANISATEUR')
  async refuser(@Param('id', ParseIntPipe) id: number) {
    return this.refuserUseCase.execute(id);
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
