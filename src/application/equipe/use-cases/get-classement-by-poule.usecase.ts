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

  async execute(code: PouleCode): Promise<PouleClassement | null> {
    return this.equipeRepo.findClassementByPoule(code);
  }
}
