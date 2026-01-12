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
import { CacheSnapshotService } from '@/infrastructure/cache/cache.snapshot.service';

@Controller()
export class ClassementController {
  constructor(
    private readonly getClassementByPoule: GetClassementByPouleUseCase,
    private readonly getClassementByMatch: GetClassementByMatchUseCase,
    private readonly cache: CacheSnapshotService,
  ) {}

  @Get('poules/:code/classement')
  async byPoule(
    @Param('code') code: string,
    @Query('phase') phase?: string,
  ): Promise<PouleClassement> {
    const key = String(code).trim().toUpperCase();
    const entry =
      this.cache.getEntry<Record<string, PouleClassement>>('classement');
    const cached = entry?.data?.[key];
    if (cached) {
      if (this.cache.isStale(entry)) {
        this.getClassementByPoule
          .execute(code, phase)
          .then((fresh) => {
            const next = { ...(entry?.data ?? {}), [key]: fresh };
            this.cache.setEntry('classement', next);
          })
          .catch((err) => {
            console.warn('Classement refresh failed', err);
          });
      }
      return cached;
    }

    const classement = await this.getClassementByPoule.execute(code, phase);
    if (!classement) {
      throw new NotFoundException(
        `Classement introuvable pour la poule ${code}`,
      );
    }
    const next = { ...(entry?.data ?? {}), [key]: classement };
    this.cache.setEntry('classement', next);
    return classement;
  }

  @Get('matches/:id/classement')
  async byMatch(@Param('id') id: string): Promise<PouleClassement> {
    return this.getClassementByMatch.execute(id);
  }
}
