import {
  Body,
  Controller,
  Get,
  Param,
  ParseIntPipe,
  Patch,
  Post,
  UseGuards,
} from '@nestjs/common';
import { FirebaseAuthGuard } from '../../../auth/firebase-auth.guard';
import { Roles } from '../../../auth/decorators/roles.decorator';
import {
  CurrentUser,
  type CurrentUserPayload,
} from '../../../auth/decorators/current-user.decorator';
import { InscriptionRoleGuard } from './inscription-role.guard';
import { SoumettreCanditatureUseCase } from '../../application/candidature/soumettre-candidature.usecase';
import { GetMaCandidatureUseCase } from '../../application/candidature/get-ma-candidature.usecase';
import { GetToutesCandidaturesUseCase } from '../../application/candidature/get-toutes-candidatures.usecase';
import { AccepterCandidatureUseCase } from '../../application/candidature/accepter-candidature.usecase';
import { MettreListeAttenteUseCase } from '../../application/candidature/mettre-liste-attente.usecase';
import { RefuserCandidatureUseCase } from '../../application/candidature/refuser-candidature.usecase';
import { ValiderPaiementUseCase } from '../../application/candidature/valider-paiement.usecase';
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
  ) {}

  // US-002 — Responsable : soumettre candidature
  @Post()
  @UseGuards(FirebaseAuthGuard, InscriptionRoleGuard)
  @Roles('RESPONSABLE_EQUIPE')
  async soumettre(
    @CurrentUser() currentUser: CurrentUserPayload,
    @Body() dto: SoumettreCanditatureDto,
  ) {
    return this.soumettreUseCase.execute(currentUser.uid, dto);
  }

  // US-002 — Responsable : consulter sa candidature
  @Get('ma-candidature')
  @UseGuards(FirebaseAuthGuard)
  async getMaCandidature(@CurrentUser() currentUser: CurrentUserPayload) {
    return this.getMaCandidatureUseCase.execute(currentUser.uid);
  }

  // US-003 — Organisateur : lister toutes les candidatures
  @Get()
  @UseGuards(FirebaseAuthGuard, InscriptionRoleGuard)
  @Roles('ORGANISATEUR')
  async getToutes() {
    return this.getToutesCandidaturesUseCase.execute();
  }

  // US-003 — Organisateur : accepter → PAIEMENT_ATTENDU
  @Patch(':id/accepter')
  @UseGuards(FirebaseAuthGuard, InscriptionRoleGuard)
  @Roles('ORGANISATEUR')
  async accepter(@Param('id', ParseIntPipe) id: number) {
    return this.accepterUseCase.execute(id);
  }

  // US-003 — Organisateur : mettre en liste d'attente
  @Patch(':id/liste-attente')
  @UseGuards(FirebaseAuthGuard, InscriptionRoleGuard)
  @Roles('ORGANISATEUR')
  async listeAttente(@Param('id', ParseIntPipe) id: number) {
    return this.listeAttenteUseCase.execute(id);
  }

  // US-003 — Organisateur : refuser
  @Patch(':id/refuser')
  @UseGuards(FirebaseAuthGuard, InscriptionRoleGuard)
  @Roles('ORGANISATEUR')
  async refuser(@Param('id', ParseIntPipe) id: number) {
    return this.refuserUseCase.execute(id);
  }

  // US-004 — Organisateur : valider paiement → VALIDEE
  @Patch(':id/valider-paiement')
  @UseGuards(FirebaseAuthGuard, InscriptionRoleGuard)
  @Roles('ORGANISATEUR')
  async validerPaiement(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: ValiderPaiementDto,
  ) {
    return this.validerPaiementUseCase.execute(id, dto);
  }
}
