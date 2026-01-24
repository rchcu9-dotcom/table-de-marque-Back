import { Body, Controller, Get, Param, Post, Query } from '@nestjs/common';
import { GetAteliersUseCase } from '@/application/challenge/use-cases/get-ateliers.usecase';
import { GetClassementAtelierUseCase } from '@/application/challenge/use-cases/get-classement-atelier.usecase';
import { GetClassementGlobalUseCase } from '@/application/challenge/use-cases/get-classement-global.usecase';
import { RecordTentativeUseCase } from '@/application/challenge/use-cases/record-tentative.usecase';
import { TentativeMetrics } from '@/domain/challenge/entities/tentative-atelier.entity';
import { GetChallengeByEquipeUseCase } from '@/application/challenge/use-cases/get-challenge-by-equipe.usecase';
import { GetChallengeAllUseCase } from '@/application/challenge/use-cases/get-challenge-all.usecase';
import { GetChallengeVitesseJ3UseCase } from '@/application/challenge/use-cases/get-challenge-vitesse-j3.usecase';

@Controller('challenge')
export class ChallengeController {
  constructor(
    private readonly getAteliers: GetAteliersUseCase,
    private readonly getClassement: GetClassementAtelierUseCase,
    private readonly getClassementGlobal: GetClassementGlobalUseCase,
    private readonly recordTentative: RecordTentativeUseCase,
    private readonly getChallengeByEquipe: GetChallengeByEquipeUseCase,
    private readonly getChallengeAll: GetChallengeAllUseCase,
    private readonly getChallengeVitesseJ3: GetChallengeVitesseJ3UseCase,
  ) {}

  @Get('ateliers')
  async listAteliers() {
    return this.getAteliers.execute();
  }

  @Get('ateliers/:id/classement')
  async classement(@Param('id') id: string) {
    return this.getClassement.execute(id);
  }

  @Get('classement-global')
  async classementGlobal() {
    return this.getClassementGlobal.execute();
  }

  @Post('ateliers/:id/tentatives')
  async createTentative(
    @Param('id') id: string,
    @Body() body: { joueurId: string; metrics: TentativeMetrics },
  ) {
    return this.recordTentative.execute({
      atelierId: id,
      joueurId: body.joueurId,
      metrics: body.metrics,
    });
  }

  @Get('equipes/:id')
  async challengeByEquipe(@Param('id') id: string) {
    return this.getChallengeByEquipe.execute(id);
  }

  @Get('all')
  async challengeAll(@Query('teamId') teamId?: string) {
    return this.getChallengeAll.execute(teamId);
  }

  @Get('vitesse/j3')
  async challengeVitesseJ3() {
    return this.getChallengeVitesseJ3.execute();
  }
}
