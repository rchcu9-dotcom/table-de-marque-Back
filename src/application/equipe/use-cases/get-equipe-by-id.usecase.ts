import { Inject, Injectable } from '@nestjs/common';
import { Equipe } from '@/domain/equipe/entities/equipe.entity';
import {
  EQUIPE_REPOSITORY,
  EquipeRepository,
} from '@/domain/equipe/repositories/equipe.repository';

@Injectable()
export class GetEquipeByIdUseCase {
  constructor(
    @Inject(EQUIPE_REPOSITORY)
    private readonly equipeRepo: EquipeRepository,
  ) {}

  async execute(id: string): Promise<Equipe | null> {
    return this.equipeRepo.findEquipeById(id);
  }
}
