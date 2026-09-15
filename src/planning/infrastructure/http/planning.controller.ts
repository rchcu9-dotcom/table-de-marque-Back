import {
  Body,
  Controller,
  Get,
  Header,
  Param,
  ParseIntPipe,
  Patch,
  Post,
} from '@nestjs/common';
import { Roles } from '@/auth/decorators/roles.decorator';
import { assertApiWritable } from '@/infrastructure/http/read-only.util';
import { SimulerPlanningUseCase } from '../../application/use-cases/simuler-planning.usecase';
import { ExporterSimulationUseCase } from '../../application/use-cases/exporter-simulation.usecase';
import { AjusterSimulationUseCase } from '../../application/use-cases/ajuster-simulation.usecase';
import { ConfirmerPlanningUseCase } from '../../application/use-cases/confirmer-planning.usecase';
import { GetVerificationPlanningUseCase } from '../../application/use-cases/get-verification-planning.usecase';
import { SimulerPlanningDto } from '../../application/dto/simuler-planning.dto';
import { AjusterSimulationDto } from '../../application/dto/ajuster-simulation.dto';
import { ConfirmerPlanningDto } from '../../application/dto/confirmer-planning.dto';

@Controller('planning')
@Roles('ORGANISATEUR')
export class PlanningController {
  constructor(
    private readonly simulerPlanning: SimulerPlanningUseCase,
    private readonly exporterSimulation: ExporterSimulationUseCase,
    private readonly ajusterSimulation: AjusterSimulationUseCase,
    private readonly confirmerPlanning: ConfirmerPlanningUseCase,
    private readonly getVerificationPlanning: GetVerificationPlanningUseCase,
  ) {}

  @Post(':editionId/simuler')
  simuler(
    @Param('editionId', ParseIntPipe) editionId: number,
    @Body() dto: SimulerPlanningDto,
  ) {
    assertApiWritable();
    return this.simulerPlanning.execute(editionId, dto ?? {});
  }

  @Get(':editionId/simulation/:id/export')
  @Header('Content-Type', 'text/html; charset=utf-8')
  @Header(
    'Content-Disposition',
    'attachment; filename="planning-simulation.html"',
  )
  exporter(
    @Param('editionId', ParseIntPipe) editionId: number,
    @Param('id') id: string,
  ) {
    return this.exporterSimulation.execute(editionId, id);
  }

  @Patch(':editionId/simulation/:id/matchs/:num')
  ajuster(
    @Param('editionId', ParseIntPipe) editionId: number,
    @Param('id') id: string,
    @Param('num', ParseIntPipe) num: number,
    @Body() dto: AjusterSimulationDto,
  ) {
    assertApiWritable();
    return this.ajusterSimulation.execute(editionId, id, num, dto);
  }

  @Post(':editionId/confirmer')
  confirmer(
    @Param('editionId', ParseIntPipe) editionId: number,
    @Body() dto: ConfirmerPlanningDto,
  ) {
    assertApiWritable();
    return this.confirmerPlanning.execute(editionId, dto ?? {});
  }

  @Get(':editionId/verification')
  verification(@Param('editionId', ParseIntPipe) editionId: number) {
    return this.getVerificationPlanning.execute(editionId);
  }
}
