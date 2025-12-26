import { Inject, Injectable } from '@nestjs/common';
import {
  EQUIPE_REPOSITORY,
  EquipeRepository,
} from '@/domain/equipe/repositories/equipe.repository';
import { PouleClassement, PouleCode } from '@/domain/equipe/entities/equipe.entity';

@Injectable()
export class GetClassementByPouleUseCase {
  constructor(
    @Inject(EQUIPE_REPOSITORY)
    private readonly equipeRepo: EquipeRepository,
  ) {}

  async execute(code: PouleCode, phase?: string): Promise<PouleClassement | null> {
    const res = await this.equipeRepo.findClassementByPoule(code);
    if (!res) return null;
    if (phase && res.phase && res.phase !== phase) {
      return null;
    }
    const phaseValue = phase ?? res.phase;
    return phaseValue ? { ...res, phase: phaseValue } : { ...res };
  }
}
