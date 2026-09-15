import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  ParseIntPipe,
  Post,
  Put,
} from '@nestjs/common';
import { Roles } from '@/auth/decorators/roles.decorator';
import { assertApiWritable } from '@/infrastructure/http/read-only.util';
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
import { UpdateParametresSportifsDto } from '../../application/dto/update-parametres-sportifs.dto';
import { UpsertJourDto } from '../../application/dto/upsert-jour.dto';
import { UpsertActiviteCatalogueDto } from '../../application/dto/upsert-activite-catalogue.dto';
import { UpsertCreneauActiviteDto } from '../../application/dto/upsert-creneau-activite.dto';

@Controller('parametres-sportifs')
@Roles('ORGANISATEUR')
export class ParametresSportifsController {
  constructor(
    private readonly getParametresSportifs: GetParametresSportifsUseCase,
    private readonly updateParametresSportifs: UpdateParametresSportifsUseCase,
    private readonly listJours: ListJoursUseCase,
    private readonly upsertJour: UpsertJourUseCase,
    private readonly deleteJour: DeleteJourUseCase,
    private readonly getActivitesCatalogue: GetActivitesCatalogueUseCase,
    private readonly creerActiviteCatalogue: CreerActiviteCatalogueUseCase,
    private readonly modifierActiviteCatalogue: ModifierActiviteCatalogueUseCase,
    private readonly supprimerActiviteCatalogue: SupprimerActiviteCatalogueUseCase,
    private readonly getCreneauxActivite: GetCreneauxActiviteUseCase,
    private readonly creerCreneauActivite: CreerCreneauActiviteUseCase,
    private readonly modifierCreneauActivite: ModifierCreneauActiviteUseCase,
    private readonly supprimerCreneauActivite: SupprimerCreneauActiviteUseCase,
  ) {}

  @Get(':editionId')
  get(@Param('editionId', ParseIntPipe) editionId: number) {
    return this.getParametresSportifs.execute(editionId);
  }

  @Put(':editionId')
  update(
    @Param('editionId', ParseIntPipe) editionId: number,
    @Body() dto: UpdateParametresSportifsDto,
  ) {
    assertApiWritable();
    return this.updateParametresSportifs.execute(editionId, dto);
  }

  @Get(':editionId/jours')
  jours(@Param('editionId', ParseIntPipe) editionId: number) {
    return this.listJours.execute(editionId);
  }

  @Post(':editionId/jours')
  creerJour(
    @Param('editionId', ParseIntPipe) editionId: number,
    @Body() dto: UpsertJourDto,
  ) {
    assertApiWritable();
    return this.upsertJour.execute(editionId, dto);
  }

  @Post(':editionId/jours/:numeroJour')
  modifierJour(
    @Param('editionId', ParseIntPipe) editionId: number,
    @Param('numeroJour', ParseIntPipe) numeroJour: number,
    @Body() dto: UpsertJourDto,
  ) {
    assertApiWritable();
    return this.upsertJour.execute(editionId, { ...dto, numeroJour });
  }

  @Delete(':editionId/jours/:numeroJour')
  supprimerJour(
    @Param('editionId', ParseIntPipe) editionId: number,
    @Param('numeroJour', ParseIntPipe) numeroJour: number,
  ) {
    assertApiWritable();
    return this.deleteJour.execute(editionId, numeroJour);
  }

  @Get(':editionId/activites-catalogue')
  activitesCatalogue(@Param('editionId', ParseIntPipe) editionId: number) {
    return this.getActivitesCatalogue.execute(editionId);
  }

  @Post(':editionId/activites-catalogue')
  creerActivite(
    @Param('editionId', ParseIntPipe) editionId: number,
    @Body() dto: UpsertActiviteCatalogueDto,
  ) {
    assertApiWritable();
    return this.creerActiviteCatalogue.execute(editionId, dto);
  }

  @Put(':editionId/activites-catalogue/:id')
  modifierActivite(
    @Param('editionId', ParseIntPipe) editionId: number,
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: UpsertActiviteCatalogueDto,
  ) {
    assertApiWritable();
    return this.modifierActiviteCatalogue.execute(id, editionId, dto);
  }

  @Delete(':editionId/activites-catalogue/:id')
  supprimerActivite(
    @Param('editionId', ParseIntPipe) editionId: number,
    @Param('id', ParseIntPipe) id: number,
  ) {
    assertApiWritable();
    return this.supprimerActiviteCatalogue.execute(id, editionId);
  }

  @Get(':editionId/creneaux-activite')
  creneauxActivite(@Param('editionId', ParseIntPipe) editionId: number) {
    return this.getCreneauxActivite.execute(editionId);
  }

  @Post(':editionId/creneaux-activite')
  creerCreneau(
    @Param('editionId', ParseIntPipe) editionId: number,
    @Body() dto: UpsertCreneauActiviteDto,
  ) {
    assertApiWritable();
    return this.creerCreneauActivite.execute(editionId, dto);
  }

  @Put(':editionId/creneaux-activite/:id')
  modifierCreneau(
    @Param('editionId', ParseIntPipe) editionId: number,
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: UpsertCreneauActiviteDto,
  ) {
    assertApiWritable();
    return this.modifierCreneauActivite.execute(id, editionId, dto);
  }

  @Delete(':editionId/creneaux-activite/:id')
  supprimerCreneau(
    @Param('editionId', ParseIntPipe) editionId: number,
    @Param('id', ParseIntPipe) id: number,
  ) {
    assertApiWritable();
    return this.supprimerCreneauActivite.execute(id, editionId);
  }
}
