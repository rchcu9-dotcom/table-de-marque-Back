import {
  Body,
  Controller,
  Get,
  Param,
  ParseIntPipe,
  Patch,
  Post,
} from '@nestjs/common';
import { GetEquipesReferentielUseCase } from '../../application/equipe/get-equipes-referentiel.usecase';
import {
  CreateEquipeReferentielUseCase,
  CreateEquipeReferentielDto,
} from '../../application/equipe/create-equipe-referentiel.usecase';
import { ValidateEquipeReferentielUseCase } from '../../application/equipe/validate-equipe-referentiel.usecase';
import {
  UpdateEquipeReferentielUseCase,
  UpdateEquipeReferentielDto,
} from '../../application/equipe/update-equipe-referentiel.usecase';
import { Roles } from '../../../auth/decorators/roles.decorator';
import { RequireAuth } from '../../../auth/decorators/require-auth.decorator';

@Controller('inscription/equipes')
export class EquipeReferentielController {
  constructor(
    private readonly getEquipes: GetEquipesReferentielUseCase,
    private readonly createEquipe: CreateEquipeReferentielUseCase,
    private readonly validateEquipe: ValidateEquipeReferentielUseCase,
    private readonly updateEquipe: UpdateEquipeReferentielUseCase,
  ) {}

  @Get()
  async listActives() {
    const equipes = await this.getEquipes.execute(false);
    // Contrat d'API public : ne jamais exposer d'information dérivée d'une
    // candidature (candidatureEnCours ou tout futur champ similaire).
    return equipes.map(
      ({ id, nom, nomComplet, logoUrl, active, createdAt, updatedAt }) => ({
        id,
        nom,
        nomComplet,
        logoUrl,
        active,
        createdAt,
        updatedAt,
      }),
    );
  }

  @Get('toutes')
  @Roles('ORGANISATEUR')
  async listToutes() {
    return this.getEquipes.execute(true);
  }

  @Post()
  @RequireAuth()
  async create(@Body() dto: CreateEquipeReferentielDto) {
    return this.createEquipe.execute(dto);
  }

  @Patch(':id')
  @Roles('ORGANISATEUR')
  async update(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: UpdateEquipeReferentielDto,
  ) {
    return this.updateEquipe.execute(id, dto);
  }

  @Patch(':id/activer')
  @Roles('ORGANISATEUR')
  async activer(@Param('id', ParseIntPipe) id: number) {
    return this.validateEquipe.activate(id);
  }

  @Patch(':id/desactiver')
  @Roles('ORGANISATEUR')
  async desactiver(@Param('id', ParseIntPipe) id: number) {
    return this.validateEquipe.deactivate(id);
  }
}
