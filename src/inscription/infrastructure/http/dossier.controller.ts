import {
  Body,
  Controller,
  Delete,
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
import { GetMonDossierUseCase } from '../../application/dossier/get-mon-dossier.usecase';
import { GetDossierParInscriptionUseCase } from '../../application/dossier/get-dossier-par-inscription.usecase';
import { AjouterJoueurUseCase } from '../../application/dossier/ajouter-joueur.usecase';
import { ModifierJoueurUseCase } from '../../application/dossier/modifier-joueur.usecase';
import { SupprimerJoueurUseCase } from '../../application/dossier/supprimer-joueur.usecase';
import { AjouterCoachUseCase } from '../../application/dossier/ajouter-coach.usecase';
import { ModifierCoachUseCase } from '../../application/dossier/modifier-coach.usecase';
import { SupprimerCoachUseCase } from '../../application/dossier/supprimer-coach.usecase';
import { AccepterDroitsImageUseCase } from '../../application/dossier/accepter-droits-image.usecase';
import {
  CreateJoueurDossierDto,
  UpdateJoueurDossierDto,
} from '../../application/dossier/dto/upsert-joueur-dossier.dto';
import {
  CreateCoachDossierDto,
  UpdateCoachDossierDto,
} from '../../application/dossier/dto/upsert-coach-dossier.dto';
import { AccepterDroitsImageDto } from '../../application/dossier/dto/accepter-droits-image.dto';

@Controller('inscription/dossier')
export class DossierController {
  constructor(
    private readonly getMonDossierUseCase: GetMonDossierUseCase,
    private readonly getDossierParInscriptionUseCase: GetDossierParInscriptionUseCase,
    private readonly ajouterJoueurUseCase: AjouterJoueurUseCase,
    private readonly modifierJoueurUseCase: ModifierJoueurUseCase,
    private readonly supprimerJoueurUseCase: SupprimerJoueurUseCase,
    private readonly ajouterCoachUseCase: AjouterCoachUseCase,
    private readonly modifierCoachUseCase: ModifierCoachUseCase,
    private readonly supprimerCoachUseCase: SupprimerCoachUseCase,
    private readonly accepterDroitsImageUseCase: AccepterDroitsImageUseCase,
  ) {}

  @Get('moi')
  @RequireAuth()
  async getMonDossier(@CurrentUser() currentUser: CurrentUserPayload) {
    return this.getMonDossierUseCase.execute(currentUser.providerUid);
  }

  @Get('candidature/:id')
  @Roles('ORGANISATEUR')
  async getDossierParInscription(@Param('id', ParseIntPipe) id: number) {
    return this.getDossierParInscriptionUseCase.execute(id);
  }

  @Post('joueurs')
  @RequireAuth()
  async ajouterJoueur(
    @CurrentUser() currentUser: CurrentUserPayload,
    @Body() dto: CreateJoueurDossierDto,
  ) {
    return this.ajouterJoueurUseCase.execute(currentUser.providerUid, dto);
  }

  @Patch('joueurs/:id')
  @RequireAuth()
  async modifierJoueur(
    @CurrentUser() currentUser: CurrentUserPayload,
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: UpdateJoueurDossierDto,
  ) {
    return this.modifierJoueurUseCase.execute(currentUser.providerUid, id, dto);
  }

  @Delete('joueurs/:id')
  @RequireAuth()
  async supprimerJoueur(
    @CurrentUser() currentUser: CurrentUserPayload,
    @Param('id', ParseIntPipe) id: number,
  ) {
    await this.supprimerJoueurUseCase.execute(currentUser.providerUid, id);
    return { success: true };
  }

  @Post('coachs')
  @RequireAuth()
  async ajouterCoach(
    @CurrentUser() currentUser: CurrentUserPayload,
    @Body() dto: CreateCoachDossierDto,
  ) {
    return this.ajouterCoachUseCase.execute(currentUser.providerUid, dto);
  }

  @Patch('coachs/:id')
  @RequireAuth()
  async modifierCoach(
    @CurrentUser() currentUser: CurrentUserPayload,
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: UpdateCoachDossierDto,
  ) {
    return this.modifierCoachUseCase.execute(currentUser.providerUid, id, dto);
  }

  @Delete('coachs/:id')
  @RequireAuth()
  async supprimerCoach(
    @CurrentUser() currentUser: CurrentUserPayload,
    @Param('id', ParseIntPipe) id: number,
  ) {
    await this.supprimerCoachUseCase.execute(currentUser.providerUid, id);
    return { success: true };
  }

  @Patch('droits-image')
  @RequireAuth()
  async accepterDroitsImage(
    @CurrentUser() currentUser: CurrentUserPayload,
    @Body() dto: AccepterDroitsImageDto,
  ) {
    return this.accepterDroitsImageUseCase.execute(
      currentUser.providerUid,
      dto,
    );
  }
}
