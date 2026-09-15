import { Inject, Injectable } from '@nestjs/common';
import {
  FORMAT_GRAPHE_REPOSITORY,
  FormatGrapheRepository,
} from '../../../domain/repositories/format-graphe.repository';

@Injectable()
export class DissocierPhaseJourUseCase {
  constructor(
    @Inject(FORMAT_GRAPHE_REPOSITORY)
    private readonly repo: FormatGrapheRepository,
  ) {}

  async execute(
    editionId: number,
    phaseId: number,
    editionJourId: number,
  ): Promise<void> {
    await this.repo.dissocierPhaseJour(phaseId, editionJourId);
    await this.repo.marquerModifieManuellement(editionId);
  }
}
