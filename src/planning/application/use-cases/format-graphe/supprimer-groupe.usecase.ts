import { Inject, Injectable } from '@nestjs/common';
import {
  FORMAT_GRAPHE_REPOSITORY,
  FormatGrapheRepository,
} from '../../../domain/repositories/format-graphe.repository';

@Injectable()
export class SupprimerGroupeUseCase {
  constructor(
    @Inject(FORMAT_GRAPHE_REPOSITORY)
    private readonly repo: FormatGrapheRepository,
  ) {}

  async execute(editionId: number, groupeId: number): Promise<void> {
    await this.repo.deleteGroupe(groupeId);
    await this.repo.marquerModifieManuellement(editionId);
  }
}
