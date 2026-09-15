import { Inject, Injectable } from '@nestjs/common';
import {
  FORMAT_GRAPHE_REPOSITORY,
  FormatGrapheRepository,
} from '../../../domain/repositories/format-graphe.repository';
import { FormatLien } from '../../../domain/entities/format/format-lien.entity';

@Injectable()
export class ReinitialiserLienUseCase {
  constructor(
    @Inject(FORMAT_GRAPHE_REPOSITORY)
    private readonly repo: FormatGrapheRepository,
  ) {}

  async execute(
    editionId: number,
    groupeSourceId: number,
    rangSource: number,
  ): Promise<FormatLien> {
    const lien = await this.repo.reinitialiserLien(groupeSourceId, rangSource);
    await this.repo.marquerModifieManuellement(editionId);
    return lien;
  }
}
