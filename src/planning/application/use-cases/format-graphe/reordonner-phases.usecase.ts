import { Inject, Injectable } from '@nestjs/common';
import {
  FORMAT_GRAPHE_REPOSITORY,
  FormatGrapheRepository,
} from '../../../domain/repositories/format-graphe.repository';
import { ReordonnerPhasesDto } from '../../dto/format-graphe/reordonner-phases.dto';

@Injectable()
export class ReordonnerPhasesUseCase {
  constructor(
    @Inject(FORMAT_GRAPHE_REPOSITORY)
    private readonly repo: FormatGrapheRepository,
  ) {}

  async execute(editionId: number, dto: ReordonnerPhasesDto): Promise<void> {
    await this.repo.reordonnerPhases(editionId, dto.ordreIds);
    await this.repo.marquerModifieManuellement(editionId);
  }
}
