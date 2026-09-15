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
import { Roles } from '@/auth/decorators/roles.decorator';
import { assertApiWritable } from '@/infrastructure/http/read-only.util';
import { AnnoncerMatchUseCase } from '../../application/use-cases/annoncer-match.usecase';
import { DemarrerMatchUseCase } from '../../application/use-cases/demarrer-match.usecase';
import { PauserMatchUseCase } from '../../application/use-cases/pauser-match.usecase';
import { TerminerMatchUseCase } from '../../application/use-cases/terminer-match.usecase';
import { EditerChronoUseCase } from '../../application/use-cases/editer-chrono.usecase';
import { AjouterButUseCase } from '../../application/use-cases/ajouter-but.usecase';
import { SupprimerButUseCase } from '../../application/use-cases/supprimer-but.usecase';
import { AjouterPenaliteUseCase } from '../../application/use-cases/ajouter-penalite.usecase';
import { SupprimerPenaliteUseCase } from '../../application/use-cases/supprimer-penalite.usecase';
import { GetEffectifsMatchUseCase } from '../../application/use-cases/get-effectifs-match.usecase';
import { GetMatchLiveUseCase } from '../../application/use-cases/get-match-live.usecase';
import { EditerChronoDto } from '../../application/dto/editer-chrono.dto';
import { AjouterButDto } from '../../application/dto/ajouter-but.dto';
import { AjouterPenaliteDto } from '../../application/dto/ajouter-penalite.dto';

@Controller('table-de-marque/matches')
export class TableDeMarqueController {
  constructor(
    private readonly annoncerMatch: AnnoncerMatchUseCase,
    private readonly demarrerMatch: DemarrerMatchUseCase,
    private readonly pauserMatch: PauserMatchUseCase,
    private readonly terminerMatch: TerminerMatchUseCase,
    private readonly editerChrono: EditerChronoUseCase,
    private readonly ajouterBut: AjouterButUseCase,
    private readonly supprimerBut: SupprimerButUseCase,
    private readonly ajouterPenalite: AjouterPenaliteUseCase,
    private readonly supprimerPenalite: SupprimerPenaliteUseCase,
    private readonly getEffectifs: GetEffectifsMatchUseCase,
    private readonly getMatchLive: GetMatchLiveUseCase,
  ) {}

  @Post(':numMatch/annoncer')
  @Roles('TABLE_DE_MARQUE', 'ORGANISATEUR')
  async annoncer(@Param('numMatch', ParseIntPipe) numMatch: number) {
    assertApiWritable();
    return this.annoncerMatch.execute(numMatch);
  }

  @Post(':numMatch/demarrer')
  @Roles('TABLE_DE_MARQUE', 'ORGANISATEUR')
  async demarrer(@Param('numMatch', ParseIntPipe) numMatch: number) {
    assertApiWritable();
    return this.demarrerMatch.execute(numMatch);
  }

  @Post(':numMatch/pauser')
  @Roles('TABLE_DE_MARQUE', 'ORGANISATEUR')
  async pauser(@Param('numMatch', ParseIntPipe) numMatch: number) {
    assertApiWritable();
    return this.pauserMatch.execute(numMatch);
  }

  @Post(':numMatch/terminer')
  @Roles('TABLE_DE_MARQUE', 'ORGANISATEUR')
  async terminer(@Param('numMatch', ParseIntPipe) numMatch: number) {
    assertApiWritable();
    return this.terminerMatch.execute(numMatch);
  }

  @Patch(':numMatch/chrono')
  @Roles('TABLE_DE_MARQUE', 'ORGANISATEUR')
  async chrono(
    @Param('numMatch', ParseIntPipe) numMatch: number,
    @Body() dto: EditerChronoDto,
  ) {
    assertApiWritable();
    return this.editerChrono.execute(numMatch, dto);
  }

  @Post(':numMatch/buts')
  @Roles('TABLE_DE_MARQUE', 'ORGANISATEUR')
  async ajouterButHandler(
    @Param('numMatch', ParseIntPipe) numMatch: number,
    @Body() dto: AjouterButDto,
  ) {
    assertApiWritable();
    return this.ajouterBut.execute(numMatch, dto);
  }

  @Delete(':numMatch/buts/:id')
  @Roles('TABLE_DE_MARQUE', 'ORGANISATEUR')
  async supprimerButHandler(
    @Param('numMatch', ParseIntPipe) numMatch: number,
    @Param('id', ParseIntPipe) id: number,
  ) {
    assertApiWritable();
    return this.supprimerBut.execute(numMatch, id);
  }

  @Post(':numMatch/penalites')
  @Roles('TABLE_DE_MARQUE', 'ORGANISATEUR')
  async ajouterPenaliteHandler(
    @Param('numMatch', ParseIntPipe) numMatch: number,
    @Body() dto: AjouterPenaliteDto,
  ) {
    assertApiWritable();
    return this.ajouterPenalite.execute(numMatch, dto);
  }

  @Delete(':numMatch/penalites/:id')
  @Roles('TABLE_DE_MARQUE', 'ORGANISATEUR')
  async supprimerPenaliteHandler(
    @Param('numMatch', ParseIntPipe) numMatch: number,
    @Param('id', ParseIntPipe) id: number,
  ) {
    assertApiWritable();
    return this.supprimerPenalite.execute(numMatch, id);
  }

  @Get(':numMatch/effectifs')
  async effectifs(@Param('numMatch', ParseIntPipe) numMatch: number) {
    return this.getEffectifs.execute(numMatch);
  }

  @Get(':numMatch/live')
  async live(@Param('numMatch', ParseIntPipe) numMatch: number) {
    return this.getMatchLive.execute(numMatch);
  }
}
