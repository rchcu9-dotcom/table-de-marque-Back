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
import { GetEquipesReferentielUseCase } from '../../application/equipe/get-equipes-referentiel.usecase';
import {
  CreateEquipeReferentielUseCase,
  CreateEquipeReferentielDto,
} from '../../application/equipe/create-equipe-referentiel.usecase';
import { ValidateEquipeReferentielUseCase } from '../../application/equipe/validate-equipe-referentiel.usecase';
import { FirebaseAuthGuard } from '../../../auth/firebase-auth.guard';
import { Roles } from '../../../auth/decorators/roles.decorator';

@Controller('inscription/equipes')
export class EquipeReferentielController {
  constructor(
    private readonly getEquipes: GetEquipesReferentielUseCase,
    private readonly createEquipe: CreateEquipeReferentielUseCase,
    private readonly validateEquipe: ValidateEquipeReferentielUseCase,
  ) {}

  @Get()
  async listActives() {
    return this.getEquipes.execute(false);
  }

  @Get('toutes')
  @UseGuards(FirebaseAuthGuard)
  @Roles('ORGANISATEUR')
  async listToutes() {
    return this.getEquipes.execute(true);
  }

  @Post()
  @UseGuards(FirebaseAuthGuard)
  async create(@Body() dto: CreateEquipeReferentielDto) {
    return this.createEquipe.execute(dto);
  }

  @Patch(':id/activer')
  @UseGuards(FirebaseAuthGuard)
  @Roles('ORGANISATEUR')
  async activer(@Param('id', ParseIntPipe) id: number) {
    return this.validateEquipe.activate(id);
  }

  @Patch(':id/desactiver')
  @UseGuards(FirebaseAuthGuard)
  @Roles('ORGANISATEUR')
  async desactiver(@Param('id', ParseIntPipe) id: number) {
    return this.validateEquipe.deactivate(id);
  }
}
