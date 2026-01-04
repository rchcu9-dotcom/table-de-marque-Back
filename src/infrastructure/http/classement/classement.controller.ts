import {
  Controller,
  Get,
  NotFoundException,
  Param,
  Query,
} from '@nestjs/common';

import { GetClassementByPouleUseCase } from '@/application/equipe/use-cases/get-classement-by-poule.usecase';
import { GetClassementByMatchUseCase } from '@/application/equipe/use-cases/get-classement-by-match.usecase';
import { PouleClassement } from '@/domain/equipe/entities/equipe.entity';

@Controller()
export class ClassementController {
  constructor(
    private readonly getClassementByPoule: GetClassementByPouleUseCase,
    private readonly getClassementByMatch: GetClassementByMatchUseCase,
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
}
