import { Inject, Injectable } from '@nestjs/common';
import {
  FORMAT_GRAPHE_REPOSITORY,
  FormatGrapheRepository,
} from '../../../domain/repositories/format-graphe.repository';
import { AssocierPhaseJourDto } from '../../dto/format-graphe/associer-phase-jour.dto';

@Injectable()
export class AssocierPhaseJourUseCase {
  constructor(
    @Inject(FORMAT_GRAPHE_REPOSITORY)
    private readonly repo: FormatGrapheRepository,
  ) {}

  async execute(
    editionId: number,
    phaseId: number,
    dto: AssocierPhaseJourDto,
  ): Promise<void> {
    await this.repo.associerPhaseJour(phaseId, dto.editionJourId);
    await this.repo.marquerModifieManuellement(editionId);
  }
}
