import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  ParseIntPipe,
  Patch,
  Post,
  Res,
} from '@nestjs/common';
import type { Response } from 'express';
import { GetEditionCouranteUseCase } from '../../application/edition/get-edition-courante.usecase';
import { GetEditionEnPreparationUseCase } from '../../application/edition/get-edition-en-preparation.usecase';
import {
  CreateEditionUseCase,
  CreateEditionDto,
} from '../../application/edition/create-edition.usecase';
import {
  UpdateEditionUseCase,
  UpdateEditionDto,
} from '../../application/edition/update-edition.usecase';
import { DemarrerTournoiUseCase } from '../../application/edition/demarrer-tournoi.usecase';
import { ExportTaUseCase } from '../../application/edition/export-ta.usecase';
import {
  AjouterAnneeAgeUseCase,
  AjouterAnneeAgeDto,
} from '../../application/edition/ajouter-annee-age.usecase';
import { RetirerAnneeAgeUseCase } from '../../application/edition/retirer-annee-age.usecase';
import { Roles } from '../../../auth/decorators/roles.decorator';

@Controller('inscription')
export class EditionController {
  constructor(
    private readonly getEditionCourante: GetEditionCouranteUseCase,
    private readonly getEditionEnPreparation: GetEditionEnPreparationUseCase,
    private readonly createEdition: CreateEditionUseCase,
    private readonly updateEdition: UpdateEditionUseCase,
    private readonly demarrerTournoi: DemarrerTournoiUseCase,
    private readonly exportTa: ExportTaUseCase,
    private readonly ajouterAnneeAge: AjouterAnneeAgeUseCase,
    private readonly retirerAnneeAge: RetirerAnneeAgeUseCase,
  ) {}

  @Get('edition/courante')
  async courante() {
    return this.getEditionCourante.execute();
  }

  @Get('edition/en-preparation')
  @Roles('ORGANISATEUR')
  async enPreparation() {
    return this.getEditionEnPreparation.execute();
  }

  @Post('editions')
  @Roles('ORGANISATEUR')
  async create(@Body() dto: CreateEditionDto) {
    return this.createEdition.execute(dto);
  }

  @Patch('editions/:id')
  @Roles('ORGANISATEUR')
  async update(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: UpdateEditionDto,
  ) {
    return this.updateEdition.execute(id, dto);
  }

  @Post('editions/:id/demarrer-tournoi')
  @Roles('ORGANISATEUR')
  async demarrer(@Param('id', ParseIntPipe) id: number) {
    return this.demarrerTournoi.execute(id);
  }

  @Post('editions/:id/annees-age')
  @Roles('ORGANISATEUR')
  async ajouterAnnee(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: AjouterAnneeAgeDto,
  ) {
    return this.ajouterAnneeAge.execute(id, dto);
  }

  @Delete('editions/:id/annees-age/:annee')
  @Roles('ORGANISATEUR')
  async retirerAnnee(
    @Param('id', ParseIntPipe) id: number,
    @Param('annee', ParseIntPipe) annee: number,
  ) {
    return this.retirerAnneeAge.execute(id, annee);
  }

  @Get('editions/:id/export-ta')
  @Roles('ORGANISATEUR')
  async exportTaTables(
    @Param('id', ParseIntPipe) id: number,
    @Res({ passthrough: true }) res: Response,
  ) {
    const { filename, payload } = await this.exportTa.execute(id);
    res.set({
      'Content-Type': 'application/json',
      'Content-Disposition': `attachment; filename="${filename}"`,
    });
    return payload;
  }
}
