import {
  Controller,
  Get,
  NotFoundException,
  Param,
  Query,
} from '@nestjs/common';

import { GetClassementByPouleUseCase } from '@/application/equipe/use-cases/get-classement-by-poule.usecase';
import { GetClassementByMatchUseCase } from '@/application/equipe/use-cases/get-classement-by-match.usecase';
import {
  GetJ3FinalSquaresUseCase,
  J3FinalSquaresResponse,
} from '@/application/equipe/use-cases/get-j3-final-squares.usecase';
import { PouleClassement } from '@/domain/equipe/entities/equipe.entity';
import { CacheSnapshotService } from '@/infrastructure/cache/cache.snapshot.service';

@Controller()
export class ClassementController {
  constructor(
    private readonly getClassementByPoule: GetClassementByPouleUseCase,
    private readonly getClassementByMatch: GetClassementByMatchUseCase,
    private readonly getJ3FinalSquares: GetJ3FinalSquaresUseCase,
    private readonly cache: CacheSnapshotService,
  ) {}

  @Get('poules/:code/classement')
  async byPoule(
    @Param('code') code: string,
    @Query('phase') phase?: string,
  ): Promise<PouleClassement> {
    const classement = await this.getClassementByPoule.execute(code, phase);
    if (!classement) {
      throw new NotFoundException(
        `Classement introuvable pour la poule ${code}`,
      );
    }
    return classement;
  }

  @Get('matches/:id/classement')
  async byMatch(@Param('id') id: string): Promise<PouleClassement> {
    return this.getClassementByMatch.execute(id);
  }

  @Get('tournoi/5v5/j3/carres')
  async j3FinalSquares(): Promise<J3FinalSquaresResponse> {
    return this.cache.readThrough('j3carres', () =>
      this.getJ3FinalSquares.execute(),
    );
  }
}
