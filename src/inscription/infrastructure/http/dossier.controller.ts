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
import {
  organisateur,
  referent,
} from '../../application/dossier/dossier-acteur';

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
    return this.ajouterJoueurUseCase.execute(
      referent(currentUser.providerUid),
      dto,
    );
  }

  @Patch('joueurs/:id')
  @RequireAuth()
  async modifierJoueur(
    @CurrentUser() currentUser: CurrentUserPayload,
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: UpdateJoueurDossierDto,
  ) {
    return this.modifierJoueurUseCase.execute(
      referent(currentUser.providerUid),
      id,
      dto,
    );
  }

  @Delete('joueurs/:id')
  @RequireAuth()
  async supprimerJoueur(
    @CurrentUser() currentUser: CurrentUserPayload,
    @Param('id', ParseIntPipe) id: number,
  ) {
    await this.supprimerJoueurUseCase.execute(
      referent(currentUser.providerUid),
      id,
    );
    return { success: true };
  }

  @Post('coachs')
  @RequireAuth()
  async ajouterCoach(
    @CurrentUser() currentUser: CurrentUserPayload,
    @Body() dto: CreateCoachDossierDto,
  ) {
    return this.ajouterCoachUseCase.execute(
      referent(currentUser.providerUid),
      dto,
    );
  }

  @Patch('coachs/:id')
  @RequireAuth()
  async modifierCoach(
    @CurrentUser() currentUser: CurrentUserPayload,
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: UpdateCoachDossierDto,
  ) {
    return this.modifierCoachUseCase.execute(
      referent(currentUser.providerUid),
      id,
      dto,
    );
  }

  @Delete('coachs/:id')
  @RequireAuth()
  async supprimerCoach(
    @CurrentUser() currentUser: CurrentUserPayload,
    @Param('id', ParseIntPipe) id: number,
  ) {
    await this.supprimerCoachUseCase.execute(
      referent(currentUser.providerUid),
      id,
    );
    return { success: true };
  }

  @Patch('droits-image')
  @RequireAuth()
  async accepterDroitsImage(
    @CurrentUser() currentUser: CurrentUserPayload,
    @Body() dto: AccepterDroitsImageDto,
  ) {
    return this.accepterDroitsImageUseCase.execute(
      referent(currentUser.providerUid),
      dto,
    );
  }

  // ── Routes organisateur : écriture sur le dossier d'une candidature ──────
  // Mêmes use cases que le référent, la candidature étant désignée par l'URL.
  // DOSSIER_COMPLET reste modifiable pour l'organisateur (cf.
  // DossierAccessService.assertDossierModifiable).

  @Post('candidature/:id/joueurs')
  @Roles('ORGANISATEUR')
  async ajouterJoueurCandidature(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: CreateJoueurDossierDto,
  ) {
    return this.ajouterJoueurUseCase.execute(organisateur(id), dto);
  }

  @Patch('candidature/:id/joueurs/:joueurId')
  @Roles('ORGANISATEUR')
  async modifierJoueurCandidature(
    @Param('id', ParseIntPipe) id: number,
    @Param('joueurId', ParseIntPipe) joueurId: number,
    @Body() dto: UpdateJoueurDossierDto,
  ) {
    return this.modifierJoueurUseCase.execute(organisateur(id), joueurId, dto);
  }

  @Delete('candidature/:id/joueurs/:joueurId')
  @Roles('ORGANISATEUR')
  async supprimerJoueurCandidature(
    @Param('id', ParseIntPipe) id: number,
    @Param('joueurId', ParseIntPipe) joueurId: number,
  ) {
    await this.supprimerJoueurUseCase.execute(organisateur(id), joueurId);
    return { success: true };
  }

  @Post('candidature/:id/coachs')
  @Roles('ORGANISATEUR')
  async ajouterCoachCandidature(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: CreateCoachDossierDto,
  ) {
    return this.ajouterCoachUseCase.execute(organisateur(id), dto);
  }

  @Patch('candidature/:id/coachs/:coachId')
  @Roles('ORGANISATEUR')
  async modifierCoachCandidature(
    @Param('id', ParseIntPipe) id: number,
    @Param('coachId', ParseIntPipe) coachId: number,
    @Body() dto: UpdateCoachDossierDto,
  ) {
    return this.modifierCoachUseCase.execute(organisateur(id), coachId, dto);
  }

  @Delete('candidature/:id/coachs/:coachId')
  @Roles('ORGANISATEUR')
  async supprimerCoachCandidature(
    @Param('id', ParseIntPipe) id: number,
    @Param('coachId', ParseIntPipe) coachId: number,
  ) {
    await this.supprimerCoachUseCase.execute(organisateur(id), coachId);
    return { success: true };
  }

  @Patch('candidature/:id/droits-image')
  @Roles('ORGANISATEUR')
  async accepterDroitsImageCandidature(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: AccepterDroitsImageDto,
  ) {
    return this.accepterDroitsImageUseCase.execute(organisateur(id), dto);
  }
}
